// pages/expert-evaluation/index.js
const app = getApp()

Page({
  data: {
    expertInfo: null, // 专家信息
    submissions: [], // 待评选作品列表
    loading: true,
    selectedCategory: 'all', // 选中的分类
    categories: [
      { key: 'all', name: '全部作品' },
      { key: 'technique', name: '技艺类' },
      { key: 'culture', name: '文脉类' },
      { key: 'algorithm', name: '算法类' },
      { key: 'industry', name: '产业类' },
      { key: 'vision', name: '视界类' }
    ],
    filteredSubmissions: [], // 筛选后的作品
    evaluationStats: {
      total: 0,
      evaluated: 0,
      remaining: 0
    }
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
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchSubmissionsForEvaluation'
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          const submissions = res.result.data || [];
          this.setData({
            submissions: submissions,
            filteredSubmissions: submissions
          });
          
          // 更新统计信息
          this.updateEvaluationStats();
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

  // 更新评选统计信息
  updateEvaluationStats: function() {
    const submissions = this.data.submissions;
    const total = submissions.length;
    const evaluated = submissions.filter(item => item.isEvaluated).length;
    const remaining = total - evaluated;
    
    this.setData({
      evaluationStats: {
        total: total,
        evaluated: evaluated,
        remaining: remaining
      }
    });
  },

  // 分类筛选
  onCategoryChange: function(e) {
    const category = e.currentTarget.dataset.category;
    const submissions = this.data.submissions;
    
    let filteredSubmissions = submissions;
    if (category !== 'all') {
      filteredSubmissions = submissions.filter(item => item.category === category);
    }
    
    this.setData({
      selectedCategory: category,
      filteredSubmissions: filteredSubmissions
    });
  },

  // 跳转到作品评分页面
  navigateToScoring: function(e) {
    const submissionId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/expert-scoring/index?submissionId=${submissionId}`
    });
  },

  // 查看评分结果
  navigateToResults: function() {
    wx.navigateTo({
      url: '/pages/expert-results/index'
    });
  },

  // 专家退出登录
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出专家评审系统吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除专家登录信息
          wx.removeStorageSync('expertInfo');
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          
          // 跳转到登录页面
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/expert-login/index'
            });
          }, 1500);
        }
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.fetchSubmissions(() => {
      wx.stopPullDownRefresh();
    });
  }
})
