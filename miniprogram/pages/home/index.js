const app = getApp()

Page({
  data: {
    banners: [],
    notices: [],
    loading: true,
    showModal: false,
    currentNotice: null
  },
  
  onLoad: function() {
    // 页面加载时调用云函数获取最新数据
    this.fetchHomeData();
  },
  
  navigateToAppointment: function() {
    wx.navigateTo({
      url: '/pages/appointment/index'
    })
  },
  
  navigateToPotteryExhibition: function() {
    wx.switchTab({
      url: '/pages/pottery-exhibition/index'
    })
  },
  
  // 显示公告详情弹窗
  showNoticeDetail: function(e) {
    const index = e.currentTarget.dataset.id;
    if (this.data.notices[index]) {
      this.setData({
        currentNotice: this.data.notices[index],
        showModal: true
      });
    }
  },
  
  // 隐藏公告详情弹窗
  hideModal: function() {
    this.setData({
      showModal: false
    });
  },
  
  // 获取首页数据
  fetchHomeData: function(callback) {
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchHomeData'
      },
      success: res => {
        if (res.result && res.result.success) {
          const { banners, announcements } = res.result.data;
          
          this.setData({
            banners: banners || [],
            notices: announcements || [],
            loading: false
          });
        } else {
          console.error('获取首页数据失败', res);
          this.setData({ loading: false });
          wx.showToast({
            title: '获取数据失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('调用云函数失败', err);
        this.setData({ loading: false });
        wx.showToast({
          title: '网络异常',
          icon: 'none'
        });
      },
      complete: () => {
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  }
}) 