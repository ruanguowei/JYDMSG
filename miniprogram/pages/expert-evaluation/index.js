// pages/expert-evaluation/index.js
const app = getApp()
const reviewPrefetch = require('../../utils/review-prefetch')

Page({
  data: {
    expertInfo: null, // 专家信息
    selectedCategory: '',
    selectedCategoryName: '',
    categories: [
      { key: 'technique', name: '传统类' }, { key: 'culture', name: '当代类' },
      { key: 'algorithm', name: '数字类' }, { key: 'industry', name: '产业类' }
    ],
    listError: '',
    submissions: [], // 待评选作品列表（只包含未评分的）
    loading: true,
    // 评委角色信息
    expertRoleInfo: null,
    showPhaseInfo: false,
    // 评分统计信息
    statistics: null,
    // 刷新标记
    needRefresh: false,
    // 管理员相关
    showAdminModal: false,
    adminAccount: '',
    adminPassword: '',
    adminLoading: false,
    // 进度提示
    showProgressModal: false
  },

  onLoad: function() {
    reviewPrefetch.clear();
    this._isPageActive = true;
    this._skipNextShowRefresh = true;
    // 检查登录状态
    if (this.checkLoginStatus()) this.fetchSubmissions();
  },

  onShow: function() {
    reviewPrefetch.clear();
    this._isPageActive = true;
    if (this._skipNextShowRefresh) {
      this._skipNextShowRefresh = false;
      return;
    }

    this._navigating = false;
    this.setData({ selectedCategory: '', selectedCategoryName: '', submissions: [], statistics: null });
    if (this.data.expertInfo) this.fetchSubmissions();
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
      return false;
    }
    // 读取专家信息，用于展示
    const expertInfo = wx.getStorageSync('expertInfo') || null;
    this.setData({ expertInfo });
    // 票据只使用一次，立即销毁，确保下次必须重新登录
    wx.removeStorageSync('expertLoginTicket');
    return !!expertInfo;
  },

  // 获取待评选作品
  fetchSubmissions: function(retryCount = 0) {
    const completeCallback = typeof retryCount === 'function' ? retryCount : null;
    if (typeof retryCount !== 'number') retryCount = 0;
    if (this._submissionsRequestPending) { if (completeCallback) completeCallback(); return; }
    const expert = this.data.expertInfo;
    if (!expert || !expert.expertCode) { if (completeCallback) completeCallback(); return; }
    clearTimeout(this._retryTimer);
    const requestId = (this._requestId || 0) + 1;
    this._requestId = requestId;
    this._submissionsRequestPending = true;
    const category = this.data.selectedCategory;
    this.setData({ loading: true, listError: '' });
    wx.cloud.callFunction({
      name: 'fetchSubmissionsForEvaluation',
      data: { expertCode: expert.expertCode,
        editionId: expert.editionId || (app.globalData.currentEdition || {}).editionId || 'pottery-2026',
        category, summaryOnly: !category, batchOnly: !!category },
      timeout: 60000,
      success: res => {
        if (!this._isPageActive || requestId !== this._requestId) return;
        this._submissionsRequestPending = false;
        const result = res.result;
        if (!result || !result.success) {
          if (result && result.code === 'ORIENTATION_REQUIRED') { wx.redirectTo({ url: '/pages/expert-orientation/index' }); return; }
          this.setData({ loading: false, listError: (result && result.message) || '作品加载失败，请重试', submissions: [] });
          return;
        }
        // Hard cap prevents accidental large responses from accumulating in setData.
        const submissions = (result.data || []).filter(w => category && w.category === category).slice(0, 5);
        this.setData({ loading: false, submissions, categories: result.categories || this.data.categories,
          expertRoleInfo: result.expertInfo, showPhaseInfo: true, statistics: result.statistics || null });
        if (category) {
          if (submissions.length) {
            this.navigateToScoring({ currentTarget: { dataset: { id: submissions[0].id } } });
          } else {
            wx.showToast({ title: '本类别暂无待评作品', icon: 'none' });
            this.backToCategories();
          }
        }
      },
      fail: () => {
        if (!this._isPageActive || requestId !== this._requestId) return;
        this._submissionsRequestPending = false;
        this.setData({ loading: false, listError: '网络繁忙，请重试' });
        if (retryCount < 2) this._retryTimer = setTimeout(() => {
          if (this._isPageActive && requestId === this._requestId) this.fetchSubmissions(retryCount + 1);
        }, 1000 * (retryCount + 1));
      },
      complete: () => { if (completeCallback) completeCallback(); }
    });
  },

  selectCategory: function(e) {
    const category = this.data.categories.find(item => item.key === e.currentTarget.dataset.category);
    if (!category || this._navigating) return;
    this._requestId = (this._requestId || 0) + 1;
    this._submissionsRequestPending = false;
    clearTimeout(this._retryTimer);
    this.setData({ selectedCategory: category.key, selectedCategoryName: category.name, submissions: [], statistics: null });
    this.fetchSubmissions();
  },

  backToCategories: function() {
    this._requestId = (this._requestId || 0) + 1;
    this._submissionsRequestPending = false;
    clearTimeout(this._retryTimer);
    this.setData({ selectedCategory: '', selectedCategoryName: '', submissions: [], statistics: null });
    this.fetchSubmissions();
  },

  onHide: function() {
    this._isPageActive = false;
    this._requestId = (this._requestId || 0) + 1;
    this._submissionsRequestPending = false;
    clearTimeout(this._retryTimer);
    this._retryTimer = null;
  },

  onUnload: function() {
    reviewPrefetch.clear();
    this._isPageActive = false;
    this._submissionsRequestPending = false;
    clearTimeout(this._retryTimer);
    clearTimeout(this._navigationTimer);
    this._retryTimer = null;
    this._navigationTimer = null;
  },


  // 跳转到作品评分页面
  navigateToScoring: function(e) {
    if (this._navigating || !this.data.selectedCategory) return;
    const submissionId = e.currentTarget.dataset.id;
    if (!this.data.submissions.some(w => w.id === submissionId && w.category === this.data.selectedCategory)) return;
    this._navigating = true;
    wx.navigateTo({
      url: `/pages/expert-scoring/index?submissionId=${encodeURIComponent(submissionId)}&category=${this.data.selectedCategory}`,
      fail: () => {
        this._navigating = false;
        this.setData({ listError: '打开作品失败，请重新点击类别' });
      }
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
          // 验证成功
          wx.showToast({
            title: '验证成功',
            icon: 'success',
            duration: 1500
          });
          
          // 保存管理员信息到本地
          wx.setStorageSync('adminInfo', {
            account: adminAccount.trim(),
            id: res.result.adminInfo.id,
            isLoggedIn: true
          });
          
          // 隐藏登录弹窗
          this.setData({
            showAdminModal: false
          });
          
          // 跳转到管理员面板
          clearTimeout(this._navigationTimer);
          this._navigationTimer = setTimeout(() => {
            this._navigationTimer = null;
            wx.navigateTo({
              url: '/pages/admin-panel/index'
            });
          }, 1500);
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
