// pages/pottery-exhibition/index.js
const app = getApp();
const { buildBannerImage } = require('../../utils/banner-image');

Page({
  data: {
    exhibition: {
      title: '',
      description: '',
      bannerImageUrl: ''
    },
    schedules: [],
    banner: { imageUrl: '', originalImageUrl: '', imageLoaded: false, imageFailed: false },
    loading: true,
    contentReady: false,
    loadError: '',
    currentEdition: null
  },
  
  onLoad: function() {
    this._unloaded = false;
    return this.loadPageData();
  },

  onUnload: function() {
    this._unloaded = true;
  },

  loadPageData: function() {
    // 展览内容和入口配置必须一起就绪；同一轮加载只发起一组请求。
    if (this._loadRequest) return this._loadRequest;
    this.setData({ loading: true, loadError: '', contentReady: false });
    const request = Promise.all([this.fetchExhibitionInfo(), this.loadEditionInfo()])
      .then(([content, edition]) => {
        if (this._unloaded) return;
        this.setData({
          exhibition: content.exhibition,
          schedules: Array.isArray(content.schedules) ? content.schedules : [],
          banner: buildBannerImage(content.exhibition.bannerImageUrl),
          currentEdition: edition,
          contentReady: true,
          loading: false
        });
      }).catch(error => {
        if (this._unloaded) return;
        console.warn('加载大陶展信息失败:', error);
        this.setData({ loading: false, contentReady: false, loadError: '展览信息暂时无法加载，请重试。' });
      }).then(() => {
        if (this._loadRequest === request) this._loadRequest = null;
      });
    this._loadRequest = request;
    return request;
  },

  retryLoad: function() {
    return this.loadPageData();
  },

  loadEditionInfo: function() {
    return Promise.resolve().then(() => {
      if (typeof app.loadCurrentEdition !== 'function') throw new Error('当前届次配置服务不可用');
      return app.loadCurrentEdition();
    }).then(edition => {
      if (!edition || !edition.editionId) throw new Error('未返回有效届次配置');
      return edition;
    });
  },

  onBannerLoad: function(e) {
    if (this._unloaded || e.currentTarget.dataset.url !== this.data.banner.imageUrl) return;
    this.setData({ 'banner.imageLoaded': true, 'banner.imageFailed': false });
  },

  onBannerError: function(e) {
    const banner = this.data.banner;
    if (this._unloaded || e.currentTarget.dataset.url !== banner.imageUrl) return;
    if (banner.originalImageUrl && banner.imageUrl !== banner.originalImageUrl) {
      // 展示图失败只回退原图一次，原图失败后显示稳定占位。
      this.setData({ 'banner.imageUrl': banner.originalImageUrl, 'banner.imageLoaded': false, 'banner.imageFailed': false });
    } else {
      this.setData({ 'banner.imageFailed': true, 'banner.imageLoaded': false });
    }
  },

  isFeatureOpen: function(feature) {
    if (!this.data.contentReady || !this.data.currentEdition) return false;
    const flags = (this.data.currentEdition && this.data.currentEdition.featureFlags) || {};
    return flags[feature] !== false;
  },

  showFeatureUnavailable: function(title, reason) {
    wx.showModal({
      title: title || '入口暂未开放',
      content: reason || `${(this.data.currentEdition && this.data.currentEdition.title) || '当前届次'}该功能暂未开放，请以后台配置时间为准。`,
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
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'fetchPotteryExhibition' },
        success: res => {
          const result = res && res.result;
          const content = result && result.data;
          if (!result || !result.success || !content || !content.exhibition
            || typeof content.exhibition.title !== 'string' || !content.exhibition.title.trim()) {
            reject(new Error('未返回有效展览信息'));
            return;
          }
          resolve(content);
        },
        fail: reject
      });
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
