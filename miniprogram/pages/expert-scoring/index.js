// pages/expert-scoring/index.js
const app = getApp()

Page({
  data: {
    submissionId: '', // 作品ID
    submission: null, // 作品信息
    expertInfo: null, // 专家信息
    scores: {
      themeFit: 3, // 主题契合度 (0-3分) - 默认满分
      creativity: 3, // 创意与表现力 (0-3分) - 默认满分
      craftsmanship: 2, // 工艺与材料 (0-2分) - 默认满分
      aesthetics: 2 // 美感与实用性 (0-2分) - 默认满分
    },
    // 取消资格项（与打分分离）
    disqualify: false, // 是否取消资格（内容违规/侵权抄袭）
    // 扣分项（只扣分，不取消资格）
    deductions: {
      aiNotLabeled: false, // AI生成作品未标注技术来源 扣2分
      missingCreativeStatement: false // 未提供创作说明或技术应用报告 扣1分
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
    
    // 获取专家信息
    const expertInfo = wx.getStorageSync('expertInfo');
    if (!expertInfo || !expertInfo.expertId) {
      this.setData({ loading: false });
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.redirectTo({
        url: '/pages/expert-login/index'
      });
      return;
    }
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchSubmissionDetail',
        submissionId: this.data.submissionId,
        expertId: expertInfo.expertId,
        expertCode: expertInfo.expertCode  // 添加 expertCode，用于判断评委类型
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          const submission = res.result.data;
          
          // 调试：输出尺寸数据
          console.log('前端接收到的尺寸数据:', {
            dimensions: submission.dimensions,
            allDimensions: submission.allDimensions,
            dimensionsType: typeof submission.dimensions,
            allDimensionsType: typeof submission.allDimensions,
            allDimensionsLength: submission.allDimensions ? submission.allDimensions.length : 'undefined'
          });
          
          // 调试：输出第一组尺寸的详细信息
          if (submission.dimensions) {
            console.log('第一组尺寸详情:', {
              length: submission.dimensions.length,
              width: submission.dimensions.width,
              height: submission.dimensions.height
            });
          }
          
          // 调试：输出所有尺寸组
          if (submission.allDimensions && Array.isArray(submission.allDimensions)) {
            console.log('所有尺寸组详情:', submission.allDimensions);
            submission.allDimensions.forEach((dim, index) => {
              console.log(`第${index + 1}组尺寸:`, {
                length: dim.length,
                width: dim.width,
                height: dim.height
              });
            });
            
            // 特别输出第一组尺寸，用于前端显示
            if (submission.allDimensions[0]) {
              console.log('前端将显示的第一组尺寸:', {
                length: submission.allDimensions[0].length,
                width: submission.allDimensions[0].width,
                height: submission.allDimensions[0].height
              });
            }
          }
          
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

  // 评分变化（输入方式，保留作为备用）
  onScoreChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = parseFloat(e.detail.value) || 0;
    
    this.setData({
      [`scores.${field}`]: value
    });
    
    // 计算总分
    this.calculateTotalScore();
  },

  // 评分选择（点击方式）
  onScoreSelect: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = parseFloat(e.currentTarget.dataset.value);
    
    this.setData({
      [`scores.${field}`]: value
    });
    
    // 计算总分
    this.calculateTotalScore();
  },

  // 取消资格项切换
  onDisqualifyChange: function(e) {
    console.log('===== onDisqualifyChange 被触发 =====');
    console.log('e.detail.value:', e.detail.value);
    
    const values = e.detail.value;
    const checked = values.includes('disqualify');
    
    console.log('取消资格勾选变化:', { values, checked });
    
    if (checked) {
      console.log('检测到勾选，准备弹出确认弹窗');
      const that = this;
      
      // 勾选取消资格，立即弹出确认弹窗
      wx.showModal({
        title: '⚠️ 取消资格确认',
        content: '您确认该作品存在以下问题吗？\n\n• 涉及国家象征/宗教敏感/负面舆论等内容\n• 侵犯他人知识产权或抄袭\n\n确认后该作品将被直接取消参赛资格，其他评委也将无法看到该作品。此操作不可撤销！',
        confirmText: '确认',
        confirmColor: '#e74c3c',
        cancelText: '取消',
        success: function(res) {
          console.log('弹窗回调触发，用户选择:', res);
          if (res.confirm) {
            console.log('用户确认取消资格');
            // 确认取消资格
            that.setData({ disqualify: true });
            // 立即提交取消资格（不需要再点提交按钮）
            that.submitScoreWithDisqualification();
          } else {
            console.log('用户取消操作');
            // 取消操作，不勾选
            that.setData({ disqualify: false });
          }
        }
      });
    } else {
      console.log('检测到取消勾选');
      this.setData({ disqualify: false });
    }
  },

  // 扣分项切换
  onDeductionGroupChange: function(e) {
    const values = e.detail.value;
    const deductions = {
      aiNotLabeled: values.includes('aiNotLabeled'),
      missingCreativeStatement: values.includes('missingCreativeStatement')
    };
    
    this.setData({ deductions });
    this.calculateTotalScore();
  },

  // 计算总分
  calculateTotalScore: function() {
    const { themeFit, creativity, craftsmanship, aesthetics } = this.data.scores;
    const totalScore = themeFit + creativity + craftsmanship + aesthetics;
    const { aiNotLabeled, missingCreativeStatement } = this.data.deductions;
    
    // 计算扣分
    let deductionPoints = 0;
    if (aiNotLabeled) deductionPoints += 2;
    if (missingCreativeStatement) deductionPoints += 1;
    
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

  // 图片加载成功
  onImageLoad: function(e) {
    console.log('图片加载成功:', e.currentTarget.dataset.url);
  },

  // 图片加载失败
  onImageError: function(e) {
    console.error('图片加载失败:', e.currentTarget.dataset.url);
    wx.showToast({
      title: '图片加载失败',
      icon: 'none'
    });
  },

  // 图片预览
  previewImage: function(e) {
    const currentUrl = e.currentTarget.dataset.url;
    if (!currentUrl) {
      console.log('图片URL为空');
      return;
    }

    // 防抖处理，避免快速连续点击
    const now = Date.now();
    if (this.lastPreviewTime && (now - this.lastPreviewTime) < 1000) {
      console.log('点击过于频繁，请稍后再试');
      return;
    }
    this.lastPreviewTime = now;

    // 每次重新收集图片URL，确保数据新鲜
    const submission = this.data.submission;
    if (!submission) {
      wx.showToast({
        title: '作品数据未加载',
        icon: 'none'
      });
      return;
    }

    // 收集所有图片URL用于预览
    let urls = [];
    
    // 添加透视图
    if (submission.perspectiveImage && submission.perspectiveImage.trim()) {
      urls.push(submission.perspectiveImage.trim());
    }
    
    // 添加四面图
    if (submission.fourViewImages && Array.isArray(submission.fourViewImages)) {
      submission.fourViewImages.forEach(img => {
        if (img && img.trim()) {
          urls.push(img.trim());
        }
      });
    }
    
    // 添加局部图
    if (submission.detailImages && Array.isArray(submission.detailImages)) {
      submission.detailImages.forEach(img => {
        if (img && img.trim()) {
          urls.push(img.trim());
        }
      });
    }
    
    // 去重并过滤空值，确保URL是完整的
    urls = [...new Set(urls)].filter(url => {
      if (!url || !url.trim()) return false;
      // 确保URL是完整的，包含协议
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false; // 过滤掉不完整的URL
      }
      return true;
    });

    if (urls.length === 0) {
      wx.showToast({
        title: '暂无有效图片',
        icon: 'none'
      });
      return;
    }

    // 确保当前URL在预览列表中
    if (!urls.includes(currentUrl)) {
      wx.showToast({
        title: '图片链接无效',
        icon: 'none'
      });
      return;
    }
    
    console.log('图片预览URLs:', urls);
    console.log('当前图片URL:', currentUrl);
    
    // 直接调用预览，不使用复杂的状态管理
    wx.previewImage({
      current: currentUrl,
      urls: urls,
      showmenu: true,
      enableShowPhotoDownload: true,
      fail: (err) => {
        console.error('图片预览失败:', err);
        wx.showToast({
          title: '图片预览失败',
          icon: 'none'
        });
      }
    });
  },

  // 提交评分
  submitScore: function() {
    const { scores, totalScore, finalScore, deductions, disqualify } = this.data;
    
    // 如果已经勾选取消资格，提示不需要重复提交
    if (disqualify) {
      wx.showToast({
        title: '该作品已取消资格',
        icon: 'none'
      });
      return;
    }
    
    // 显示提交确认弹窗
    this.showSubmitConfirmModal();
  },

  // 显示提交确认弹窗
  showSubmitConfirmModal: function() {
    wx.showModal({
      title: '确认提交评分',
      content: '提交后将无法再修改分数，确定要提交吗？',
      confirmText: '继续提交',
      cancelText: '返回修改',
      success: (res) => {
        if (res.confirm) {
          this.doSubmitScore();
        }
      }
    });
  },

  // 提交评分并取消资格（不需要评分，直接取消资格）
  submitScoreWithDisqualification: function() {
    this.setData({ submitting: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'submitExpertScore',
        submissionId: this.data.submissionId,
        scores: { themeFit: 0, creativity: 0, craftsmanship: 0, aesthetics: 0 }, // 取消资格不记分
        totalScore: 0,
        finalScore: 0,
        deductions: {}, // 取消资格不记录扣分项
        expertId: this.data.expertInfo.expertId,
        expertCode: this.data.expertInfo.expertCode,
        expertName: this.data.expertInfo.expertName,
        disqualify: true, // 标记为取消资格
        disqualifyReason: '内容违规或侵权抄袭' // 取消资格原因
      },
      success: res => {
        this.setData({ submitting: false });
        
        if (res.result && res.result.success) {
          wx.showModal({
            title: '✅ 取消资格成功',
            content: '该作品已被取消参赛资格，其他评委将无法看到该作品。',
            showCancel: false,
            confirmText: '返回',
            success: () => {
              // 返回到专家评选页面
              wx.navigateBack();
            }
          });
        } else {
          wx.showToast({
            title: res.result ? (res.result.message || '操作失败') : '操作失败',
            icon: 'none'
          });
          // 操作失败，取消勾选状态
          this.setData({ disqualify: false });
        }
      },
      fail: err => {
        this.setData({ submitting: false });
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
        // 操作失败，取消勾选状态
        this.setData({ disqualify: false });
      }
    });
  },

  // 执行提交评分
  doSubmitScore: function() {
    this.setData({ submitting: true });
    
    // 调试：输出提交的参数
    console.log('=== 提交评分调试信息 ===');
    console.log('作品ID (submissionId):', this.data.submissionId);
    console.log('评分数据 (scores):', this.data.scores);
    console.log('总分 (totalScore):', this.data.totalScore);
    console.log('最终分数 (finalScore):', this.data.finalScore);
    console.log('扣分项 (deductions):', this.data.deductions);
    console.log('专家ID (expertId):', this.data.expertInfo.expertId);
    console.log('专家Code (expertCode):', this.data.expertInfo.expertCode);
    console.log('专家姓名 (expertName):', this.data.expertInfo.expertName);
    console.log('========================');
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'submitExpertScore',
        submissionId: this.data.submissionId,
        scores: this.data.scores,
        totalScore: this.data.totalScore,
        finalScore: this.data.finalScore,
        deductions: this.data.deductions,
        expertId: this.data.expertInfo.expertId,
        expertCode: this.data.expertInfo.expertCode,
        expertName: this.data.expertInfo.expertName,
        disqualify: false // 正常评分不取消资格
      },
      success: res => {
        this.setData({ submitting: false });
        
        // 调试：输出云函数返回的完整数据
        console.log('=== 云函数返回数据 ===');
        console.log('完整返回结果:', res);
        console.log('返回结果类型:', typeof res);
        console.log('result字段:', res.result);
        console.log('result类型:', typeof res.result);
        if (res.result) {
          console.log('success字段:', res.result.success);
          console.log('message字段:', res.result.message);
          console.log('errMsg字段:', res.result.errMsg);
        }
        console.log('====================');
        
        if (res.result && res.result.success) {
          console.log('✅ 评分提交成功');
          wx.showToast({
            title: '评分提交成功',
            icon: 'success'
          });
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          console.log('❌ 评分提交失败');
          console.log('失败原因:', res.result ? res.result.message || res.result.errMsg : '未知错误');
          wx.showToast({
            title: res.result ? (res.result.message || res.result.errMsg || '提交失败') : '提交失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ submitting: false });
        
        // 调试：输出失败信息
        console.log('=== 云函数调用失败 ===');
        console.log('错误对象:', err);
        console.log('错误类型:', typeof err);
        console.log('错误信息:', err.errMsg || err.message || '未知错误');
        console.log('错误代码:', err.errCode || '无代码');
        console.log('====================');
        
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  }
})