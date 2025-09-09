// pages/pottery-exhibition/index.js
Page({
  data: {
    exhibition: {
      title: '2024景德镇国际大陶展',
      description: '景德镇国际大陶展是展示陶瓷艺术的国际性平台，汇集世界各地的优秀陶瓷艺术作品。欢迎艺术家和爱好者参与此次盛会，共同探索陶瓷艺术的无限可能。',
      timeRange: '2024年5月1日 - 6月30日',
      bannerImageUrl: '' // 默认为空，将从云函数获取
    },
    schedules: [
      {
        date: '5月1日',
        event: '开幕式',
        desc: '国际陶瓷艺术大师见面会及作品展示'
      },
      {
        date: '5月15日',
        event: '陶艺工作坊',
        desc: '专业陶艺家现场教学，零基础可参与'
      },
      {
        date: '6月10日',
        event: '评选活动',
        desc: '最佳陶瓷作品评选及颁奖仪式'
      }
    ],
    loading: true,
    canPersonalRegister: false // 个人报名是否可用
  },
  
  onLoad: function() {
    // 页面加载时调用云函数获取展览信息
    this.fetchExhibitionInfo();
    // 检查个人报名是否可用
    this.checkPersonalRegistrationAvailable();
  },
  
  // 检查个人报名是否可用（2025/6/4之后才能点击）
  checkPersonalRegistrationAvailable: function() {
    const currentDate = new Date();
    const targetDate = new Date('2025-06-04');
    
    this.setData({
      canPersonalRegister: currentDate >= targetDate
    });
  },
  
  // 导航到参展提交页面
  navigateToSubmission: function() {
    // 先检查用户是否已经报名
    this.checkSubmissionStatus();
  },
  
  // 个人报名功能
  navigateToPersonalRegistration: function() {
    if (!this.data.canPersonalRegister) {
      wx.showToast({
        title: '个人报名将于2025年6月4日开放',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 导航到我要参展页面
    wx.navigateTo({
      url: '/pages/pottery-submission/index'
    });
  },
  
  // 检查用户是否已经提交过参展申请
  checkSubmissionStatus: function() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchAllSubmissions'
      },
      success: res => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          const submissions = res.result.data || [];
          
          if (submissions.length > 0) {
            // 用户已经提交过参展申请
            wx.showModal({
              title: '已提交参展申请',
              content: '您已经提交过参展申请，是否前往查询页面查看或修改？',
              confirmText: '前往查询',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 用户点击"前往查询"，导航到查询页面
                  wx.navigateTo({
                    url: '/pages/pottery-query/index'
                  });
                }
              }
            });
          } else {
            // 用户还没有提交过参展申请，导航到提交页面
            wx.navigateTo({
              url: '/pages/pottery-submission/index'
            });
          }
        } else {
          // 查询失败，允许用户继续前往提交页面
          console.error('获取申请记录失败', res);
          wx.navigateTo({
            url: '/pages/pottery-submission/index'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用云函数失败', err);
        
        // 出错时也允许用户继续前往提交页面
        wx.navigateTo({
          url: '/pages/pottery-submission/index'
        });
      }
    });
  },
  
  // 导航到参展查询页面
  navigateToQuery: function() {
    wx.navigateTo({
      url: '/pages/pottery-query/index'
    })
  },
  
  // 导航到作品运送页面
  navigateToDelivery: function() {
    wx.navigateTo({
      url: '/pages/artwork-delivery/index'
    })
  },

  // 导航到专家评选页面
  navigateToExpertEvaluation: function() {
    wx.navigateTo({
      url: '/pages/expert-login/index'
    })
  },
  
  // 获取展览信息
  fetchExhibitionInfo: function() {
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { 
        type: 'fetchPotteryExhibition'
      },
      success: res => {
        console.log('获取展览信息成功', res);
        if (res.result && res.result.success) {
          const { exhibition, schedules } = res.result.data;
          
          this.setData({
            exhibition: exhibition || this.data.exhibition,
            schedules: schedules || this.data.schedules,
            loading: false
          });
        } else {
          console.error('获取展览信息失败', res);
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
      }
    });
  }
}) 