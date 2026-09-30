// pages/pottery-submission/index.js
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const { detectImageFormat, imageFormatLabel } = require('../../utils/image-file');

const IMAGE_SLOT_DEFINITIONS = [
  { key: 'perspective', title: '1. 整体透视图', hint: '从正前方偏 45° 拍摄，展示作品整体形态与空间感。' },
  { key: 'front', title: '2. 正面图', hint: '正对作品正面拍摄，作品需完整居中。' },
  { key: 'right', title: '3. 右侧图', hint: '从作品右侧拍摄，展示侧面结构。' },
  { key: 'back', title: '4. 背面图', hint: '正对作品背面拍摄，展示背部完整状态。' },
  { key: 'left', title: '5. 左侧图', hint: '从作品左侧拍摄，展示另一侧结构。' },
  { key: 'topBottom', title: '6. 顶部／底部图', hint: '展示顶部或底部结构；如两者都重要可拼成一张。' },
  { key: 'detail', title: '7. 局部细节图', hint: '清晰展示工艺、材质、纹理或创意细节。' }
];

// 页面展示并提交本届分类名称；aliases 仅用于兼容旧记录的编辑回填。
const CATEGORY_OPTIONS = [
  { value: '传统·匠心传承', label: '传统·匠心传承', aliases: ['传统·匠心传承', '技艺', '技艺类', 'technique'] },
  { value: '当代·当代表达', label: '当代·当代表达', aliases: ['当代·当代表达', '文脉', '文脉类', 'culture'] },
  { value: '数字·数字传媒', label: '数字·数字传媒', aliases: ['数字·数字传媒', '算法', '算法类', 'algorithm'] },
  { value: '产业·产业制造', label: '产业·产业制造', aliases: ['产业·产业制造', '产业', '产业类', 'industry'] },
  { value: '国际·全球视野', label: '国际·全球视野', aliases: ['国际·全球视野', '视界', '视界类', 'vision'] }
];

function getCategoryOptionIndex(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return CATEGORY_OPTIONS.findIndex(option => option.aliases.indexOf(normalized) >= 0);
}

function getCategoryLabel(category) {
  const index = getCategoryOptionIndex(category);
  return index >= 0 ? CATEGORY_OPTIONS[index].label : String(category || '');
}

function getCategoryValue(category) {
  const index = getCategoryOptionIndex(category);
  return index >= 0 ? CATEGORY_OPTIONS[index].value : String(category || '');
}

function buildImageSlots(images = {}) {
  const fourViews = Array.isArray(images.fourViewImages) ? images.fourViewImages : [];
  const details = Array.isArray(images.detailImages) ? images.detailImages : [];
  const paths = {
    perspective: images.perspectiveImage || '',
    front: fourViews[0] || '', right: fourViews[1] || '', back: fourViews[2] || '',
    left: details[0] || '', topBottom: details[1] || '', detail: details[2] || ''
  };
  return IMAGE_SLOT_DEFINITIONS.map(item => ({ ...item, path: paths[item.key] || '', warning: '' }));
}

function formatFileSize(sizeBytes) {
  return `${(Number(sizeBytes || 0) / 1024 / 1024).toFixed(1)}MB`;
}

function getSelectedVideoFileName(file = {}) {
  const originalName = String(file.name || file.fileName || '').trim();
  const tempFilePath = String(file.tempFilePath || '');
  const tempName = tempFilePath.split(/[\\/]/).pop() || '';
  const knownName = originalName || tempName;

  if (/\.mp4(?:$|[?#])/i.test(knownName)) return knownName;
  return '';
}

function getVideoUploadErrorMessage(err = {}) {
  const rawMessage = String(err.errMsg || err.message || '').toLowerCase();
  if (/timeout|timed out/.test(rawMessage)) return '视频上传超时，请检查网络后重新提交。';
  if (/network|request:fail/.test(rawMessage)) return '网络连接异常，视频上传失败，请切换稳定网络后重试。';
  if (/permission|unauthorized|auth/.test(rawMessage)) return '云存储暂时无权接收视频，请联系管理员检查存储权限。';
  if (/size|exceed|too large/.test(rawMessage)) return '视频文件超过上传限制，请压缩到 100MB 以内后重试。';
  return '视频上传失败，请稍后重新提交。';
}

function isValidBaiduCloudBackup(link, password) {
  const normalizedLink = String(link || '').trim();
  const normalizedPassword = String(password || '').trim();
  return /^https?:\/\//i.test(normalizedLink)
    && /baidu\.com|baidupan\.com/i.test(normalizedLink)
    && Boolean(normalizedPassword);
}

function logVideoFlow(stage, detail = {}, level = 'log') {
  const logger = console[level] || console.log;
  logger.call(console, `[视频上传流程] ${stage}`, {
    time: new Date().toISOString(),
    ...detail
  });
}

function summarizeVideoError(err = {}) {
  return {
    errMsg: String(err.errMsg || ''),
    message: String(err.message || ''),
    errCode: err.errCode || err.errno || ''
  };
}

Page({

  /**
   * 页面的初始数据
   */
  data: {
    consentChecked: false,
    agreementAccepted: false,

    // 个人信息
    name: '',
    gender: '',
    genderIndex: null,
    genders: ['男', '女'],
    school: '',
    schoolProvince: '',
    schoolProvinceIndex: null,
    provinces: ['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '台湾', '香港', '澳门'],
    grade: '',
    gradeIndex: null,
    grades: ['大一', '大二', '大三', '大四', '研一', '研二', '研三', '博一', '博二', '博三'],
    birthDate: '',
    major: '',
    phone: '',
    email: '',
    idNumber: '',
    teacher: '',
    teacherPhone: '',
    address: '',
    photoUrl: '', // 个人照片
    
    // 作品信息
    workType: 'regular', // 'regular' 或 'video'
    workTypeIndex: 0,
    workTypes: ['常规作品', '视频作品'],
    artworkName: '',
    createYear: '',
    dimensions: [{ // 作品尺寸数组，支持多组
      length: '',
      width: '',
      height: ''
    }],
    category: '',
    categoryIndex: null,
    categoryLabel: '',
    categories: CATEGORY_OPTIONS.map(option => option.label),
    categoryValues: CATEGORY_OPTIONS.map(option => option.value),
    craftMaterial: '', // 作品工艺材料（最多20字）
    artworkDescription: '',
    artworkDescriptionLength: 0,
    // 分类上传的图片
    perspectiveImage: '', // 透视图（1张）
    fourViewImages: [], // 四面图（3张）
    detailImages: [], // 局部图（3张）
    imageSlots: buildImageSlots(),
    specialDisplay: '', // 特殊陈列方式描述（选填）
    
    // 视频作品专用字段
    videoDuration: '', // 时长
    videoResolution: '', // 清晰度
    videoResolutionIndex: null,
    videoResolutions: ['720P', '1080P', '2K', '4K', '8K'],
    videoAspectRatio: '', // 视频比例
    videoAspectRatioIndex: null,
    videoAspectRatios: ['16:9', '4:3', '1:1', '21:9'],
    shootingTechnique: '', // 拍摄技巧
    baiduCloudLink: '', // 百度云链接
    baiduCloudPassword: '', // 百度云密码
    useBaiduBackup: false,
    video: {
      fileId: '',
      fileName: '',
      tempFilePath: '',
      sizeBytes: 0,
      format: 'mp4',
      durationSeconds: 0,
      width: 0,
      height: 0,
      aspectRatio: '',
      uploadStatus: 'ready',
      uploadedAt: null
    },
    videoUploading: false,
    videoChecking: false,
    videoUploadProgress: 0,
    videoUploadHint: '',
    videoLocalIssue: '',
    showPrivacyDialog: false,
    
    // 其他状态
    submitting: false,
    isEditMode: false,
    submissionId: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.registerPrivacyAuthorization();

    // 检查是否为编辑模式
    if (options.mode === 'edit' && options.id) {
      // 设置页面标题为编辑模式
      wx.setNavigationBarTitle({
        title: '修改参展申请'
      });
      
      // 从缓存中获取申请数据
      const editSubmission = wx.getStorageSync('editSubmission');
      
      if (editSubmission) {
        console.log('编辑模式数据:', editSubmission);
        
        // 设置表单数据
        this.setData({
          // 个人信息
          name: editSubmission.name || '',
          gender: editSubmission.gender || '',
          genderIndex: this.data.genders.indexOf(editSubmission.gender),
          school: editSubmission.school || '',
          schoolProvince: editSubmission.schoolProvinces || '',
          schoolProvinceIndex: this.data.provinces.indexOf(editSubmission.schoolProvinces),
          grade: editSubmission.grade || '',
          gradeIndex: this.data.grades.indexOf(editSubmission.grade),
          birthDate: editSubmission.birthDate || '',
          major: editSubmission.major || '',
          phone: editSubmission.phone || '',
          email: editSubmission.email || '',
          idNumber: editSubmission.idNumber || '',
          teacher: editSubmission.teacher || '',
          teacherPhone: editSubmission.teacherPhone || '',
          address: editSubmission.address || '',
          photoUrl: editSubmission.photoUrl || '',
          
          // 作品信息
          workType: editSubmission.workType || 'regular',
          workTypeIndex: editSubmission.workType === 'video' ? 1 : 0,
          artworkName: editSubmission.artworkName || '',
          createYear: editSubmission.createYear || '',
          dimensions: editSubmission.dimensions || [{length: '', width: '', height: ''}],
          category: getCategoryValue(editSubmission.category),
          categoryIndex: getCategoryOptionIndex(editSubmission.category),
          categoryLabel: getCategoryLabel(editSubmission.category),
          craftMaterial: editSubmission.craftMaterial || '',
          artworkDescription: editSubmission.artworkDescription || '',
          artworkDescriptionLength: (editSubmission.artworkDescription || '').length,
          perspectiveImage: editSubmission.perspectiveImage || '',
          fourViewImages: Array.isArray(editSubmission.fourViewImages) ? editSubmission.fourViewImages : [],
          detailImages: Array.isArray(editSubmission.detailImages) ? editSubmission.detailImages : [],
          specialDisplay: editSubmission.specialDisplay || '',
          // 视频作品字段
          videoDuration: editSubmission.videoDuration || '',
          videoResolution: editSubmission.videoResolution || '',
          videoResolutionIndex: this.data.videoResolutions.indexOf(editSubmission.videoResolution),
          videoAspectRatio: editSubmission.videoAspectRatio || '',
          videoAspectRatioIndex: this.data.videoAspectRatios.indexOf(editSubmission.videoAspectRatio),
          shootingTechnique: editSubmission.shootingTechnique || '',
          baiduCloudLink: editSubmission.baiduCloudLink || '',
          baiduCloudPassword: editSubmission.baiduCloudPassword || '',
          useBaiduBackup: Boolean(editSubmission.baiduCloudLink || editSubmission.baiduCloudPassword),
          video: {
            ...this.data.video,
            ...(editSubmission.video || {}),
            tempFilePath: ''
          },
          
          // 编辑模式
          isEditMode: true,
          submissionId: options.id,
          imageSlots: buildImageSlots(editSubmission)
        });
        
        console.log('设置后的图片数据:', {
          photoUrl: this.data.photoUrl,
          perspectiveImage: this.data.perspectiveImage,
          fourViewImages: this.data.fourViewImages,
          detailImages: this.data.detailImages
        });
      }
      
      // 清除缓存数据
      wx.removeStorageSync('editSubmission');
    } else {
      // 普通提交模式
      this.setData({
        isEditMode: false,
        submissionId: ''
      });
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    if (this._privacyAuthorizationHandler && typeof wx.offNeedPrivacyAuthorization === 'function') {
      wx.offNeedPrivacyAuthorization(this._privacyAuthorizationHandler);
    }
    this._privacyAuthorizationHandler = null;
    this._privacyAuthorizationResolve = null;
  },

  handleConsentChange(e) {
    const values = Array.isArray(e.detail.value) ? e.detail.value : [];
    this.setData({ consentChecked: values.includes('accepted') });
  },

  confirmConsent() {
    if (!this.data.consentChecked) {
      this.showToast('请先阅读并同意用户服务协议和隐私政策');
      return;
    }
    this.setData({ agreementAccepted: true });
  },

  openUserServiceAgreement() {
    wx.navigateTo({
      url: '/pages/user-service-agreement/index'
    });
  },

  openPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy-policy/index'
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  // 个人信息输入方法
  inputName(e) {
    this.setData({ name: e.detail.value })
  },
  
  bindGenderChange(e) {
    this.setData({
      genderIndex: e.detail.value,
      gender: this.data.genders[e.detail.value]
    })
  },
  
  inputSchool(e) {
    this.setData({ school: e.detail.value })
  },
  
  bindSchoolProvinceChange(e) {
    this.setData({
      schoolProvinceIndex: e.detail.value,
      schoolProvince: this.data.provinces[e.detail.value]
    })
  },
  
  bindGradeChange(e) {
    this.setData({
      gradeIndex: e.detail.value,
      grade: this.data.grades[e.detail.value]
    })
  },
  
  bindBirthDateChange(e) {
    this.setData({ birthDate: e.detail.value })
  },
  
  inputMajor(e) {
    this.setData({ major: e.detail.value })
  },
  
  inputPhone(e) {
    this.setData({ phone: e.detail.value })
  },
  
  inputEmail(e) {
    this.setData({ email: e.detail.value })
  },
  
  inputIdNumber(e) {
    this.setData({ idNumber: e.detail.value })
  },
  
  inputTeacher(e) {
    this.setData({ teacher: e.detail.value })
  },
  
  inputTeacherPhone(e) {
    this.setData({ teacherPhone: e.detail.value })
  },
  
  inputAddress(e) {
    this.setData({ address: e.detail.value })
  },
  
  // 个人照片上传
  choosePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ photoUrl: res.tempFilePaths[0] })
      }
    })
  },
  
  removePhoto() {
    this.setData({ photoUrl: '' })
  },
  
  // 作品信息输入方法
  // 作品类型切换
  bindWorkTypeChange(e) {
    const index = parseInt(e.detail.value);
    const workType = index === 0 ? 'regular' : 'video';
    this.setData({
      workTypeIndex: index,
      workType: workType
    });
  },
  
  inputArtworkName(e) {
    this.setData({ artworkName: e.detail.value })
  },
  
  bindCreateYearChange(e) {
    // 只保留年份
    const year = e.detail.value.split('-')[0]
    this.setData({ createYear: year })
  },
  
  // 尺寸输入方法
  inputDimension(e) {
    const { index, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const dimensions = [...this.data.dimensions];
    dimensions[index][field] = value;
    this.setData({ dimensions });
  },
  
  // 添加尺寸组
  addDimension() {
    const dimensions = [...this.data.dimensions, { length: '', width: '', height: '' }];
    this.setData({ dimensions });
  },
  
  // 删除尺寸组
  removeDimension(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.dimensions.length <= 1) {
      wx.showToast({
        title: '至少需要一组尺寸',
        icon: 'none'
      });
      return;
    }
    const dimensions = [...this.data.dimensions];
    dimensions.splice(index, 1);
    this.setData({ dimensions });
  },
  
  bindCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    this.setData({
      categoryIndex: categoryIndex,
      category: this.data.categoryValues[categoryIndex],
      categoryLabel: this.data.categories[categoryIndex]
    })
  },
  
  inputCraftMaterial(e) {
    const value = e.detail.value;
    if (value.length > 20) {
      wx.showToast({
        title: '工艺材料描述不能超过20字',
        icon: 'none'
      });
      return;
    }
    this.setData({ craftMaterial: value });
  },
  
  inputArtworkDescription(e) {
    const value = e.detail.value;
    // 正文不通过 setData 回写原生 textarea，避免真机输入时反复重绘和滚动。
    this.data.artworkDescription = value;
    this.setData({ artworkDescriptionLength: value.length })
  },
  
  inputSpecialDisplay(e) {
    // 该字段没有实时联动展示，避免真机上逐字 setData 导致 textarea 重绘和页面跳动。
    this.data.specialDisplay = e.detail.value
  },
  
  // 视频作品字段输入方法
  inputVideoDuration(e) {
    this.setData({ videoDuration: e.detail.value })
  },
  
  bindVideoResolutionChange(e) {
    this.setData({
      videoResolutionIndex: e.detail.value,
      videoResolution: this.data.videoResolutions[e.detail.value]
    })
  },
  
  bindVideoAspectRatioChange(e) {
    this.setData({
      videoAspectRatioIndex: e.detail.value,
      videoAspectRatio: this.data.videoAspectRatios[e.detail.value]
    })
  },
  
  inputShootingTechnique(e) {
    this.setData({ shootingTechnique: e.detail.value })
  },
  
  inputBaiduCloudLink(e) {
    this.setData({ baiduCloudLink: e.detail.value })
  },
  
  inputBaiduCloudPassword(e) {
    this.setData({ baiduCloudPassword: e.detail.value })
  },

  confirmBaiduBackup() {
    wx.showModal({
      title: '确认使用百度网盘',
      content: '请先尝试将视频压缩到 100MB 以内。仅在确实无法压缩时使用百度网盘提交。',
      confirmText: '确认使用',
      cancelText: '继续压缩',
      success: result => {
        if (result.confirm) this.setData({ useBaiduBackup: true });
      }
    });
  },

  chooseVideoFile() {
    this._videoTraceId = `video_${Date.now()}`;
    logVideoFlow('01 点击选择视频', {
      traceId: this._videoTraceId,
      hasPrivacyApi: typeof wx.requirePrivacyAuthorize === 'function'
    });
    this.setData({ videoLocalIssue: '' });
    if (typeof wx.requirePrivacyAuthorize === 'function') {
      wx.requirePrivacyAuthorize({
        success: () => {
          logVideoFlow('02 隐私授权通过', { traceId: this._videoTraceId });
          this.openVideoPicker();
        },
        fail: err => {
          logVideoFlow('02 隐私授权失败', {
            traceId: this._videoTraceId,
            error: summarizeVideoError(err)
          }, 'warn');
          this.handleVideoPickerFailure(err, '隐私授权未完成');
        }
      });
      return;
    }
    logVideoFlow('02 当前版本无需主动隐私授权', { traceId: this._videoTraceId });
    this.openVideoPicker();
  },

  registerPrivacyAuthorization() {
    if (typeof wx.onNeedPrivacyAuthorization !== 'function') return;
    this._privacyAuthorizationHandler = resolve => {
      logVideoFlow('隐私授权弹窗被触发', { traceId: this._videoTraceId || '' });
      this._privacyAuthorizationResolve = resolve;
      this.setData({ showPrivacyDialog: true });
    };
    wx.onNeedPrivacyAuthorization(this._privacyAuthorizationHandler);
  },

  handleAgreePrivacyAuthorization() {
    logVideoFlow('用户同意隐私授权', { traceId: this._videoTraceId || '' });
    const resolve = this._privacyAuthorizationResolve;
    this._privacyAuthorizationResolve = null;
    this.setData({ showPrivacyDialog: false });
    if (typeof resolve === 'function') {
      resolve({ event: 'agree', buttonId: 'agree-media-privacy' });
    }
  },

  handleRejectPrivacyAuthorization() {
    logVideoFlow('用户拒绝隐私授权', { traceId: this._videoTraceId || '' }, 'warn');
    const resolve = this._privacyAuthorizationResolve;
    this._privacyAuthorizationResolve = null;
    this.setData({
      showPrivacyDialog: false,
      videoLocalIssue: '选择视频需要获得隐私授权。你可以再次点击“选择 MP4 视频”重新授权。'
    });
    if (typeof resolve === 'function') resolve({ event: 'disagree' });
  },

  preventDefault() {},

  openPrivacyContract() {
    if (typeof wx.openPrivacyContract !== 'function') {
      this.showToast('当前微信版本暂不支持查看隐私指引');
      return;
    }
    wx.openPrivacyContract({
      fail: err => {
        console.warn('打开隐私保护指引失败:', err);
        this.showToast('隐私保护指引暂时无法打开');
      }
    });
  },

  openVideoPicker() {
    logVideoFlow('03 正在打开系统相册', { traceId: this._videoTraceId });
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album'],
      sizeType: ['original'],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0];
        logVideoFlow('04 相册返回成功', {
          traceId: this._videoTraceId,
          fileCount: res.tempFiles ? res.tempFiles.length : 0,
          hasFile: Boolean(file),
          sizeBytes: file ? Number(file.size || 0) : 0,
          duration: file ? Number(file.duration || 0) : 0,
          width: file ? Number(file.width || 0) : 0,
          height: file ? Number(file.height || 0) : 0,
          hasTempFilePath: Boolean(file && file.tempFilePath)
        });
        this.handleSelectedVideoFile(file);
      },
      fail: err => {
        logVideoFlow('04 相册返回失败', {
          traceId: this._videoTraceId,
          error: summarizeVideoError(err)
        }, 'warn');
        this.handleVideoPickerFailure(err, '选择视频失败');
      }
    });
  },

  handleSelectedVideoFile(file) {
    logVideoFlow('05 开始检查所选文件', {
      traceId: this._videoTraceId,
      hasFile: Boolean(file),
      hasTempFilePath: Boolean(file && file.tempFilePath),
      originalName: file ? String(file.name || file.fileName || '') : '',
      sizeBytes: file ? Number(file.size || 0) : 0
    });
    if (!file || !file.tempFilePath) {
      logVideoFlow('05 文件检查失败：没有临时路径', { traceId: this._videoTraceId }, 'error');
      this.setData({ videoLocalIssue: '没有获得视频文件，请重新选择。' });
      this.showToast('未选择视频文件');
      return;
    }

    const fileName = getSelectedVideoFileName(file);
    const sizeBytes = Number(file.size || 0);
    if (!fileName) {
      logVideoFlow('05 文件检查失败：不是 MP4', { traceId: this._videoTraceId }, 'error');
      this.setData({ videoLocalIssue: '所选视频不是 MP4 格式，请转换为 MP4 后重新选择。' });
      this.showToast('视频仅支持 MP4 格式');
      return;
    }
    if (sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      logVideoFlow('05 文件检查失败：文件大小异常', {
        traceId: this._videoTraceId,
        sizeBytes,
        maxSizeBytes: MAX_VIDEO_SIZE_BYTES
      }, 'error');
      this.setData({ videoLocalIssue: `所选视频为 ${formatFileSize(sizeBytes)}。请先压缩至 100MB 以内；确实无法压缩时，可确认使用百度网盘提交。` });
      this.showToast('请先压缩至100MB以内');
      return;
    }

    logVideoFlow('06 使用选择器返回的视频信息', {
      traceId: this._videoTraceId,
      duration: Number(file.duration || 0),
      width: Number(file.width || 0),
      height: Number(file.height || 0),
      sizeBytes
    });
    this.acceptVideoFile(file, fileName, sizeBytes, file);
  },

  handleVideoPickerFailure(err, fallbackMessage) {
    const errMsg = String((err && err.errMsg) || '');
    console.warn(`${fallbackMessage}:`, err || {});
    if (/cancel/i.test(errMsg)) {
      logVideoFlow('流程结束：用户取消选择', { traceId: this._videoTraceId, errMsg }, 'warn');
      this.setData({ videoLocalIssue: '本次没有选中视频文件，请重新选择。' });
      this.showToast('已取消视频选择');
      return;
    }

    let message = '无法打开视频选择器，请检查微信的照片与视频权限后重试。';
    if (/privacy|authorize|auth deny|permission/i.test(errMsg)) {
      message = '尚未获得照片与视频访问授权，请同意隐私保护指引并允许微信访问后重试。';
    } else if (/not support/i.test(errMsg)) {
      message = '当前微信版本不支持选择视频，请升级微信后重试。';
    }
    this.setData({ videoLocalIssue: message });
    wx.showModal({
      title: fallbackMessage,
      content: message,
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  acceptVideoFile(file, fileName, sizeBytes, info = {}) {
    const durationSeconds = Number(info.duration || file.duration || 0);
    const width = Number(info.width || file.width || 0);
    const height = Number(info.height || file.height || 0);
    logVideoFlow('07 开始校验视频参数', {
      traceId: this._videoTraceId,
      fileName,
      sizeBytes,
      durationSeconds,
      width,
      height
    });
    const hasDimensions = Boolean(width && height);
    const ratio = hasDimensions ? width / height : 0;
    const hints = [];
    if (hasDimensions && Math.abs(ratio - 16 / 9) > 0.03) hints.push('当前不是推荐的16:9横屏，仍可提交。');
    if (hasDimensions && Math.min(width, height) < 720) hints.push('建议使用不低于720P的视频以便评审查看细节。');
    const bitrateMbps = durationSeconds ? (sizeBytes * 8 / durationSeconds / 1000 / 1000) : 0;
    if (bitrateMbps && bitrateMbps > 2.5) hints.push('当前码率高于建议值，上传耗时可能较长。');
    logVideoFlow('07 参数校验通过，准备立即上传', {
      traceId: this._videoTraceId,
      bitrateMbps: Number(bitrateMbps.toFixed(2)),
      hintCount: hints.length
    });
    this.setData({
      video: {
        fileId: '', fileName, tempFilePath: file.tempFilePath, sizeBytes, format: 'mp4',
        durationSeconds, width, height, aspectRatio: hasDimensions ? `${width}:${height}` : '',
        uploadStatus: 'ready', uploadedAt: null
      },
      videoDuration: durationSeconds ? `${Math.ceil(durationSeconds)}秒` : '未获取',
      videoResolution: hasDimensions ? (height >= 1080 || width >= 1080 ? '1080P' : '720P') : '未获取',
      videoAspectRatio: hasDimensions ? `${width}:${height}` : '未获取',
      videoUploadHint: hints.join(' '),
      videoLocalIssue: '',
      videoChecking: false,
      videoUploadProgress: 0
    }, () => this.uploadSelectedVideoImmediately());
  },

  uploadSelectedVideoImmediately() {
    if (this.data.videoUploading) {
      logVideoFlow('08 忽略重复上传请求', { traceId: this._videoTraceId }, 'warn');
      return;
    }
    logVideoFlow('08 开始立即上传', {
      traceId: this._videoTraceId,
      fileName: this.data.video.fileName,
      sizeBytes: this.data.video.sizeBytes,
      hasTempFilePath: Boolean(this.data.video.tempFilePath)
    });
    wx.showLoading({ title: '上传 0%', mask: true });
    this.ensureVideoUploaded().then(uploadedVideo => {
      logVideoFlow('10 云存储上传成功', {
        traceId: this._videoTraceId,
        fileName: uploadedVideo.fileName,
        hasFileId: Boolean(uploadedVideo.fileId),
        uploadStatus: uploadedVideo.uploadStatus
      });
      wx.hideLoading();
      wx.showModal({
        title: '视频上传成功',
        content: '视频已上传完成，可以继续提交报名。',
        showCancel: false,
        confirmText: '我知道了'
      });
    }).catch(err => {
      logVideoFlow('10 云存储上传失败', {
        traceId: this._videoTraceId,
        error: summarizeVideoError(err)
      }, 'error');
      wx.hideLoading();
      wx.showModal({
        title: '视频上传失败',
        content: getVideoUploadErrorMessage(err),
        showCancel: true,
        cancelText: '稍后处理',
        confirmText: '重新上传',
        success: result => {
          if (result.confirm) this.retryVideoUpload();
        }
      });
    });
  },

  retryVideoUpload() {
    logVideoFlow('用户点击重新上传', {
      traceId: this._videoTraceId,
      hasTempFilePath: Boolean(this.data.video && this.data.video.tempFilePath)
    });
    if (!this.data.video || !this.data.video.tempFilePath) {
      this.showToast('本地视频已失效，请重新选择');
      return;
    }
    this.uploadSelectedVideoImmediately();
  },

  removeVideoFile() {
    this.setData({
      video: {
        fileId: '',
        fileName: '',
        tempFilePath: '',
        sizeBytes: 0,
        format: 'mp4',
        durationSeconds: 0,
        width: 0,
        height: 0,
        aspectRatio: '',
        uploadStatus: 'ready',
        uploadedAt: null
      },
      videoUploadProgress: 0,
      videoUploadHint: '',
      videoLocalIssue: '',
      videoChecking: false,
      videoUploading: false
    });
  },

  chooseArtworkImage(e) {
    const key = e.currentTarget.dataset.key;
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: res => this.validateAndSetArtworkImage(key, res.tempFilePaths[0])
    });
  },

  validateAndSetArtworkImage(key, filePath) {
    wx.getFileInfo({
      filePath,
      success: fileInfo => {
        if (fileInfo.size > MAX_IMAGE_SIZE_BYTES) {
          this.showImageValidationError('单张图片不能超过 5MB。请压缩图片或重新选择文件。');
          return;
        }

        wx.getImageInfo({
          src: filePath,
          success: info => {
            const type = String(info.type || '').toLowerCase();
            if (!['jpg', 'jpeg', 'png'].includes(type)) {
              const formatLabel = imageFormatLabel(type === 'jpg' ? 'jpeg' : type);
              this.showImageValidationError(`检测到的图片格式为${formatLabel}。仅支持 JPG/JPEG 或 PNG 图片，请转换格式后重新选择。`);
              return;
            }
            if (Math.abs(info.width / info.height - 1) > 0.01) {
              this.showImageValidationError('图片必须为 1:1 正方形。请裁剪后重新上传。');
              return;
            }
            const warning = info.width < 1200 || info.height < 1200
              ? '当前图片低于建议尺寸 1200×1200px，但仍可提交。'
              : '';
            const imageSlots = this.data.imageSlots.map(slot => slot.key === key
              ? { ...slot, path: filePath, warning }
              : slot);
            this.setImageSlots(imageSlots);
          },
          fail: () => this.inspectUnreadableArtworkImage(filePath)
        });
      },
      fail: () => this.showImageValidationError('无法读取图片文件，请重新选择。')
    });
  },

  inspectUnreadableArtworkImage(filePath) {
    wx.getFileSystemManager().readFile({
      filePath,
      success: fileResult => {
        const actualFormat = detectImageFormat(fileResult.data);
        if (actualFormat === 'webp') {
          this.showImageValidationError('该文件虽然使用了 .jpg 扩展名，但实际编码是 WebP。仅支持 JPG/JPEG 或 PNG 图片，请转换格式后重新选择。');
          return;
        }
        if (['jpeg', 'png'].includes(actualFormat)) {
          this.showImageValidationError('文件是 JPG/PNG，但微信无法读取图片尺寸。请用系统相册或图片工具重新导出后再选择。');
          return;
        }
        this.showImageValidationError(`无法读取图片信息，检测到的真实格式为${imageFormatLabel(actualFormat)}。仅支持 JPG/JPEG 或 PNG 图片。`);
      },
      fail: () => this.showImageValidationError('无法读取图片文件，请重新选择。')
    });
  },

  showImageValidationError(content) {
    wx.showModal({
      title: '图片不符合上传要求',
      content,
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  removeArtworkImage(e) {
    const key = e.currentTarget.dataset.key;
    this.setImageSlots(this.data.imageSlots.map(slot => slot.key === key ? { ...slot, path: '', warning: '' } : slot));
  },

  setImageSlots(imageSlots) {
    const paths = imageSlots.reduce((result, slot) => ({ ...result, [slot.key]: slot.path }), {});
    this.setData({
      imageSlots,
      perspectiveImage: paths.perspective,
      fourViewImages: [paths.front, paths.right, paths.back],
      detailImages: [paths.left, paths.topBottom, paths.detail]
    });
  },
  
  // 验证表单
  validateForm() {
    // 必填字段检查
    if (!this.data.name) {
      this.showToast('请输入姓名')
      return false
    }
    if (!this.data.gender) {
      this.showToast('请选择性别')
      return false
    }
    if (!this.data.school) {
      this.showToast('请输入所在学校')
      return false
    }
    if (!this.data.schoolProvince) {
      this.showToast('请选择学校省份')
      return false
    }
    if (!this.data.grade) {
      this.showToast('请选择年级')
      return false
    }
    if (!this.data.birthDate) {
      this.showToast('请选择出生年月')
      return false
    }
    if (!this.data.major) {
      this.showToast('请输入专业')
      return false
    }
    if (!this.data.phone) {
      this.showToast('请输入联系电话')
      return false
    }
    if (!this.data.email) {
      this.showToast('请输入邮箱')
      return false
    }
    if (!this.data.idNumber) {
      this.showToast('请输入身份证号码')
      return false
    }
    if (!this.data.teacher) {
      this.showToast('请输入指导老师姓名')
      return false
    }
    if (!this.data.teacherPhone) {
      this.showToast('请输入指导老师电话')
      return false
    }
    if (!this.data.address) {
      this.showToast('请输入邮寄地址')
      return false
    }
    if (!this.data.photoUrl) {
      this.showToast('请上传个人照片')
      return false
    }
    if (!this.data.artworkName) {
      this.showToast('请输入作品名称')
      return false
    }
    if (!this.data.createYear) {
      this.showToast('请选择创作年份')
      return false
    }
    // 根据作品类型进行不同的验证
    if (this.data.workType === 'regular') {
      // 常规作品：检查尺寸数据
      const hasValidDimensions = this.data.dimensions.some(dim => 
        dim.length && dim.width && dim.height
      );
      if (!hasValidDimensions) {
        this.showToast('请至少完整填写一组作品尺寸')
        return false
      }
      if (!this.data.craftMaterial) {
        this.showToast('请填写作品工艺和材料')
        return false
      }
    }
    
    if (!this.data.category) {
      this.showToast('请选择作品类别')
      return false
    }
    if (!this.data.artworkDescription) {
      this.showToast('请填写作品简介')
      return false
    }
    
    // 根据作品类型进行不同的验证
    if (this.data.workType === 'regular') {
      // 常规作品：检查图片上传
      const missingSlots = this.data.imageSlots.filter(slot => !slot.path);
      if (missingSlots.length) {
        this.showToast(`请补齐${missingSlots[0].title}`)
        return false
      }
    } else if (this.data.workType === 'video') {
      logVideoFlow('提交前检查视频状态', {
        traceId: this._videoTraceId || '',
        videoChecking: this.data.videoChecking,
        videoUploading: this.data.videoUploading,
        uploadStatus: this.data.video ? this.data.video.uploadStatus : '',
        hasFileId: Boolean(this.data.video && this.data.video.fileId),
        useBaiduBackup: this.data.useBaiduBackup,
        hasBaiduLink: Boolean(this.data.baiduCloudLink.trim()),
        hasBaiduPassword: Boolean(this.data.baiduCloudPassword.trim())
      });
      if (this.data.videoChecking) {
        this.showToast('请等待视频检测完成')
        return false
      }
      if (this.data.videoUploading) {
        this.showToast('请等待视频上传完成')
        return false
      }
      const hasUploadedVideo = Boolean(
        this.data.video
        && this.data.video.fileId
        && this.data.video.uploadStatus === 'uploaded'
      );
      const baiduLink = this.data.baiduCloudLink.trim();
      const baiduPassword = this.data.baiduCloudPassword.trim();
      const hasBaiduBackup = this.data.useBaiduBackup && isValidBaiduCloudBackup(baiduLink, baiduPassword);
      if (!hasUploadedVideo && !hasBaiduBackup) {
        if (this.data.useBaiduBackup) {
          this.showToast('请填写有效的百度网盘链接及提取码')
          return false
        }
        this.showToast('请上传MP4视频，或确认使用百度网盘')
        return false
      }
    }
    
    // 格式验证
    if (!this.validatePhone(this.data.phone)) {
      this.showToast('联系电话格式不正确，请输入11位手机号码')
      return false
    }
    if (!this.validateEmail(this.data.email)) {
      this.showToast('邮箱格式不正确')
      return false
    }
    if (!this.validateIdNumber(this.data.idNumber)) {
      this.showToast('身份证号码格式不正确')
      return false
    }
    if (!this.validatePhone(this.data.teacherPhone)) {
      this.showToast('指导老师电话格式不正确，请输入11位手机号码')
      return false
    }
    
    return true
  },

  // 验证手机号
  validatePhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(phone)
  },

  // 验证邮箱
  validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
  },

  // 验证身份证号
  validateIdNumber(idNumber) {
    const idRegex = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/
    return idRegex.test(idNumber)
  },
  
  // 提交申请
  submitApplication() {
    logVideoFlow('用户点击提交报名', {
      traceId: this._videoTraceId || '',
      workType: this.data.workType,
      uploadStatus: this.data.video ? this.data.video.uploadStatus : '',
      hasFileId: Boolean(this.data.video && this.data.video.fileId)
    });
    // 防止重复提交：先检查是否正在提交中
    if (this.data.submitting) {
      console.log('正在提交中，忽略重复点击');
      return;
    }

    if (!this.data.agreementAccepted) {
      this.showToast('请先阅读并同意用户服务协议和隐私政策');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.setData({ submitting: true });

    wx.showLoading({
      title: this.data.isEditMode ? '更新中...' : '提交中...',
      mask: true
    });

    // 上传个人照片
    // 检查照片是否已经是云存储的路径或网络图片
    const uploadPersonalPhoto = this.data.photoUrl && 
      !this.data.photoUrl.startsWith('cloud://') && 
      !(this.data.photoUrl.startsWith('http://') && !this.data.photoUrl.startsWith('http://tmp/')) && 
      !this.data.photoUrl.startsWith('https://') ? 
      this.uploadSingleFile(this.data.photoUrl, 'personal_photos') : 
      Promise.resolve(this.data.photoUrl);

    // 准备上传分类图片
    const perspectiveToUpload = this.data.perspectiveImage && 
      !this.data.perspectiveImage.startsWith('cloud://') && 
      !(this.data.perspectiveImage.startsWith('http://') && !this.data.perspectiveImage.startsWith('http://tmp/')) && 
      !this.data.perspectiveImage.startsWith('https://') ? 
      this.uploadSingleFile(this.data.perspectiveImage, 'artwork_photos') : 
      Promise.resolve(this.data.perspectiveImage);
    
    console.log('准备上传的文件:', {
      personalPhoto: this.data.photoUrl,
      perspectiveImage: this.data.perspectiveImage,
      fourViewImages: this.data.fourViewImages.length,
      detailImages: this.data.detailImages.length
    });

    const hasUploadedVideo = this.data.video
      && this.data.video.fileId
      && this.data.video.uploadStatus === 'uploaded';
    const videoUploadPromise = Promise.resolve(hasUploadedVideo ? this.data.video : null);

    Promise.all([
      uploadPersonalPhoto,
      perspectiveToUpload,
      this.uploadMultipleFiles(this.data.fourViewImages, 'artwork_photos'),
      this.uploadMultipleFiles(this.data.detailImages, 'artwork_photos'),
      videoUploadPromise
    ]).then(([photoFileID, perspectiveFileID, fourViewFileIDs, detailFileIDs, uploadedVideo]) => {
      console.log('上传完成:', {
        photoFileID,
        perspectiveFileID,
        fourViewFileIDs,
        detailFileIDs
      });
      
      // 保存表单数据到数据库
      return this.saveSubmissionData(photoFileID, perspectiveFileID, fourViewFileIDs, detailFileIDs, uploadedVideo);
    }).catch(err => {
      console.error('上传失败', err);
      wx.hideLoading();
      this.setData({ submitting: false });

      const videoFailed = this.data.workType === 'video'
        && this.data.video
        && this.data.video.uploadStatus === 'failed';
      const errorMessage = videoFailed
        ? getVideoUploadErrorMessage(err)
        : String((err && (err.message || err.errMsg)) || '文件上传失败，请重试');
      wx.showModal({
        title: videoFailed ? '视频上传失败' : '文件上传失败',
        content: errorMessage,
        showCancel: false,
        confirmText: '我知道了'
      });
    });
  },
  
  // 上传单个文件
  uploadSingleFile(filePath, folder) {
    return new Promise((resolve, reject) => {
      // 检查文件路径是否有效
      if (!filePath || filePath.trim() === '') {
        reject(new Error('文件路径为空'));
        return;
      }
      
      // 检查文件是否已经存在于云存储中
      if (filePath.startsWith('cloud://')) {
        resolve(filePath);
        return;
      }
      
      // 检查是否是网络图片URL（https:// 或 http://，但排除临时文件路径）
      if ((filePath.startsWith('http://') || filePath.startsWith('https://')) && !filePath.startsWith('http://tmp/')) {
        // 网络图片需要先下载到本地，然后上传到云存储
        console.log('检测到网络图片URL，开始下载并上传到云存储:', filePath);
        this.downloadAndUploadImage(filePath, folder).then(resolve).catch(reject);
        return;
      }
      
      // 检查文件是否存在（仅对本地文件路径）
      wx.getFileInfo({
        filePath: filePath,
        success: (fileInfo) => {
          const extensionMatch = filePath.match(/\.(png|jpe?g)(?:$|[?#])/i);
          const extension = extensionMatch ? extensionMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
          const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2)}.${extension}`;
          
          wx.cloud.uploadFile({
            cloudPath,
            filePath,
            success: res => {
              console.log('文件上传成功，云存储链接:', res.fileID);
              resolve(res.fileID);
            },
            fail: err => {
              console.error('上传文件失败:', err);
              reject(err);
            }
          });
        },
        fail: (err) => {
          console.error('文件不存在或无法访问:', err);
          reject(new Error('文件不存在或无法访问'));
        }
      });
    });
  },
  
  // 下载网络图片并上传到云存储
  downloadAndUploadImage(imageUrl, folder) {
    return new Promise((resolve, reject) => {
      // 先下载图片到本地
      wx.downloadFile({
        url: imageUrl,
        success: (downloadRes) => {
          if (downloadRes.statusCode === 200) {
            // 下载成功，上传到云存储
            const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2)}.jpg`;
            
            wx.cloud.uploadFile({
              cloudPath,
              filePath: downloadRes.tempFilePath,
              success: (uploadRes) => {
                console.log('网络图片上传到云存储成功，云存储链接:', uploadRes.fileID);
                resolve(uploadRes.fileID);
              },
              fail: (uploadErr) => {
                console.error('上传网络图片到云存储失败:', uploadErr);
                reject(uploadErr);
              }
            });
          } else {
            reject(new Error('下载图片失败，状态码: ' + downloadRes.statusCode));
          }
        },
        fail: (downloadErr) => {
          console.error('下载图片失败:', downloadErr);
          reject(downloadErr);
        }
      });
    });
  },
  
  // 上传多个文件
  uploadMultipleFiles(filePaths, folder) {
    if (!filePaths || filePaths.length === 0) {
      return Promise.resolve([]);
    }
    
    const uploadPromises = filePaths.map(filePath => 
      this.uploadSingleFile(filePath, folder)
    );
    
    return Promise.all(uploadPromises);
  },

  ensureVideoUploaded() {
    const video = this.data.video || {};
    if (video.fileId && video.uploadStatus === 'uploaded') {
      logVideoFlow('09 视频已经上传，直接复用结果', {
        traceId: this._videoTraceId,
        fileName: video.fileName
      });
      return Promise.resolve(video);
    }

    if (!video.tempFilePath) {
      logVideoFlow('09 无法上传：缺少临时文件路径', { traceId: this._videoTraceId }, 'error');
      return Promise.reject(new Error('请先选择MP4视频'));
    }

    const edition = (getApp().globalData && getApp().globalData.currentEdition) || { editionId: 'pottery-2026' };
    const submissionId = this.data.submissionId || `draft_${Date.now()}`;
    const safeName = (video.fileName || `video_${Date.now()}.mp4`).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    const cloudPath = `exhibitions/${edition.editionId}/submissions/${submissionId}/video/${Date.now()}_${safeName}`;
    logVideoFlow('09 已生成云存储上传任务', {
      traceId: this._videoTraceId,
      editionId: edition.editionId,
      fileName: video.fileName,
      sizeBytes: video.sizeBytes,
      cloudDirectory: `exhibitions/${edition.editionId}/submissions/<draft>/video/`
    });

    const uploadingVideo = {
      ...video,
      uploadStatus: 'uploading'
    };
    this.setData({
      video: uploadingVideo,
      videoUploading: true,
      videoUploadProgress: 0,
      videoLocalIssue: ''
    });

    return new Promise((resolve, reject) => {
      const uploadTask = wx.cloud.uploadFile({
        cloudPath,
        filePath: video.tempFilePath,
        success: res => {
          logVideoFlow('09 uploadFile success 回调', {
            traceId: this._videoTraceId,
            hasFileId: Boolean(res && res.fileID)
          });
          const uploadedVideo = {
            ...video,
            fileId: res.fileID,
            tempFilePath: video.tempFilePath,
            uploadStatus: 'uploaded',
            uploadedAt: Date.now()
          };
          this.setData({
            video: uploadedVideo,
            videoUploading: false,
            videoUploadProgress: 100,
            videoLocalIssue: ''
          });
          resolve(uploadedVideo);
        },
        fail: err => {
          logVideoFlow('09 uploadFile fail 回调', {
            traceId: this._videoTraceId,
            error: summarizeVideoError(err)
          }, 'error');
          console.error('视频上传失败:', err);
          const errorMessage = getVideoUploadErrorMessage(err);
          this.setData({
            video: {
              ...video,
              uploadStatus: 'failed'
            },
            videoUploading: false,
            videoLocalIssue: errorMessage
          });
          reject(err);
        }
      });

      if (uploadTask && uploadTask.onProgressUpdate) {
        this._lastVideoProgressLog = -10;
        uploadTask.onProgressUpdate(progress => {
          const progressValue = Number(progress.progress || 0);
          if (progressValue >= this._lastVideoProgressLog + 10 || progressValue === 100) {
            this._lastVideoProgressLog = progressValue;
            logVideoFlow('09 上传进度', {
              traceId: this._videoTraceId,
              progress: progressValue,
              totalBytesSent: Number(progress.totalBytesSent || 0),
              totalBytesExpectedToSend: Number(progress.totalBytesExpectedToSend || 0)
            });
          }
          this.setData({
            videoUploadProgress: progressValue
          });
          wx.showLoading({
            title: `上传 ${progressValue}%`,
            mask: true
          });
        });
      }
    });
  },
  
  // 保存提交数据到数据库
  saveSubmissionData(photoFileID, perspectiveFileID, fourViewFileIDs, detailFileIDs, uploadedVideo) {
    const type = this.data.isEditMode ? 'updatePotterySubmission' : 'createPotterySubmission';
    const submittedVideo = uploadedVideo
      && uploadedVideo.fileId
      && uploadedVideo.uploadStatus === 'uploaded'
      ? uploadedVideo
      : {
          fileId: '',
          fileName: '',
          sizeBytes: 0,
          format: '',
          durationSeconds: 0,
          width: 0,
          height: 0,
          aspectRatio: '',
          uploadStatus: 'ready',
          uploadedAt: null
        };
    const submissionData = {
      // 个人信息
      name: this.data.name,
      gender: this.data.gender,
      school: this.data.school,
      schoolProvinces: this.data.schoolProvince,
      grade: this.data.grade,
      birthDate: this.data.birthDate,
      major: this.data.major,
      phone: this.data.phone,
      email: this.data.email,
      idNumber: this.data.idNumber,
      teacher: this.data.teacher,
      teacherPhone: this.data.teacherPhone,
      address: this.data.address,
      photoUrl: photoFileID,
      
      // 作品信息
      workType: this.data.workType,
      artworkName: this.data.artworkName,
      createYear: this.data.createYear,
      dimensions: this.data.dimensions,
      category: this.data.category,
      craftMaterial: this.data.craftMaterial,
      artworkDescription: this.data.artworkDescription,
      // 分类图片
      perspectiveImage: perspectiveFileID,
      fourViewImages: fourViewFileIDs,
      detailImages: detailFileIDs,
      specialDisplay: this.data.specialDisplay,
      // 视频作品字段
      videoDuration: this.data.videoDuration,
      videoResolution: this.data.videoResolution,
      videoAspectRatio: this.data.videoAspectRatio,
      shootingTechnique: this.data.shootingTechnique,
      baiduCloudLink: this.data.baiduCloudLink,
      baiduCloudPassword: this.data.baiduCloudPassword,
      video: submittedVideo,
    };

    // 如果是编辑模式，添加ID
    if (this.data.isEditMode) {
      submissionData.submissionId = this.data.submissionId;
    }
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: type,
        data: submissionData
      },
      success: result => {
        logVideoFlow('报名云函数返回', {
          traceId: this._videoTraceId || '',
          callSuccess: true,
          businessSuccess: Boolean(result.result && result.result.success),
          errMsg: String((result.result && result.result.errMsg) || '')
        });
        wx.hideLoading();
        
        if (result.result && result.result.success) {
          this.setData({ submitting: false });
          
          wx.showToast({
            title: this.data.isEditMode ? '更新成功' : '提交成功',
            icon: 'success',
            duration: 2000
          });
          
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        } else {
          // 提交失败，重置状态并提示用户
          this.setData({ submitting: false });
          const errorMsg = (result.result && result.result.errMsg) || (this.data.isEditMode ? '更新失败，请重试' : '提交失败，请重试');
          this.showToast(errorMsg);
        }
      },
      fail: err => {
        logVideoFlow('报名云函数调用失败', {
          traceId: this._videoTraceId || '',
          error: summarizeVideoError(err)
        }, 'error');
        console.error('云函数调用失败', err);
        wx.hideLoading();
        this.setData({ submitting: false });
        this.showToast('网络错误，请重试');
      }
    });
  },
  
  // 显示toast提示
  showToast(title) {
    wx.showToast({
      title,
      icon: 'none'
    });
  }
})
