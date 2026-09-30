// pages/pottery-exhibition/index.js
const app = getApp();

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
    currentEdition: {
      editionId: 'pottery-2026',
      editionNumber: 3,
      title: '第三届全国大学生陶艺作品展',
      status: 'preparing',
      featureFlags: {}
    }
  },
  
  onLoad: function() {
    // 页面加载时调用云函数获取展览信息
    this.fetchExhibitionInfo();
    this.loadEditionInfo();
  },

  loadEditionInfo: function() {
    const fallback = app.globalData && app.globalData.currentEdition;
    if (fallback) {
      this.applyEditionInfo(fallback);
    }

    if (app.loadCurrentEdition) {
      app.loadCurrentEdition().then(edition => {
        this.applyEditionInfo(edition);
      }).catch(error => {
        console.warn('获取当前届次配置失败，使用本地兜底:', error);
      });
    }
  },

  applyEditionInfo: function(edition) {
    this.setData({
      currentEdition: edition
    });
  },

  isFeatureOpen: function(feature) {
    const flags = (this.data.currentEdition && this.data.currentEdition.featureFlags) || {};
    return flags[feature] !== false;
  },

  showFeatureUnavailable: function(title, reason) {
    wx.showModal({
      title: title || '入口暂未开放',
      content: reason || `${this.data.currentEdition.title || '当前届次'}该功能暂未开放，请以后台配置时间为准。`,
      showCancel: false
    });
  },
  
  
  // 导航到参展提交页面
  navigateToSubmission: function() {
    if (!this.isFeatureOpen('registration')) {
      this.showFeatureUnavailable('报名暂未开放');
      return;
    }

    // 先校验提交时间窗口
    wx.showLoading({ title: '校验提交时间...', mask: true })
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getDeliveryTimeLimit' },
      success: res => {
        wx.hideLoading()
        if (!res.result || !res.result.success) {
          wx.showToast({ title: '无法获取提交时间配置', icon: 'none' })
          return
        }
        const cfg = res.result.data
        if (!cfg || !cfg.submissionBeginDeadline || !cfg.submissionEndDeadline) {
          wx.showModal({
            title: '提示',
            content: '尚未配置作品提交时间，请稍后再试。',
            showCancel: false
          })
          return
        }
        
        // 使用相同的时间解析逻辑
        const parseTimeToMs = (timeStr, isEndTime = false) => {
          if (!timeStr) return NaN
          const date = new Date(timeStr)
          let time = date.getTime()
          
          // 如果是结束时间且只有日期没有时间（时间为00:00:00）
          if (isEndTime && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            // 设置为当天的23:59:59
            time = time + 24 * 60 * 60 * 1000 - 1000 // 加一天减1毫秒
          }
          
          return time
        }
        
        const now = Date.now()
        const start = parseTimeToMs(cfg.submissionBeginDeadline, false)
        const end = parseTimeToMs(cfg.submissionEndDeadline, true)
        
        console.log('[submission_time_limit] raw:', cfg, 'parsed:', { start, end, now })
        
        if (isNaN(start) || isNaN(end)) {
          wx.showModal({
            title: '提示',
            content: '提交时间配置格式错误，请联系管理员。',
            showCancel: false
          })
          return
        }
        
        if (now < start) {
          const startDate = new Date(start).toLocaleDateString('zh-CN')
          wx.showModal({
            title: '提示',
            content: `作品提交尚未开始，开始时间：${startDate}`,
            showCancel: false
          })
          return
        }
        
        if (now > end) {
          const endDate = new Date(end).toLocaleDateString('zh-CN')
          wx.showModal({
            title: '提示',
            content: `作品提交已结束，结束时间：${endDate}`,
            showCancel: false
          })
          return
        }
        
        // 时间验证通过后，检查是否已提交
        this.checkSubmissionStatus()
      },
      fail: err => {
        wx.hideLoading()
        console.error('获取提交时间配置失败', err)
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
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

  // 导航到邀约入口（参展申请页面）
  navigateToInvitation: function() {
    if (!this.isFeatureOpen('registration')) {
      this.showFeatureUnavailable('邀约入口暂未开放');
      return;
    }

    // 先校验提交时间窗口
    wx.showLoading({ title: '校验提交时间...', mask: true })
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getDeliveryTimeLimit' },
      success: res => {
        wx.hideLoading()
        if (!res.result || !res.result.success) {
          wx.showToast({ title: '无法获取提交时间配置', icon: 'none' })
          return
        }
        const cfg = res.result.data
        if (!cfg || !cfg.submissionBeginDeadline || !cfg.submissionEndDeadline) {
          wx.showModal({
            title: '提示',
            content: '尚未配置作品提交时间，请稍后再试。',
            showCancel: false
          })
          return
        }
        
        // 使用相同的时间解析逻辑
        const parseTimeToMs = (timeStr, isEndTime = false) => {
          if (!timeStr) return NaN
          const date = new Date(timeStr)
          let time = date.getTime()
          
          // 如果是结束时间且只有日期没有时间（时间为00:00:00）
          if (isEndTime && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            // 设置为当天的23:59:59
            time = time + 24 * 60 * 60 * 1000 - 1000 // 加一天减1毫秒
          }
          
          return time
        }
        
        const now = Date.now()
        const start = parseTimeToMs(cfg.submissionBeginDeadline, false)
        const end = parseTimeToMs(cfg.submissionEndDeadline, true)
        
        console.log('[invitation_time_limit] raw:', cfg, 'parsed:', { start, end, now })
        
        if (isNaN(start) || isNaN(end)) {
          wx.showModal({
            title: '提示',
            content: '提交时间配置格式错误，请联系管理员。',
            showCancel: false
          })
          return
        }
        
        if (now < start) {
          const startDate = new Date(start).toLocaleDateString('zh-CN')
          wx.showModal({
            title: '提示',
            content: `作品提交尚未开始，开始时间：${startDate}`,
            showCancel: false
          })
          return
        }
        
        if (now > end) {
          const endDate = new Date(end).toLocaleDateString('zh-CN')
          wx.showModal({
            title: '提示',
            content: `作品提交已结束，结束时间：${endDate}`,
            showCancel: false
          })
          return
        }
        
        // 时间验证通过后，检查是否已提交
        this.checkSubmissionStatus()
      },
      fail: err => {
        wx.hideLoading()
        console.error('获取提交时间配置失败', err)
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },
  
  // 导航到作品运送页面
  navigateToDelivery: function() {
    if (!this.isFeatureOpen('delivery')) {
      this.showFeatureUnavailable('作品运送暂未开放');
      return;
    }

    // 先校验作品运送时间窗口
    wx.showLoading({ title: '校验运送时间...', mask: true })
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getDeliveryTimeLimit' },
      success: res => {
        wx.hideLoading()
        if (!res.result || !res.result.success) {
          wx.showToast({ title: '无法获取运送时间配置', icon: 'none' })
          return
        }
        const cfg = res.result.data
        if (!cfg || !cfg.deliveryBeginTime || !cfg.deliveryEndTime) {
          wx.showModal({
            title: '提示',
            content: '尚未配置作品运送时间，请稍后再试。',
            showCancel: false
          })
          return
        }
        
        // 解析时间配置
        const parseTimeToMs = (timeStr, isEndTime = false) => {
          if (!timeStr) return NaN
          const date = new Date(timeStr)
          let time = date.getTime()
          
          // 如果是结束时间且只有日期没有时间（时间为00:00:00）
          if (isEndTime && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            // 设置为当天的23:59:59
            time = time + 24 * 60 * 60 * 1000 - 1000 // 加一天减1毫秒
          }
          
          return time
        }
        
        const now = Date.now()
        const start = parseTimeToMs(cfg.deliveryBeginTime, false)
        const end = parseTimeToMs(cfg.deliveryEndTime, true)
        
        console.log('[delivery_time_limit] raw:', cfg, 'parsed:', { start, end, now })
        
        if (isNaN(start) || isNaN(end)) {
          wx.showModal({
            title: '提示',
            content: '运送时间配置格式错误，请联系管理员。',
            showCancel: false
          })
          return
        }
        
        if (now < start) {
          const startDate = new Date(start).toLocaleDateString('zh-CN')
          wx.showModal({
            title: '提示',
            content: `作品运送尚未开始，开始时间：${startDate}`,
            showCancel: false
          })
          return
        }
        
        if (now > end) {
          const endDate = new Date(end).toLocaleDateString('zh-CN')
          wx.showModal({
            title: '提示',
            content: `作品运送已结束，结束时间：${endDate}`,
            showCancel: false
          })
          return
        }
        
        // 时间验证通过，跳转到作品运送页面
        wx.navigateTo({
          url: '/pages/artwork-delivery/index'
        })
      },
      fail: err => {
        wx.hideLoading()
        console.error('获取运送时间限制失败:', err)
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },

  // 导航到查询入围页面
  navigateToWorkQuery: function() {
    if (!this.isFeatureOpen('shortlistedQuery')) {
      this.showFeatureUnavailable('入围查询暂未开放', '入围结果尚未发布，请稍后再查。');
      return;
    }

    wx.navigateTo({
      url: '/pages/work-query/index'
    });
  },

  // 导航到获奖查询页面
  navigateToAwardQuery: function() {
    if (!this.isFeatureOpen('awardQuery')) {
      this.showFeatureUnavailable('获奖查询暂未开放', '获奖结果尚未发布，请稍后再查。');
      return;
    }

    wx.navigateTo({
      url: '/pages/award-query/index'
    });
  },

  // 导航到专家评选页面
  navigateToExpertEvaluation: function() {
    if (!this.isFeatureOpen('expertEvaluation')) {
      this.showFeatureUnavailable('专家评选暂未开放');
      return;
    }

    // 先校验评审时间窗口
    wx.showLoading({ title: '校验评审时间...', mask: true })
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getEvaluationSettings' },
      success: res => {
        wx.hideLoading()
        if (!res.result || !res.result.success) {
          wx.showToast({ title: '无法获取评审配置', icon: 'none' })
          return
        }
        const cfg = res.result.data
        if (!cfg || !cfg.startTime || !cfg.endTime) {
          wx.showModal({
            title: '提示',
            content: '尚未配置评审时间，请稍后再试。',
            showCancel: false
          })
          return
        }
        // 使用与推选入口、作品运送相同的时间解析逻辑
        const parseTimeToMs = (timeStr, isEndTime = false) => {
          if (!timeStr) return NaN
          const date = new Date(timeStr)
          let time = date.getTime()
          
          // 如果是结束时间且只有日期没有时间（时间为00:00:00）
          if (isEndTime && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
            // 设置为当天的23:59:59
            time = time + 24 * 60 * 60 * 1000 - 1000 // 加一天减1毫秒
          }
          
          return time
        }
        
        const now = Date.now()
        const start = parseTimeToMs(cfg.startTime, false)
        const end = parseTimeToMs(cfg.endTime, true)
        console.log('[evaluation_settings] raw:', cfg, 'parsed:', { start, end, now })
        
        if (isNaN(start) || isNaN(end)) {
          wx.showModal({
            title: '提示',
            content: '评审时间配置格式错误，请联系管理员。',
            showCancel: false
          })
          return
        }
        if (now < start) {
          const startStr = this.formatDateTime(new Date(start))
          wx.showModal({
            title: '评审未开始',
            content: `评审将于 ${startStr} 开始。${cfg.note || ''}`.trim(),
            showCancel: false
          })
          return
        }
        if (now > end) {
          const endStr = this.formatDateTime(new Date(end))
          wx.showModal({
            title: '评审已结束',
            content: `评审已于 ${endStr} 结束。${cfg.note || ''}`.trim(),
            showCancel: false
          })
          return
        }
        wx.navigateTo({ url: '/pages/expert-login/index' })
      },
      fail: err => {
        wx.hideLoading()
        console.error('获取评审配置失败', err)
        wx.showToast({ title: '网络异常', icon: 'none' })
      }
    })
  },
  
  // 本地时间格式化：YYYY年MM月DD日 HH:mm
  formatDateTime: function(dt) {
    const pad = (n) => n < 10 ? '0' + n : '' + n
    const y = dt.getFullYear()
    const m = pad(dt.getMonth() + 1)
    const d = pad(dt.getDate())
    const hh = pad(dt.getHours())
    const mm = pad(dt.getMinutes())
    return `${y}年${m}月${d}日 ${hh}:${mm}`
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
  },

  // 打开云展网历届作品书橱
  navigateToCatalog: function() {
    if (!this.isFeatureOpen('catalog')) {
      this.showFeatureUnavailable('历届作品暂未开放', '历届作品尚未发布，请稍后查看。');
      return;
    }

    wx.navigateToMiniProgram({
      appId: 'wx9c2d982dec74abe7',
      path: 'pages/bookcase/bookcase?scene=kwdj',
      envVersion: 'release',
      fail: err => {
        console.error('打开云展网历届作品失败:', err);
        if ((err.errMsg || '').includes('cancel')) {
          return;
        }
        wx.showToast({
          title: '无法打开历届作品',
          icon: 'none'
        });
      }
    });
  },

  // 分享给好友
  onShareAppMessage: function() {
    return {
      title: '大陶展专区 - 景德镇艺术职业大学美术馆',
      path: '/pages/pottery-exhibition/index',
      imageUrl: this.data.exhibition.bannerImageUrl || '' // 使用展览横幅图片作为分享图
    }
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '大陶展专区 - 景德镇艺术职业大学美术馆',
      query: '',
      imageUrl: this.data.exhibition.bannerImageUrl || '' // 使用展览横幅图片作为分享图
    }
  }
})
