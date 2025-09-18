// pages/pottery-submission/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
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
    categories: ['技艺', '文脉', '算法', '产业', '视界'],
    craftMaterial: '', // 作品工艺材料（最多20字）
    artworkDescription: '',
    // 分类上传的图片
    perspectiveImage: '', // 透视图（1张）
    fourViewImages: [], // 四面图（3张）
    detailImages: [], // 局部图（3张）
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
    
    // 其他状态
    submitting: false,
    isEditMode: false,
    submissionId: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
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
          category: editSubmission.category || '',
          categoryIndex: this.data.categories.indexOf(editSubmission.category),
          craftMaterial: editSubmission.craftMaterial || '',
          artworkDescription: editSubmission.artworkDescription || '',
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
          
          // 编辑模式
          isEditMode: true,
          submissionId: options.id
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
    this.setData({
      categoryIndex: e.detail.value,
      category: this.data.categories[e.detail.value]
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
    this.setData({ artworkDescription: e.detail.value })
  },
  
  inputSpecialDisplay(e) {
    this.setData({ specialDisplay: e.detail.value })
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
  
  // 分类图片上传方法
  choosePerspectiveImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ perspectiveImage: res.tempFilePaths[0] });
      }
    });
  },
  
  removePerspectiveImage() {
    this.setData({ perspectiveImage: '' });
  },
  
  chooseFourViewImages() {
    const remaining = 3 - this.data.fourViewImages.length;
    if (remaining <= 0) {
      wx.showToast({
        title: '四面图最多3张',
        icon: 'none'
      });
      return;
    }
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const images = [...this.data.fourViewImages, ...res.tempFilePaths];
        this.setData({ fourViewImages: images });
      }
    });
  },
  
  removeFourViewImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.fourViewImages];
    images.splice(index, 1);
    this.setData({ fourViewImages: images });
  },
  
  chooseDetailImages() {
    const remaining = 3 - this.data.detailImages.length;
    if (remaining <= 0) {
      wx.showToast({
        title: '局部图最多3张',
        icon: 'none'
      });
      return;
    }
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const images = [...this.data.detailImages, ...res.tempFilePaths];
        this.setData({ detailImages: images });
      }
    });
  },
  
  removeDetailImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.detailImages];
    images.splice(index, 1);
    this.setData({ detailImages: images });
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
      if (!this.data.perspectiveImage) {
        this.showToast('请上传透视图')
        return false
      }
      if (this.data.fourViewImages.length === 0) {
        this.showToast('请至少上传一张四面图')
        return false
      }
      if (this.data.detailImages.length === 0) {
        this.showToast('请至少上传一张局部图')
        return false
      }
    } else if (this.data.workType === 'video') {
      // 视频作品：检查视频相关字段
      if (!this.data.videoDuration) {
        this.showToast('请填写视频时长')
        return false
      }
      if (!this.data.videoResolution) {
        this.showToast('请选择视频清晰度')
        return false
      }
      if (!this.data.videoAspectRatio) {
        this.showToast('请选择视频比例')
        return false
      }
      if (!this.data.shootingTechnique) {
        this.showToast('请填写拍摄技巧')
        return false
      }
      if (!this.data.baiduCloudLink) {
        this.showToast('请填写百度云链接')
        return false
      }
      if (!this.data.baiduCloudPassword) {
        this.showToast('请填写百度云密码')
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
    
    const fourViewToUpload = this.data.fourViewImages.filter(img => 
      img && !img.startsWith('cloud://') && !(img.startsWith('http://') && !img.startsWith('http://tmp/')) && !img.startsWith('https://')
    );
    const existingFourViewImages = this.data.fourViewImages.filter(img => 
      img && (img.startsWith('cloud://') || (img.startsWith('http://') && !img.startsWith('http://tmp/')) || img.startsWith('https://'))
    );
    
    const detailToUpload = this.data.detailImages.filter(img => 
      img && !img.startsWith('cloud://') && !(img.startsWith('http://') && !img.startsWith('http://tmp/')) && !img.startsWith('https://')
    );
    const existingDetailImages = this.data.detailImages.filter(img => 
      img && (img.startsWith('cloud://') || (img.startsWith('http://') && !img.startsWith('http://tmp/')) || img.startsWith('https://'))
    );

    console.log('准备上传的文件:', {
      personalPhoto: this.data.photoUrl,
      perspectiveImage: this.data.perspectiveImage,
      fourViewToUpload,
      detailToUpload
    });

    Promise.all([
      uploadPersonalPhoto,
      perspectiveToUpload,
      this.uploadMultipleFiles(fourViewToUpload, 'artwork_photos'),
      this.uploadMultipleFiles(detailToUpload, 'artwork_photos')
    ]).then(([photoFileID, perspectiveFileID, newFourViewFileIDs, newDetailFileIDs]) => {
      console.log('上传完成:', {
        photoFileID,
        perspectiveFileID,
        newFourViewFileIDs,
        newDetailFileIDs
      });
      
      // 合并已有的和新上传的图片ID
      const fourViewFileIDs = [...existingFourViewImages, ...newFourViewFileIDs];
      const detailFileIDs = [...existingDetailImages, ...newDetailFileIDs];
      
      // 保存表单数据到数据库
      return this.saveSubmissionData(photoFileID, perspectiveFileID, fourViewFileIDs, detailFileIDs);
    }).catch(err => {
      console.error('上传失败', err);
      wx.hideLoading();
      this.setData({ submitting: false });
      
      // 提供更详细的错误信息
      let errorMessage = '图片上传失败，请重试';
      if (err.message) {
        errorMessage = err.message;
      } else if (err.errMsg) {
        errorMessage = err.errMsg;
      }
      
      this.showToast(errorMessage);
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
          const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2)}.jpg`;
          
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
  
  // 保存提交数据到数据库
  saveSubmissionData(photoFileID, perspectiveFileID, fourViewFileIDs, detailFileIDs) {
    const type = this.data.isEditMode ? 'updatePotterySubmission' : 'createPotterySubmission';
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
        wx.hideLoading();
        this.setData({ submitting: false });
        
        if (result.result && result.result.success) {
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
          this.showToast(this.data.isEditMode ? '更新失败，请重试' : '提交失败，请重试');
        }
      },
      fail: err => {
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