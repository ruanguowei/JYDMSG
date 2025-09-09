// pages/expert-login/index.js
const app = getApp()

Page({
  data: {
    expertCode: '', // 专家验证码
    expertName: '', // 专家姓名
    loading: false,
    showRules: false // 是否显示评审规则
  },

  onLoad: function() {
    // 强制每次进入都要求输入并验证，不再自动跳过
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const expertInfo = wx.getStorageSync('expertInfo');
    if (expertInfo && expertInfo.isLoggedIn) {
      // 已经登录，直接跳转到评选主页
      wx.redirectTo({
        url: '/pages/expert-evaluation/index'
      });
    }
  },

  // 输入专家验证码
  onExpertCodeInput: function(e) {
    this.setData({
      expertCode: e.detail.value
    });
  },

  // 输入专家姓名
  onExpertNameInput: function(e) {
    this.setData({
      expertName: e.detail.value
    });
  },

  // 专家登录
  expertLogin: function() {
    const { expertCode, expertName } = this.data;
    
    if (!expertCode.trim()) {
      wx.showToast({
        title: '请输入专家验证码',
        icon: 'none'
      });
      return;
    }

    if (!expertName.trim()) {
      wx.showToast({
        title: '请输入专家姓名',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    // 调用云函数验证专家身份
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'expertLogin',
        expertCode: expertCode.trim(),
        expertName: expertName.trim()
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          // 登录成功，保存专家信息
          const expertInfo = {
            expertId: res.result.expertId,
            expertName: expertName.trim(),
            expertCode: expertCode.trim(),
            isLoggedIn: true,
            loginTime: new Date().getTime()
          };
          
          wx.setStorageSync('expertInfo', expertInfo);
          // 生成一次性登录通行票，进入评选页后立即消费
          wx.setStorageSync('expertLoginTicket', {
            createdAt: Date.now()
          });
          
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });

          // 跳转到评选主页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/expert-evaluation/index'
            });
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ loading: false });
        console.error('专家登录失败', err);
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 显示评审规则
  showRules: function() {
    this.setData({
      showRules: true
    });
  },

  // 隐藏评审规则
  hideRules: function() {
    this.setData({
      showRules: false
    });
  },

  // 同意评审规则并登录
  agreeRulesAndLogin: function() {
    this.hideRules();
    this.expertLogin();
  }
})
