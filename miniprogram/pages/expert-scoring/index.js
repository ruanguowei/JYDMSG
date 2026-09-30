// pages/expert-scoring/index.js
const app = getApp()
const { calculateTotalRubric, TOTAL_RUBRIC_VERSION } = require('../../utils/evaluation-rubric')
const reviewPrefetch = require('../../utils/review-prefetch')

Page({
  data: {
    category: '',
    submissionId: '', // 作品ID
    submission: null, // 作品信息
    expertInfo: null, // 专家信息
    baseScore: 0,
    scoreTenths: 0,
    baseScoreText: '0.0',
    finalScoreText: '0.0',
    scoreTouched: false,
    draftSaved: false,

    // 取消资格项（与打分分离）
    disqualify: false, // 是否取消资格（内容违规/侵权抄袭）
    // 扣分项（只扣分，不取消资格）
    deductions: {
      aiNotLabeled: false, // AI生成作品未标注技术来源 扣2分
      missingCreativeStatement: false // 未提供创作说明或技术应用报告 扣1分
    },
    totalScore: 0, // 总分（扣分前）
    finalScore: 0, // 扣分后
    dimensionRows: [],
    mediaItems: [],
    activeMediaIndex: 0,
    activeMediaUrl: '',
    activeMediaLabel: '',
    videoWatchPercent: 0,
    loading: true,
    submitting: false,
    verificationPending: false,
    lowMemory: false,
    showScoreGuide: false // 是否显示评分指南
  },

  onLoad: function(options) {
    this._isPageActive = true;
    this._isPageVisible = true;
    const submissionId = options.submissionId;
    if (!submissionId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }

    this.setData({ submissionId, category: options.category || '' });
    if (!this.checkLoginStatus()) return;
    this._memoryWarningHandler = () => {
      this._prefetchDisabled = true;
      clearTimeout(this._prefetchTimer);
      this._prefetchTimer = null;
      reviewPrefetch.clear();
      if (this._isPageActive) this.setData({ lowMemory: true });
      this.releasePrefetchedThumbnail();
    };
    if (wx.onMemoryWarning && wx.offMemoryWarning) wx.onMemoryWarning(this._memoryWarningHandler);
    const cached = reviewPrefetch.take(this.detailParams(this.data.submissionId));
    if (cached) {
      this._prefetchedThumbnailPath = cached.thumbnailPath;
      this._prefetchedThumbnailOriginal = cached.thumbnailOriginal;
      this.applySubmission(cached.detail);
    }
    // 缓存先展示；重新核验资格成功后才允许提交，缓存不放宽服务端规则。
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
      return false;
    }
    
    this.setData({
      expertInfo: expertInfo
    });
    return true;
  },

  // 获取作品详情
  fetchSubmissionDetail: function(retryCount = 0) {
    if (!this._isPageActive || this._detailRequestPending) {
      return;
    }

    this._detailRequestPending = true;
    this.setData({ loading: !this.data.submission, verificationPending: true });
    
    // 获取专家信息
    const expertInfo = wx.getStorageSync('expertInfo');
    if (!expertInfo || !expertInfo.expertId) {
      this._detailRequestPending = false;
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
    
    const that = this;
    
    wx.cloud.callFunction({
      name: 'fetchSubmissionDetail',
      data: {
        submissionId: this.data.submissionId,
        category: this.data.category,
        expertId: expertInfo.expertId,
        expertCode: expertInfo.expertCode,  // 添加 expertCode，用于判断评委类型
        editionId: expertInfo.editionId || (app.globalData.currentEdition && app.globalData.currentEdition.editionId) || 'pottery-2026'
      },
      timeout: 30000,  // 超时时间设置为30秒
      success: res => {
        this._detailRequestPending = false;
        if (!this._isPageActive) {
          return;
        }
        that.setData({ loading: false });
        
        if (res.result && res.result.success) {
          this.applySubmission(res.result.data);
          this.setData({ verificationPending: false });
          this.scheduleNextPrefetch();
        } else {
          if (res.result && res.result.code === 'ORIENTATION_REQUIRED') { wx.redirectTo({ url: '/pages/expert-orientation/index' }); return; }
          console.error('获取作品详情失败', res.result && res.result.message);
          wx.showToast({
            title: '获取作品失败',
            icon: 'none'
          });
          wx.navigateBack();
        }
      },
      fail: err => {
        this._detailRequestPending = false;
        if (!this._isPageActive) {
          return;
        }
        console.error('=== 获取作品详情失败 ===');
        console.error('错误信息:', err.errMsg || err.message);
        console.error('重试次数:', retryCount);
        
        // 重试机制（最多重试3次）
        if (retryCount < 3) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // 1秒、2秒、4秒
          
          
          wx.showToast({
            title: `网络繁忙，${retryDelay / 1000}秒后重试...`,
            icon: 'loading',
            duration: retryDelay
          });
          
          clearTimeout(this._detailRetryTimer);
          this._detailRetryTimer = setTimeout(() => {
            this._detailRetryTimer = null;
            if (!this._isPageActive) {
              return;
            }
            that.fetchSubmissionDetail(retryCount + 1);
          }, retryDelay);
          
        } else {
          // 重试3次后仍失败，降级处理
          that.setData({ loading: false });
          
          console.error('❌ 重试3次后仍失败');
          
          wx.showModal({
            title: '加载失败',
            content: '作品详情加载失败。\n\n请返回列表重新尝试。',
            confirmText: '手动重试',
            confirmColor: '#667eea',
            cancelText: '返回列表',
            success: (res) => {
              if (!this._isPageActive) return;
              if (res.confirm) {
                // 手动重试
                that.fetchSubmissionDetail(0);
              } else {
                // 返回列表
                wx.navigateBack();
              }
            }
          });
        }
      }
    });
  },

  detailParams: function(submissionId) {
    const expert = this.data.expertInfo || {};
    return { submissionId, category: this.data.category, expertId: expert.expertId,
      expertCode: expert.expertCode, expertType: expert.expertType,
      editionId: expert.editionId || (app.globalData.currentEdition || {}).editionId || 'pottery-2026' };
  },

  applySubmission: function(submission, preserveScores = false) {
    const patch = { submission, loading: false, dimensionRows: this.formatDimensionRows(submission) };
    if (!preserveScores) {
      patch.deductions = submission.existingDeductions || this.data.deductions;
      const existing = submission.existingBaseScore;
      patch.baseScore = typeof existing === 'number' ? existing : 0;
      patch.scoreTouched = typeof existing === 'number';
      patch.deductions = submission.existingDeductions || { aiNotLabeled: false, missingCreativeStatement: false };
    }
    this.setData(patch);
    this.prepareMediaItems(submission);
    wx.setNavigationBarTitle({ title: submission.workType === 'video' ? '视频评审' : '作品评审' });
    if (!preserveScores) this.restoreDraft(submission);
    this.calculateTotalScore();
  },

  scheduleNextPrefetch: function() {
    clearTimeout(this._prefetchTimer);
    if (!this._isPageActive || !this._isPageVisible || this._prefetchDisabled || this.data.verificationPending) return;
    this._prefetchTimer = setTimeout(() => {
      this._prefetchTimer = null;
      if (!this._isPageActive || !this._isPageVisible || this.data.submitting) return;
      const pages = getCurrentPages();
      const listPage = pages[pages.length - 2];
      if (!listPage || listPage.route !== 'pages/expert-evaluation/index') return;
      const rows = listPage.data.submissions || [];
      const index = rows.findIndex(item => item.id === this.data.submissionId);
      const next = index >= 0 && rows[index + 1];
      if (next && next.category === this.data.category) reviewPrefetch.prefetch(this.detailParams(next.id));
    }, 500);
  },

  releasePrefetchedThumbnail: function() {
    const filePath = this._prefetchedThumbnailPath;
    this._prefetchedThumbnailPath = '';
    this._prefetchedThumbnailOriginal = '';
    if (!filePath) return;
    if (this._isPageActive) {
      const patch = {};
      this.data.mediaItems.forEach((item, index) => {
        if (item.thumbnailUrl === filePath) patch[`mediaItems[${index}].thumbnailUrl`] = item.remoteThumbnailUrl || this.thumbnailUrl(item.url, 640);
      });
      if (Object.keys(patch).length) this.setData(patch);
    }
    reviewPrefetch.releaseFile(filePath);
  },

  onScoreSliderChange: function(e) {
    if (!this._isPageActive || this.data.submitting || this.data.verificationPending) return;
    const tenths = Math.max(0, Math.min(100, Math.round(Number(e.detail.value))));
    if (!Number.isFinite(tenths)) return;
    if (this.data.scoreTouched && this.data.scoreTenths === tenths) return;
    this.setData({ baseScore: tenths / 10, scoreTouched: true, draftSaved: false });
    this.calculateTotalScore();
  },

  adjustBaseScore: function(e) {
    this.onScoreSliderChange({ detail: { value: this.data.scoreTenths + Number(e.currentTarget.dataset.delta) } });
  },

  formatDimensionRows: function(submission) {
    const raw = submission.allDimensions && submission.allDimensions.length
      ? submission.allDimensions : submission.dimensions;
    return (Array.isArray(raw) ? raw : [raw]).map(dim => {
      if (!dim) return '';
      if (typeof dim === 'string') return dim;
      return [['length', '长'], ['width', '宽'], ['height', '高']]
        .filter(([key]) => dim[key] !== undefined && dim[key] !== null && dim[key] !== '')
        .map(([key, label]) => label + ' ' + dim[key] + ' cm').join(' × ');
    }).filter(Boolean);
  },

  thumbnailUrl: function(url, size) {
    return reviewPrefetch.thumbnailUrl(url, size);
  },

  prepareMediaItems: function(submission) {
    const mediaItems = [];
    const submissionId = submission.id || submission._id || this.data.submissionId;
    const previousMedia = submissionId && this._mediaSubmissionId === submissionId
      ? this.data.mediaItems[this.data.activeMediaIndex] : null;
    const mediaKey = slot => `${submissionId || 'work'}:${slot}`;

    if (submission.workType === 'video') {
      const video = submission.video || {};
      const videoUrl = video.tempUrl || video.fileId || submission.videoUrl || '';
      mediaItems.push({
        key: mediaKey('video'),
        type: 'video',
        url: videoUrl,
        label: '作品展示视频'
      });
    } else {
      if (submission.perspectiveImage) {
        mediaItems.push({ key: mediaKey('perspective'), type: 'image', url: submission.perspectiveImage, label: '整体' });
      }
      (submission.fourViewImages || []).forEach((url, index) => {
        const labels = ['正面', '右侧', '背面', '左侧'];
        if (url) mediaItems.push({ key: mediaKey(`fourView-${index}`), type: 'image', url, label: labels[index] || `视图${index + 1}` });
      });
      (submission.detailImages || []).forEach((url, index) => {
        const labels = ['左侧', '顶/底', '细节'];
        if (url) mediaItems.push({ key: mediaKey(`detail-${index}`), type: 'image', url, label: labels[index] || `细节${index + 1}` });
      });
    }

    if (submission.workType !== 'video' && !mediaItems.length) {
      (submission.images || []).forEach((url, index) => {
        if (url) mediaItems.push({ key: mediaKey(`legacy-${index}`), type: 'image', url, label: '视图' + (index + 1) });
      });
    }
    mediaItems.forEach(item => {
      if (item.type !== 'image') return;
      item.thumbnailUrl = item.url === this._prefetchedThumbnailOriginal && this._prefetchedThumbnailPath
        ? this._prefetchedThumbnailPath : this.thumbnailUrl(item.url, 640);
      item.smallThumbnailUrl = this.thumbnailUrl(item.url, 160);
      item.thumbnailError = false;
    });
    // 同一作品更新地址时保留视图；字段缺失或进入新作品才回到首图。
    const retainedIndex = previousMedia && previousMedia.type === 'image'
      ? mediaItems.findIndex(item => item.key === previousMedia.key) : -1;
    const activeMediaIndex = retainedIndex >= 0 ? retainedIndex : 0;
    const active = mediaItems[activeMediaIndex] || { url: '', label: '' };
    const patch = {
      mediaItems,
      activeMediaUrl: active.url,
      activeMediaLabel: active.label
    };
    if (activeMediaIndex !== this.data.activeMediaIndex) patch.activeMediaIndex = activeMediaIndex;
    this._mediaSubmissionId = submissionId;
    this.setData(patch);
    const mediaGeneration = this._mediaGeneration = (this._mediaGeneration || 0) + 1;
    const cloudIds = mediaItems.filter(item => item.type === 'image' && item.url.startsWith('cloud://')).map(item => item.url);
    if (cloudIds.length) {
      wx.cloud.getTempFileURL({
        fileList: [...new Set(cloudIds)],
        success: res => {
          if (!this._isPageActive || !this.data.submission || this._mediaSubmissionId !== submissionId || this._mediaGeneration !== mediaGeneration) return;
          const files = res.fileList || [];
          const patches = {};
          this.data.mediaItems.forEach((item, index) => {
            const file = files.find(file => file.fileID === item.url && file.tempFileURL);
            if (!file) return;
            patches[`mediaItems[${index}].thumbnailUrl`] = item.url === this._prefetchedThumbnailOriginal && this._prefetchedThumbnailPath
              ? this._prefetchedThumbnailPath : this.thumbnailUrl(file.tempFileURL, 640);
            patches[`mediaItems[${index}].smallThumbnailUrl`] = this.thumbnailUrl(file.tempFileURL, 160);
            patches[`mediaItems[${index}].remoteThumbnailUrl`] = this.thumbnailUrl(file.tempFileURL, 640);
          });
          if (Object.keys(patches).length) this.setData(patches);
        },
        fail: () => { /* 保留点击查看原图入口，不自动下载原图。 */ }
      });
    }
  },

  onMediaThumbTap: function(e) {
    const rawIndex = e.currentTarget.dataset.index;
    if (rawIndex === undefined || rawIndex === null || rawIndex === '') return;
    this.selectMediaIndex(Number(rawIndex));
  },

  selectMediaIndex: function(index) {
    if (!this._isPageActive || !Number.isInteger(index) || index < 0 || index === this.data.activeMediaIndex) return;
    const media = this.data.mediaItems[index];
    if (!media) return;

    this.setData({
      activeMediaIndex: index,
      activeMediaUrl: media.url,
      activeMediaLabel: media.label
    });
  },

  onMediaSwipe: function(e) {
    // current 的程序更新也会触发 change，不能把这些通知再次写回 swiper。
    if (!e.detail || e.detail.source !== 'touch') return;
    this.selectMediaIndex(e.detail.current);
  },

  onThumbnailError: function(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!this._isPageActive) return;
    if (this.data.mediaItems[index]) this.setData({ [`mediaItems[${index}].thumbnailError`]: true });
  },

  onVideoTimeUpdate: function(e) {
    const duration = e.detail.duration || 0;
    const currentTime = e.detail.currentTime || 0;
    if (!this._isPageActive || !duration) return;
    if (Math.min(100, Math.round((currentTime / duration) * 100)) === this.data.videoWatchPercent) return;
    this.setData({
      videoWatchPercent: Math.min(100, Math.round((currentTime / duration) * 100))
    });
  },

  goPreviousWork: function() {
    if (this.data.submitting) return;
    wx.navigateBack();
  },

  draftKey: function() {
    const expert = this.data.expertInfo || {};
    const edition = expert.editionId || (app.globalData.currentEdition || {}).editionId || 'pottery-2026';
    return `expertScoreDraftV3:${edition}:${expert.expertType || ''}:${expert.expertId}:${this.data.submissionId}`;
  },

  restoreDraft: function(submission) {
    if (typeof submission.existingBaseScore === 'number') return;
    try {
      const draft = wx.getStorageSync(this.draftKey());
      if (!draft || draft.rubricVersion !== TOTAL_RUBRIC_VERSION || !calculateTotalRubric(draft.baseScore).ok) return;
      this.setData({ baseScore: draft.baseScore, scoreTouched: draft.scoreTouched === true,
        deductions: draft.deductions || {}, draftSaved: true });
    } catch (_) { /* 无可用草稿时保留未评分状态。 */ }
  },

  clearDraft: function() {
    try { wx.removeStorageSync(this.draftKey()); } catch (_) { /* 提交成功仍正常继续。 */ }
  },

  saveDraft: function() {
    if (this.data.submitting) return;
    try {
    wx.setStorageSync(this.draftKey(), {
      baseScore: this.data.baseScore,
      scoreTouched: this.data.scoreTouched,
      rubricVersion: TOTAL_RUBRIC_VERSION,
      deductions: this.data.deductions,
      totalScore: this.data.totalScore,
      finalScore: this.data.finalScore,
      savedAt: Date.now()
    });
    this.setData({ draftSaved: true });
    wx.showToast({
      title: '已暂存',
      icon: 'success'
    });
    } catch (_) {
      wx.showToast({ title: '暂存失败，请重试', icon: 'none' });
    }
  },

  // 取消资格项切换
  onDisqualifyChange: function(e) {
    if (!this._isPageActive || this.data.submitting || this.data.verificationPending) return;
    
    
    
    const values = e.detail.value;
    const checked = values.includes('disqualify');
    
    
    
    if (checked) {
      
      const that = this;
      
      // 勾选取消资格，立即弹出确认弹窗
      wx.showModal({
        title: '⚠️ 取消资格确认',
        content: '您确认该作品存在以下问题吗？\n\n• 涉及国家象征/宗教敏感/负面舆论等内容\n• 侵犯他人知识产权或抄袭\n\n确认后该作品将被直接取消参赛资格，其他评委也将无法看到该作品。此操作不可撤销！',
        confirmText: '确认',
        confirmColor: '#e74c3c',
        cancelText: '取消',
        success: function(res) {
          if (!that._isPageActive) return;
          
          if (res.confirm) {
            
            // 确认取消资格
            that.setData({ disqualify: true });
            // 立即提交取消资格（不需要再点提交按钮）
            that.submitScoreWithDisqualification();
          } else {
            
            // 取消操作，不勾选
            that.setData({ disqualify: false });
          }
        }
      });
    } else {
      
      this.setData({ disqualify: false });
    }
  },

  // 扣分项切换
  onDeductionGroupChange: function(e) {
    if (!this._isPageActive || this.data.submitting || this.data.verificationPending) return;
    const values = e.detail.value;
    const deductions = {
      aiNotLabeled: values.includes('aiNotLabeled'),
      missingCreativeStatement: values.includes('missingCreativeStatement')
    };
    
    this.setData({ deductions, draftSaved: false });
    this.calculateTotalScore();
  },

  // 计算总分
  calculateTotalScore: function() {
    const result = calculateTotalRubric(this.data.baseScore, this.data.deductions);
    this.setData({ totalScore: result.rawTotalScore, finalScore: result.finalScore,
      scoreTenths: Math.round(result.rawTotalScore * 10), baseScoreText: result.rawTotalScore.toFixed(1),
      finalScoreText: result.finalScore.toFixed(1), deductionScore: result.deductionScore });
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

  stopGuideTap: function() {},

  // 图片加载成功
  onImageLoad: function(e) {
    if (!this._isPageActive) return;
    const index = this.data.mediaItems.findIndex(item => item.url === e.currentTarget.dataset.url);
    if (index >= 0) this.setData({ [`mediaItems[${index}].viewed`]: true });
    
  },

  // 图片加载失败
  onImageError: function(e) {
    if (!this._isPageActive) return;
    console.error('图片加载失败:', e.currentTarget.dataset.url);
    wx.showToast({
      title: '图片加载失败',
      icon: 'none'
    });
  },

  // 仅用户点击时打开原图；页面中的 image 始终使用缩略图地址。
  previewImage: async function(e) {
    const currentUrl = e.currentTarget.dataset.url;
    if (!this._isPageActive || !currentUrl || this._previewPending) return;
    this._previewPending = true;
    try {
      const originals = [...new Set(this.data.mediaItems.filter(item => item.type === 'image').map(item => item.url))];
      const cloudIds = originals.filter(url => url.startsWith('cloud://'));
      const response = cloudIds.length ? await wx.cloud.getTempFileURL({ fileList: cloudIds }) : { fileList: [] };
      if (!this._isPageActive) return;
      const resolve = url => {
        const file = (response.fileList || []).find(item => item.fileID === url);
        return file && file.tempFileURL ? file.tempFileURL : url;
      };
      const urls = originals.map(resolve).filter(url => /^https?:\/\//.test(url));
      const current = resolve(currentUrl);
      if (!urls.includes(current)) throw new Error('原图地址暂不可用');
      await new Promise(resolvePreview => wx.previewImage({ current, urls, showmenu: true,
        success: () => {
          if (!this._isPageActive) return;
          const index = this.data.mediaItems.findIndex(item => item.url === currentUrl);
          if (index >= 0) this.setData({ [`mediaItems[${index}].viewed`]: true });
        },
        fail: () => { if (this._isPageActive) wx.showToast({ title: '图片预览失败，请重试', icon: 'none' }); },
        complete: resolvePreview
      }));
    } catch (_) {
      if (this._isPageActive) wx.showToast({ title: '原图加载失败，请重试', icon: 'none' });
    } finally {
      this._previewPending = false;
    }
  },

  // 提交评分
  submitScore: function() {
    if (this.data.verificationPending || !this._isPageActive) return;
    const { disqualify, submitting } = this.data;
    
    // 防止重复提交
    if (submitting) {
      wx.showToast({
        title: '正在提交中，请稍候',
        icon: 'none'
      });
      return;
    }
    
    // 防止快速连续点击
    const now = Date.now();
    if (this.lastSubmitClickTime && (now - this.lastSubmitClickTime) < 2000) {
      wx.showToast({
        title: '请勿重复点击',
        icon: 'none'
      });
      return;
    }
    this.lastSubmitClickTime = now;
    
    // 如果已经勾选取消资格，提示不需要重复提交
    if (disqualify) {
      wx.showToast({
        title: '该作品已取消资格',
        icon: 'none'
      });
      return;
    }

    if (!this.data.scoreTouched || !calculateTotalRubric(this.data.baseScore).ok) {
      wx.showToast({ title: '请先选择基础分', icon: 'none' });
      return;
    }

    // 显示提交确认弹窗
    this.showSubmitConfirmModal();
  },

  // 显示提交确认弹窗
  showSubmitConfirmModal: function() {
    // 立即设置提交状态，防止弹窗期间重复点击
    this.setData({ submitting: true });
    
    const that = this;
    
    wx.showModal({
      title: '确认提交评分',
      content: '提交后将无法再修改分数，确定要提交吗？',
      confirmText: '继续提交',
      cancelText: '返回修改',
      success: (res) => {
              if (!this._isPageActive) return;
        if (res.confirm) {
          // 用户确认，继续提交
          that.doSubmitScore();
        } else {
          // 用户取消，解除提交状态
          that.setData({ submitting: false });
        }
      },
      fail: () => {
        if (!this._isPageActive) return;
        // 弹窗失败，解除提交状态
        that.setData({ submitting: false });
      }
    });
  },

  // 提交评分并取消资格（不需要评分，直接取消资格）
  submitScoreWithDisqualification: function() {
    if (this.data.verificationPending || !this._isPageActive) return;
    this.setData({ submitting: true });
    
    wx.cloud.callFunction({
      name: 'submitExpertScore',
      data: {
        submissionId: this.data.submissionId,
        baseScore: 0, // 取消资格不记分
        totalScore: 0,
        finalScore: 0,
        deductions: {}, // 取消资格不记录扣分项
        expertId: this.data.expertInfo.expertId,
        expertCode: this.data.expertInfo.expertCode,
        expertName: this.data.expertInfo.expertName,
        editionId: this.data.expertInfo.editionId || (app.globalData.currentEdition && app.globalData.currentEdition.editionId) || 'pottery-2026',
        disqualify: true, // 标记为取消资格
        disqualifyReason: '内容违规或侵权抄袭' // 取消资格原因
      },
      success: res => {
        if (!this._isPageActive) return;
        this.setData({ submitting: false });
        
        if (res.result && res.result.success) {
          this.clearDraft();
          wx.showModal({
            title: '✅ 取消资格成功',
            content: '该作品已被取消参赛资格，其他评委将无法看到该作品。',
            showCancel: false,
            confirmText: '返回',
            success: () => {
              if (!this._isPageActive) return;
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
        if (!this._isPageActive) return;
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
  doSubmitScore: function(retryCount = 0) {
    if (!this._isPageActive || this.data.verificationPending) return;
    if (this._submitRequestPending) {
      return;
    }

    this._submitRequestPending = true;
    this.setData({ submitting: true });
    
    // 显示加载弹窗
    if (retryCount === 0) {
      wx.showLoading({
        title: '正在提交评分...',
        mask: true  // 防止用户点击其他内容
      });
    } else {
      wx.showLoading({
        title: `正在重试(${retryCount}/3)...`,
        mask: true
      });
    }
    
    // 调试：输出提交的参数
    
    
    
    
    
    
    
    
    
    if (retryCount > 0) {
      
    }
    
    
    const that = this;
    
    wx.cloud.callFunction({
      name: 'submitExpertScore',
      data: {
        submissionId: this.data.submissionId,
        baseScore: this.data.baseScore,
        rubricVersion: TOTAL_RUBRIC_VERSION,
        totalScore: this.data.totalScore,
        finalScore: this.data.finalScore,
        deductions: this.data.deductions,
        expertId: this.data.expertInfo.expertId,
        expertCode: this.data.expertInfo.expertCode,
        expertName: this.data.expertInfo.expertName,
        editionId: this.data.expertInfo.editionId || (app.globalData.currentEdition && app.globalData.currentEdition.editionId) || 'pottery-2026',
        disqualify: false // 正常评分不取消资格
      },
      timeout: 30000,  // 超时时间设置为30秒
      success: res => {
        this._submitRequestPending = false;
        if (!this._isPageActive) {
          return;
        }
        that.setData({ submitting: false });
        
        // 调试：输出云函数返回的完整数据
        
        
        
        
        
        if (res.result) {
          
          
          
        }
        
        
        if (res.result && res.result.success) {
          this.clearDraft();
          
          
          // 关闭加载弹窗
          wx.hideLoading();
          
          // 通知列表页面：从列表中移除已评分作品，并更新统计数据
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2]; // 上一个页面（列表页）
          
          if (prevPage && prevPage.route === 'pages/expert-evaluation/index') {
            // 1. 从列表中移除已评分的作品
            const submissions = prevPage.data.submissions || [];
            const updatedSubmissions = submissions.filter(item => item.id !== that.data.submissionId);
            
            // 2. 同步更新统计数据
            const statistics = prevPage.data.statistics;
            if (statistics) {
              statistics.evaluated = (statistics.evaluated || 0) + 1;  // 已评分 +1
              statistics.unevaluated = Math.max(0, (statistics.unevaluated || 0) - 1);  // 未评分 -1
              
              
            }
            
            // 3. 更新列表页面
            prevPage.setData({
              submissions: updatedSubmissions,
              statistics: statistics  // 同步更新统计
            });
            
            
          }
          
          // 连续评审使用列表中尚未评分的下一件；当前批次完成后回列表加载下一批。
          const next = prevPage && prevPage.route === 'pages/expert-evaluation/index' && (prevPage.data.submissions || []).find(w => !this.data.category || w.category === this.data.category);
          if (next && next.id) {
            this._handoffPrefetch = true;
            wx.redirectTo({ url: `/pages/expert-scoring/index?submissionId=${encodeURIComponent(next.id)}${this.data.category ? '&category=' + this.data.category : ''}`,
              fail: () => { this._handoffPrefetch = false; reviewPrefetch.clear(); wx.navigateBack(); } });
          } else {
            this.loadNextCategoryBatch(prevPage);
          }
        } else {
          
          
          
          // 关闭加载弹窗
          wx.hideLoading();
          
          // 重置提交状态
          that.setData({ submitting: false });
          
          wx.showToast({
            title: res.result ? (res.result.message || res.result.errMsg || '提交失败') : '提交失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this._submitRequestPending = false;
        if (!this._isPageActive) {
          return;
        }
        console.error('=== 云函数调用失败 ===');
        console.error('错误信息:', err.errMsg || err.message);
        console.error('重试次数:', retryCount);
        
        // 重试机制（最多重试3次）
        if (retryCount < 3) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // 指数退避：1秒、2秒、4秒
          
          
          // 更新加载提示
          wx.showLoading({
            title: `网络繁忙，${retryDelay / 1000}秒后重试...`,
            mask: true
          });
          
          clearTimeout(this._submitRetryTimer);
          this._submitRetryTimer = setTimeout(() => {
            this._submitRetryTimer = null;
            if (!this._isPageActive) {
              return;
            }
            that.doSubmitScore(retryCount + 1);
          }, retryDelay);
          
        } else {
          // 重试3次后仍失败，降级处理
          wx.hideLoading();
          that.setData({ submitting: false });
          
          console.error('❌ 重试3次后仍失败，启动降级处理');
          
          wx.showModal({
            title: '提交失败',
            content: '网络繁忙，提交失败。\n\n请稍后重试，或联系管理员。',
            confirmText: '手动重试',
            confirmColor: '#667eea',
            cancelText: '稍后再试',
            success: (res) => {
              if (!this._isPageActive) return;
              if (res.confirm) {
                // 用户选择手动重试，重置重试次数
                that.doSubmitScore(0);
              }
            }
          });
        }
      }
    });
  },

  loadNextCategoryBatch: function(listPage) {
    if (!this.data.category || !listPage || listPage.route !== 'pages/expert-evaluation/index') { wx.navigateBack(); return; }
    const expert = this.data.expertInfo;
    this.setData({ submitting: true });
    wx.showLoading({ title: '加载下一件...', mask: true });
    const back = message => {
      if (!this._isPageActive) return;
      wx.hideLoading();
      wx.showToast({ title: message, icon: 'none' });
      wx.navigateBack();
    };
    wx.cloud.callFunction({ name: 'fetchSubmissionsForEvaluation',
      data: { expertCode: expert.expertCode, editionId: expert.editionId || (app.globalData.currentEdition || {}).editionId || 'pottery-2026', category: this.data.category, batchOnly: true },
      timeout: 60000,
      success: res => {
        if (!this._isPageActive) return;
        const result = res.result;
        if (!result || !result.success) { back('加载失败，请在列表重试'); return; }
        const rows = (result.data || []).filter(w => w.category === this.data.category && w.id !== this.data.submissionId).slice(0, 5);
        listPage.setData({ submissions: rows, statistics: result.statistics || null, categories: result.categories || listPage.data.categories });
        if (!rows.length) { back('本类别暂无待评作品'); return; }
        wx.hideLoading();
        wx.redirectTo({ url: `/pages/expert-scoring/index?submissionId=${encodeURIComponent(rows[0].id)}&category=${this.data.category}`, fail: () => back('请从列表继续评分') });
      },
      fail: () => back('加载失败，请在列表重试')
    });
  },

  onShow: function() {
    this._isPageVisible = true;
    if (this._isPageActive && this.data.submission) this.scheduleNextPrefetch();
  },

  onHide: function() {
    this._isPageVisible = false;
    clearTimeout(this._prefetchTimer);
    this._prefetchTimer = null;
    if (!this._handoffPrefetch) reviewPrefetch.clear();
    if (this.data.submission && this.data.submission.workType === 'video') wx.createVideoContext('review-video', this).pause();
  },

  onUnload: function() {
    this._isPageActive = false;
    this._isPageVisible = false;
    this._detailRequestPending = false;
    this._submitRequestPending = false;
    clearTimeout(this._detailRetryTimer);
    clearTimeout(this._submitRetryTimer);
    clearTimeout(this._prefetchTimer);
    this._detailRetryTimer = null;
    this._submitRetryTimer = null;
    this._prefetchTimer = null;
    if (this._memoryWarningHandler && wx.offMemoryWarning) wx.offMemoryWarning(this._memoryWarningHandler);
    this._memoryWarningHandler = null;
    if (!this._handoffPrefetch) reviewPrefetch.clear();
    this.releasePrefetchedThumbnail();
    this.data.submission = null;
    this.data.mediaItems = [];
    this.data.dimensionRows = [];
    this.data.activeMediaUrl = '';
    wx.hideLoading();
  }
})
