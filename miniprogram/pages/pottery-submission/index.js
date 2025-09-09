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
    artworkName: '',
    createYear: '',
    length: '', // 作品长度
    width: '',  // 作品宽度
    height: '', // 作品高度
    category: '',
    categoryIndex: null,
    categories: ['技艺', '文脉', '算法', '产业', '视界'],
    craftMaterial: '', // 作品工艺材料
    artworkDescription: '',
    artworkImages: [], // 作品图片列表
    
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
        // 设置表单数据
        this.setData({
          // 个人信息
          name: editSubmission.name || '',
          gender: editSubmission.gender || '',
          genderIndex: this.data.genders.indexOf(editSubmission.gender),
          school: editSubmission.school || '',
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
          artworkName: editSubmission.artworkName || '',
          createYear: editSubmission.createYear || '',
          length: editSubmission.dimensions?.length || '',
          width: editSubmission.dimensions?.width || '',
          height: editSubmission.dimensions?.height || '',
          category: editSubmission.category || '',
          categoryIndex: this.data.categories.indexOf(editSubmission.category),
          craftMaterial: editSubmission.craftMaterial || '',
          artworkDescription: editSubmission.artworkDescription || '',
          artworkImages: editSubmission.artworkImages || [],
          
          // 编辑模式
          isEditMode: true,
          submissionId: options.id
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
  inputArtworkName(e) {
    this.setData({ artworkName: e.detail.value })
  },
  
  bindCreateYearChange(e) {
    // 只保留年份
    const year = e.detail.value.split('-')[0]
    this.setData({ createYear: year })
  },
  
  inputLength(e) {
    this.setData({ length: e.detail.value })
  },
  
  inputWidth(e) {
    this.setData({ width: e.detail.value })
  },
  
  inputHeight(e) {
    this.setData({ height: e.detail.value })
  },
  
  bindCategoryChange(e) {
    this.setData({
      categoryIndex: e.detail.value,
      category: this.data.categories[e.detail.value]
    })
  },
  
  inputCraftMaterial(e) {
    this.setData({ craftMaterial: e.detail.value })
  },
  
  inputArtworkDescription(e) {
    this.setData({ artworkDescription: e.detail.value })
  },
  
  // 作品图片上传
  chooseImage() {
    wx.chooseImage({
      count: 9 - this.data.artworkImages.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths
        this.setData({
          artworkImages: [...this.data.artworkImages, ...tempFilePaths]
        })
      }
    })
  },
  
  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.artworkImages
    images.splice(index, 1)
    this.setData({ artworkImages: images })
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
    if (!this.data.length || !this.data.width || !this.data.height) {
      this.showToast('请完整填写作品尺寸')
      return false
    }
    if (!this.data.category) {
      this.showToast('请选择作品类别')
      return false
    }
    if (!this.data.craftMaterial) {
      this.showToast('请填写作品工艺和材料')
      return false
    }
    if (!this.data.artworkDescription) {
      this.showToast('请填写作品简介')
      return false
    }
    if (this.data.artworkImages.length === 0) {
      this.showToast('请至少上传一张作品照片')
      return false
    }
    
    return true
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
    // 检查照片是否已经是云存储的路径 (cloud://开头)
    const uploadPersonalPhoto = this.data.photoUrl && !this.data.photoUrl.startsWith('cloud://') ? 
      this.uploadSingleFile(this.data.photoUrl, 'personal_photos') : 
      Promise.resolve(this.data.photoUrl);

    // 准备上传多个作品图片
    const artworkImagesToUpload = this.data.artworkImages.filter(img => !img.startsWith('cloud://'));
    const existingArtworkImages = this.data.artworkImages.filter(img => img.startsWith('cloud://'));

    Promise.all([
      uploadPersonalPhoto,
      this.uploadMultipleFiles(artworkImagesToUpload, 'artwork_photos')
    ]).then(([photoFileID, newArtworkFileIDs]) => {
      // 合并已有的和新上传的图片ID
      const artworkFileIDs = [...existingArtworkImages, ...newArtworkFileIDs];
      
      // 保存表单数据到数据库
      return this.saveSubmissionData(photoFileID, artworkFileIDs);
    }).catch(err => {
      console.error('上传失败', err);
      wx.hideLoading();
      this.setData({ submitting: false });
      this.showToast('图片上传失败，请重试');
    });
  },
  
  // 上传单个文件
  uploadSingleFile(filePath, folder) {
    return new Promise((resolve, reject) => {
      const cloudPath = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2)}.jpg`;
      
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: res => resolve(res.fileID),
        fail: err => reject(err)
      });
    });
  },
  
  // 上传多个文件
  uploadMultipleFiles(filePaths, folder) {
    const uploadPromises = filePaths.map(filePath => 
      this.uploadSingleFile(filePath, folder)
    );
    
    return Promise.all(uploadPromises);
  },
  
  // 保存提交数据到数据库
  saveSubmissionData(photoFileID, artworkFileIDs) {
    const type = this.data.isEditMode ? 'updatePotterySubmission' : 'createPotterySubmission';
    const submissionData = {
      // 个人信息
      name: this.data.name,
      gender: this.data.gender,
      school: this.data.school,
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
      artworkName: this.data.artworkName,
      createYear: this.data.createYear,
      dimensions: {
        length: this.data.length,
        width: this.data.width,
        height: this.data.height
      },
      category: this.data.category,
      craftMaterial: this.data.craftMaterial,
      artworkDescription: this.data.artworkDescription,
      artworkImages: artworkFileIDs,
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