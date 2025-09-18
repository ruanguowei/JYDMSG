// pages/expert-evaluation/index.js
const app = getApp()

Page({
  data: {
    expertInfo: null, // 专家信息
    submissions: [], // 待评选作品列表（只包含未评分的）
    loading: true,
    // 管理员相关
    showAdminModal: false,
    adminAccount: '',
    adminPassword: '',
    adminLoading: false,
    // 进度提示
    showProgressModal: false
  },

  onLoad: function() {
    // 检查登录状态
    this.checkLoginStatus();
    // 获取待评选作品
    this.fetchSubmissions();
  },

  onShow: function() {
    // 页面显示时刷新数据
    this.fetchSubmissions();
  },

  // 检查登录状态
  checkLoginStatus: function() {
    // 强制每次进入都需要刚刚验证：
    // 仅当从登录页带着一次性通行票进入时放行
    const ticket = wx.getStorageSync('expertLoginTicket');
    if (!ticket) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.redirectTo({
        url: '/pages/expert-login/index'
      });
      return;
    }
    // 读取专家信息，用于展示
    const expertInfo = wx.getStorageSync('expertInfo') || null;
    this.setData({ expertInfo });
    // 票据只使用一次，立即销毁，确保下次必须重新登录
    wx.removeStorageSync('expertLoginTicket');
  },

  // 获取待评选作品
  fetchSubmissions: function() {
    this.setData({ loading: true });
    
    // 获取专家信息
    const expertInfo = wx.getStorageSync('expertInfo');
    if (!expertInfo || !expertInfo.expertCode) {
      this.setData({ loading: false });
      wx.showToast({
        title: '专家信息异常',
        icon: 'none'
      });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchSubmissionsForEvaluation',
        expertCode: expertInfo.expertCode
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          const allSubmissions = res.result.data || [];
          
          // 只显示未评分的作品
          const unevaluatedSubmissions = allSubmissions.filter(item => !item.isEvaluated);
          
          // 调试信息：输出专家信息和作品列表
          console.log('=== 专家评审页面调试信息 ===');
          console.log('当前专家信息:', this.data.expertInfo);
          console.log('专家Code:', this.data.expertInfo ? this.data.expertInfo.expertCode : '未获取到');
          console.log('全部作品数量:', allSubmissions.length);
          console.log('未评分作品数量:', unevaluatedSubmissions.length);
          
          // 调试信息：输出每个未评分作品的信息
          unevaluatedSubmissions.forEach((submission, index) => {
            console.log(`未评分作品${index + 1}:`, {
              id: submission.id,
              title: submission.title,
              category: submission.categoryName
            });
          });
          console.log('========================');
          
          this.setData({
            submissions: unevaluatedSubmissions
          });
        } else {
          console.error('获取作品列表失败', res);
          wx.showToast({
            title: '获取作品失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ loading: false });
        console.error('调用云函数失败', err);
        wx.showToast({
          title: '网络异常',
          icon: 'none'
        });
      }
    });
  },


  // 跳转到作品评分页面
  navigateToScoring: function(e) {
    const submissionId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/expert-scoring/index?submissionId=${submissionId}`
    });
  },


  // 下拉刷新
  onPullDownRefresh: function() {
    this.fetchSubmissions(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 显示管理员登录弹窗
  showAdminLogin: function() {
    this.setData({
      showAdminModal: true,
      adminAccount: '',
      adminPassword: ''
    });
  },

  // 隐藏管理员登录弹窗
  hideAdminModal: function() {
    this.setData({
      showAdminModal: false,
      adminLoading: false
    });
  },

  // 管理员账号输入
  onAdminAccountInput: function(e) {
    this.setData({
      adminAccount: e.detail.value
    });
  },

  // 管理员密码输入
  onAdminPasswordInput: function(e) {
    this.setData({
      adminPassword: e.detail.value
    });
  },

  // 确认管理员登录
  confirmAdminLogin: function() {
    const { adminAccount, adminPassword } = this.data;
    
    if (!adminAccount.trim()) {
      wx.showToast({
        title: '请输入管理员账号',
        icon: 'none'
      });
      return;
    }
    
    if (!adminPassword.trim()) {
      wx.showToast({
        title: '请输入管理员密码',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ adminLoading: true });
    
    // 调用管理员验证云函数
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'verifyAdmin',
        account: adminAccount.trim(),
        password: adminPassword.trim()
      },
      success: res => {
        this.setData({ adminLoading: false });
        
        if (res.result && res.result.success) {
          // 验证成功，隐藏登录弹窗，显示进度弹窗
          this.setData({
            showAdminModal: false,
            showProgressModal: true
          });
          
          // 调用生成排名结果云函数
          this.generateRankingResults(adminAccount.trim(), adminPassword.trim());
        } else {
          wx.showToast({
            title: res.result ? res.result.message : '验证失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ adminLoading: false });
        console.error('管理员验证失败:', err);
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 生成排名结果
  generateRankingResults: function(adminAccount, adminPassword) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'generateRankingResults'
      },
      success: res => {
        this.setData({ showProgressModal: false });
        
        if (res.result && res.result.success) {
          wx.showModal({
            title: '生成成功',
            content: `已生成结果，共${res.result.data.totalCount}个作品。\n文件已保存到云存储，请前往后台查询查看排名结果。`,
            showCancel: false,
            confirmText: '确定'
          });
        } else {
          wx.showToast({
            title: res.result ? res.result.message : '生成失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ showProgressModal: false });
        console.error('生成排名结果失败:', err);
        wx.showToast({
          title: '生成失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 隐藏进度弹窗
  hideProgressModal: function() {
    // 进度弹窗不允许手动关闭
  },

  // 阻止事件冒泡
  stopPropagation: function() {
    // 阻止事件冒泡
  }
})
