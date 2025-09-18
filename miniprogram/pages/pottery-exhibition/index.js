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
  },
  
  onLoad: function() {
    // 页面加载时调用云函数获取展览信息
    this.fetchExhibitionInfo();
  },
  
  
  // 导航到参展提交页面
  navigateToSubmission: function() {
    // 先检查用户是否已经报名
    this.checkSubmissionStatus();
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
        const parseTimeToMs = (timeStr) => {
          if (!timeStr) return NaN
          const date = new Date(timeStr)
          return date.getTime()
        }
        
        const now = Date.now()
        const start = parseTimeToMs(cfg.deliveryBeginTime)
        const end = parseTimeToMs(cfg.deliveryEndTime)
        
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

  // 导航到专家评选页面
  navigateToExpertEvaluation: function() {
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
        // 前端严格按 YYYYMMDD 数字解析为本地时间（00:00 与 23:59）
        const parseYmdToMs = (n, isEnd) => {
          if (n == null) return NaN
          // 兼容数字/字符串，去除非数字字符与空白
          const s = String(n).replace(/[^\d]/g, '').slice(0, 8)
          if (s.length !== 8) return NaN
          const y = parseInt(s.slice(0,4), 10)
          const m = parseInt(s.slice(4,6), 10) - 1
          const d = parseInt(s.slice(6,8), 10)
          const dt = new Date(y, m, d)
          if (isEnd) {
            dt.setHours(23,59,59,999)
          } else {
            dt.setHours(0,0,0,0)
          }
          return dt.getTime()
        }
        const now = Date.now()
        const start = parseYmdToMs(cfg.startTime, false)
        const end = parseYmdToMs(cfg.endTime, true)
        console.log('[evaluation_settings] raw:', cfg, 'parsed:', { start, end, now })
        if (isNaN(start) || isNaN(end)) {
          wx.showModal({
            title: '配置有误',
            content: `评审时间格式需为8位数字 YYYYMMDD。当前: startTime=${cfg.startTime}, endTime=${cfg.endTime}`,
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
  }
}) 