// pages/expert-results/index.js
const app = getApp()

Page({
  data: {
    expertInfo: null, // 专家信息
    evaluationResults: [], // 评选结果
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
    filteredResults: [], // 筛选后的结果
    stats: {
      totalEvaluated: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0
    }
  },

  onLoad: function() {
    this.checkLoginStatus();
    this.fetchEvaluationResults();
  },

  onShow: function() {
    this.fetchEvaluationResults();
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const expertInfo = wx.getStorageSync('expertInfo');
    if (!expertInfo || !expertInfo.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.redirectTo({
        url: '/pages/expert-login/index'
      });
      return;
    }
    
    this.setData({
      expertInfo: expertInfo
    });
  },

  // 获取评选结果
  fetchEvaluationResults: function() {
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchEvaluationResults',
        expertId: this.data.expertInfo.expertId
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          const results = res.result.data || [];
          this.setData({
            evaluationResults: results,
            filteredResults: results
          });
          
          // 更新统计信息
          this.updateStats();
        } else {
          console.error('获取评选结果失败', res);
          wx.showToast({
            title: '获取结果失败',
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

  // 更新统计信息
  updateStats: function() {
    const results = this.data.evaluationResults;
    const totalEvaluated = results.length;
    
    if (totalEvaluated === 0) {
      this.setData({
        stats: {
          totalEvaluated: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0
        }
      });
      return;
    }
    
    const scores = results.map(item => item.totalScore);
    const averageScore = (scores.reduce((sum, score) => sum + score, 0) / totalEvaluated).toFixed(1);
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    
    this.setData({
      stats: {
        totalEvaluated: totalEvaluated,
        averageScore: averageScore,
        highestScore: highestScore,
        lowestScore: lowestScore
      }
    });
  },

  // 分类筛选
  onCategoryChange: function(e) {
    const category = e.currentTarget.dataset.category;
    const results = this.data.evaluationResults;
    
    let filteredResults = results;
    if (category !== 'all') {
      filteredResults = results.filter(item => item.category === category);
    }
    
    this.setData({
      selectedCategory: category,
      filteredResults: filteredResults
    });
  },

  // 查看作品详情
  viewSubmissionDetail: function(e) {
    const submissionId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/expert-scoring/index?submissionId=${submissionId}`
    });
  },

  // 导出结果
  exportResults: function() {
    wx.showModal({
      title: '导出结果',
      content: '确定要导出评选结果吗？',
      success: (res) => {
        if (res.confirm) {
          this.doExportResults();
        }
      }
    });
  },

  // 执行导出结果
  doExportResults: function() {
    wx.showLoading({
      title: '导出中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'exportEvaluationResults',
        expertId: this.data.expertInfo.expertId
      },
      success: res => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '导出成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.result.message || '导出失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('导出结果失败', err);
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 返回评选主页
  backToEvaluation: function() {
    wx.navigateBack();
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.fetchEvaluationResults(() => {
      wx.stopPullDownRefresh();
    });
  }
})
