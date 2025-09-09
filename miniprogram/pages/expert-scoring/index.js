// pages/expert-scoring/index.js
const app = getApp()

Page({
  data: {
    submissionId: '', // 作品ID
    submission: null, // 作品信息
    expertInfo: null, // 专家信息
    scores: {
      themeFit: 0, // 主题契合度 (0-3分)
      creativity: 0, // 创意与表现力 (0-3分)
      craftsmanship: 0, // 工艺与材料 (0-2分)
      aesthetics: 0 // 美感与实用性 (0-2分)
    },
    deductions: {
      contentViolation: false, // 内容违规 扣3分并可能取消资格
      ethicsViolation: false, // 技术伦理失范 扣2分
      materialsIncomplete: false // 提交材料不全 扣1分
    },
    totalScore: 0, // 总分（扣分前）
    finalScore: 0, // 扣分后
    loading: true,
    submitting: false,
    showScoreGuide: false // 是否显示评分指南
  },

  onLoad: function(options) {
    const submissionId = options.submissionId;
    if (!submissionId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    this.setData({ submissionId });
    this.checkLoginStatus();
    this.fetchSubmissionDetail();
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

  // 获取作品详情
  fetchSubmissionDetail: function() {
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchSubmissionDetail',
        submissionId: this.data.submissionId
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          const submission = res.result.data;
          this.setData({
            submission: submission,
            scores: submission.existingScores || this.data.scores
          });
          
          // 计算总分
          this.calculateTotalScore();
        } else {
          console.error('获取作品详情失败', res);
          wx.showToast({
            title: '获取作品失败',
            icon: 'none'
          });
          wx.navigateBack();
        }
      },
      fail: err => {
        this.setData({ loading: false });
        console.error('调用云函数失败', err);
        wx.showToast({
          title: '网络异常',
          icon: 'none'
        });
        wx.navigateBack();
      }
    });
  },

  // 评分变化
  onScoreChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = parseFloat(e.detail.value) || 0;
    
    this.setData({
      [`scores.${field}`]: value
    });
    
    // 计算总分
    this.calculateTotalScore();
  },

  // 扣分项切换
  onDeductionToggle: function(e) {
    const field = e.currentTarget.dataset.field;
    const checked = !!e.detail.value;
    this.setData({ [`deductions.${field}`]: checked });
    this.calculateTotalScore();
  },

  // 计算总分
  calculateTotalScore: function() {
    const { themeFit, creativity, craftsmanship, aesthetics } = this.data.scores;
    const totalScore = themeFit + creativity + craftsmanship + aesthetics;
    const { contentViolation, ethicsViolation, materialsIncomplete } = this.data.deductions;
    let deductionPoints = 0;
    if (contentViolation) deductionPoints += 3;
    if (ethicsViolation) deductionPoints += 2;
    if (materialsIncomplete) deductionPoints += 1;
    const finalScore = Math.max(0, totalScore - deductionPoints);

    this.setData({ totalScore, finalScore });
  },

  // 显示评分指南
  showScoreGuide: function() {
    this.setData({
      showScoreGuide: true
    });
  },

  // 隐藏评分指南
  hideScoreGuide: function() {
    this.setData({
      showScoreGuide: false
    });
  },

  // 提交评分
  submitScore: function() {
    const { scores, totalScore, finalScore, deductions } = this.data;
    
    // 验证评分
    if (totalScore === 0) {
      wx.showToast({
        title: '请完成评分',
        icon: 'none'
      });
      return;
    }

    if (scores.themeFit === 0 || scores.creativity === 0 || scores.craftsmanship === 0 || scores.aesthetics === 0) {
      wx.showModal({
        title: '确认提交',
        content: '您有未评分的项目，确定要提交吗？',
        success: (res) => {
          if (res.confirm) {
            this.doSubmitScore();
          }
        }
      });
      return;
    }

    this.doSubmitScore();
  },

  // 执行提交评分
  doSubmitScore: function() {
    this.setData({ submitting: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'submitExpertScore',
        submissionId: this.data.submissionId,
        scores: this.data.scores,
        totalScore: totalScore,
        finalScore: finalScore,
        deductions: deductions,
        expertId: this.data.expertInfo.expertId,
        expertName: this.data.expertInfo.expertName
      },
      success: res => {
        this.setData({ submitting: false });
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '评分提交成功',
            icon: 'success'
          });
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '提交失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ submitting: false });
        console.error('提交评分失败', err);
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  }
})
