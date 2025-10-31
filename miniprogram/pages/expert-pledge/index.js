// pages/expert-pledge/index.js
Page({
  data: {
    agreed: false,
    expertInfo: null,
    dateRange: '',  // 评选日期范围
    currentDate: ''  // 当前日期
  },

  onLoad: function(options) {
    const expertInfo = wx.getStorageSync('expertInfo');
    
    if (!expertInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.redirectTo({
        url: '/pages/expert-login/index'
      });
      return;
    }
    
    // 根据评委类型设置日期范围
    let dateRange = '';
    const expertType = expertInfo.expertType;
    
    if (expertType === 'preliminary') {
      dateRange = '2025年10月25日—10月27日';
    } else if (expertType === 'final') {
      dateRange = '2025年10月30日—11月1日';
    } else {
      dateRange = '2025年**月**日—**月**日';
    }
    
    // 当前日期
    const now = new Date();
    const currentDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    
    this.setData({
      expertInfo: expertInfo,
      dateRange: dateRange,
      currentDate: currentDate
    });
    
    console.log('专家信息:', expertInfo);
    console.log('评选日期:', dateRange);
  },

  onAgreeChange: function(e) {
    const values = e.detail.value;
    const agreed = values.includes('agree');
    this.setData({ agreed });
  },

  onConfirm: function() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先阅读并同意承诺书',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });

    // 记录签署状态到数据库
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'signPledge',
        expertCode: this.data.expertInfo.expertCode,
        expertName: this.data.expertInfo.expertName,
        signTime: new Date(),
        dateRange: this.data.dateRange
      },
      success: res => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          // 本地也记录
          wx.setStorageSync('pledgeSigned', true);
          
          wx.showToast({
            title: '承诺书已签署',
            icon: 'success',
            duration: 1500
          });
          
          // 跳转到评分页面
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/expert-evaluation/index'
            });
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '签署失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('签署承诺书失败', err);
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  },

  onCancel: function() {
    wx.showModal({
      title: '提示',
      content: '您必须同意承诺书才能进行评分工作。\n\n取消将退出登录。',
      confirmText: '继续阅读',
      confirmColor: '#667eea',
      cancelText: '退出登录',
      cancelColor: '#999',
      success: (res) => {
        if (!res.confirm) {
          // 清除登录信息
          wx.removeStorageSync('expertInfo');
          wx.removeStorageSync('pledgeSigned');
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/expert-login/index'
            });
          }, 1000);
        }
      }
    });
  }
});






