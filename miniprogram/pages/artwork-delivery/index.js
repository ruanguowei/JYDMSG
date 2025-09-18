// pages/artwork-delivery/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 运送方式选项
    deliveryMethods: ['快递', '自送', '委托他人送达'],
    deliveryMethodIndex: -1,
    
    // 快递公司选项
    expressCompanies: ['自送', '顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', 'EMS', '京东物流', '德邦物流', '其他'],
    expressCompanyIndex: -1,
    
    // 基本信息确认字段
    name: '',
    artworkName: '',
    school: '',
    
    // 表单数据
    trackingNumber: '',
    sendDate: '',
    estimatedArrival: '',
    packageCount: '1',
    remarks: '',
    
    // 图片数据
    packageImages: [],
    artworkImages: [],
    packageImagesDisplay: [], // 用于显示的临时URL
    artworkImagesDisplay: [], // 用于显示的临时URL
    packageImagesOriginal: [], // 原始的云文件ID
    artworkImagesOriginal: [], // 原始的云文件ID
    packageImageFileIDs: [], // 云存储中的文件ID
    artworkImageFileIDs: [], // 云存储中的文件ID
    
    // 弹窗控制
    showSuccessModal: false,
    showErrorModal: false,
    errorMessage: '',
    showDetailModal: false, // 详情弹窗

    // 控制表单提交状态
    isSubmitting: false,
    
    // 控制视图模式
    viewMode: false, // 是否是查看模式
    currentId: '', // 当前查看的记录ID
    
    // 控制编辑模式
    isEditing: false, // 是否处于编辑模式
    isEditMode: false, // 是否是编辑模式
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    // 检查是否是编辑模式
    if (options.mode === 'edit' && options.id) {
      // 设置页面标题为编辑模式
      wx.setNavigationBarTitle({
        title: '修改运送信息'
      });
      
      // 从缓存中获取运送数据
      const editDelivery = wx.getStorageSync('editDelivery');
      
      if (editDelivery) {
        // 查找运送方式索引
        let deliveryMethodIndex = this.data.deliveryMethods.findIndex(item => item === editDelivery.deliveryMethod);
        if (deliveryMethodIndex === -1) deliveryMethodIndex = 0;
        
        // 查找快递公司索引
        let expressCompanyIndex = this.data.expressCompanies.findIndex(item => item === editDelivery.expressCompany);
        if (expressCompanyIndex === -1) expressCompanyIndex = 0;
        
        // 处理图片数组
        let packageImages = editDelivery.packageImages || [];
        let artworkImages = editDelivery.artworkImages || [];
        
        // 确保是数组类型
        if (!Array.isArray(packageImages)) {
          packageImages = [];
        }
        if (!Array.isArray(artworkImages)) {
          artworkImages = [];
        }
        
        // 设置表单数据
        this.setData({
          // 基本信息确认
          name: editDelivery.name || '',
          artworkName: editDelivery.artworkName || '',
          school: editDelivery.school || '',
          
          // 运送信息
          deliveryMethodIndex,
          expressCompanyIndex,
          trackingNumber: editDelivery.trackingNumber || '',
          sendDate: editDelivery.sendDate || '',
          estimatedArrival: editDelivery.estimatedArrival || '',
          packageCount: editDelivery.packageCount || '1',
          remarks: editDelivery.remarks || '',
          packageImages: packageImages, // 保存云文件ID用于提交
          artworkImages: artworkImages, // 保存云文件ID用于提交
          
          // 编辑模式
          isEditMode: true,
          currentId: options.id
        });
        
        // 加载云存储图片的临时链接用于显示
        this.loadCloudImages(packageImages, 'packageImages');
        this.loadCloudImages(artworkImages, 'artworkImages');
      }
    }
    
    // 检查是否是查看模式（保留原有逻辑）
    if (options.mode === 'view' && options.id) {
      this.setData({
        viewMode: true,
        currentId: options.id
      });
      
      // 如果是编辑模式，直接设置isEditing为true
      if (options.edit === 'true') {
        this.setData({
          isEditing: true
        });
      }
      
      // 加载运送记录详情
      this.loadDeliveryDetail(options.id);
    }
  },

  // 加载运送记录详情
  loadDeliveryDetail: function(id) {
    wx.showLoading({
      title: '加载中...',
    });
    
    const db = wx.cloud.database();
    db.collection('artwork_deliveries')
      .doc(id)
      .get()
      .then(res => {
        wx.hideLoading();
        const data = res.data;
        
        // 查找快递方式索引
        let deliveryMethodIndex = this.data.deliveryMethods.findIndex(item => item === data.deliveryMethod);
        if (deliveryMethodIndex === -1) deliveryMethodIndex = 0;
        
        // 查找快递公司索引
        let expressCompanyIndex = this.data.expressCompanies.findIndex(item => item === data.expressCompany);
        if (expressCompanyIndex === -1) expressCompanyIndex = 0;
        
        // 处理图片文件ID数组格式
        let packageImages = data.packageImages || [];
        let artworkImages = data.artworkImages || [];
        
        // 如果存储的是字符串形式的数组，转换为实际数组
        if (typeof packageImages === 'string') {
          try {
            packageImages = JSON.parse(packageImages);
          } catch (e) {
            console.error('解析packageImages失败', e);
            packageImages = [];
          }
        }
        
        if (typeof artworkImages === 'string') {
          try {
            artworkImages = JSON.parse(artworkImages);
          } catch (e) {
            console.error('解析artworkImages失败', e);
            artworkImages = [];
          }
        }
        
        // 确保是数组类型
        if (!Array.isArray(packageImages)) {
          packageImages = [];
        }
        if (!Array.isArray(artworkImages)) {
          artworkImages = [];
        }
        
        // 设置表单数据
        this.setData({
          // 基本信息确认
          name: data.name || '',
          artworkName: data.artworkName || '',
          school: data.school || '',
          
          // 运送信息
          deliveryMethodIndex,
          expressCompanyIndex,
          trackingNumber: data.trackingNumber || '',
          sendDate: data.sendDate || '',
          estimatedArrival: data.estimatedArrival || '',
          packageCount: data.packageCount || '1',
          remarks: data.remarks || '',
          packageImages: packageImages,
          artworkImages: artworkImages,
          showDetailModal: true // 显示详情弹窗
        });
        // 加载图片临时链接，确保图片能正常显示
        this.loadCloudImages(packageImages, 'packageImages');
        this.loadCloudImages(artworkImages, 'artworkImages');
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '加载失败',
          icon: 'error'
        });
        console.error('加载运送记录失败', err);
      });
  },
  
  // 加载云存储图片
  loadCloudImages: function(fileIDs, targetField) {
    if (!fileIDs || fileIDs.length === 0) {
      return;
    }
    
    const images = fileIDs.map(fileID => {
      return new Promise((resolve) => {
        wx.cloud.getTempFileURL({
          fileList: [fileID],
          success: res => {
            resolve({
              fileID: fileID,
              tempURL: res.fileList[0].tempFileURL
            });
          },
          fail: () => {
            resolve({
              fileID: fileID,
              tempURL: fileID // 如果获取临时URL失败，使用原始fileID
            });
          }
        });
      });
    });
    
    Promise.all(images).then(results => {
      // 为显示创建临时URL数组
      const tempUrls = results.map(item => item.tempURL).filter(url => url);
      
      // 根据目标字段设置显示用的临时URL
      if (targetField === 'packageImages') {
        this.setData({
          packageImagesDisplay: tempUrls,
          packageImagesOriginal: fileIDs // 保存原始的云文件ID
        });
      } else if (targetField === 'artworkImages') {
        this.setData({
          artworkImagesDisplay: tempUrls,
          artworkImagesOriginal: fileIDs // 保存原始的云文件ID
        });
      }
    });
  },
  
  // 关闭详情弹窗
  closeDetailModal: function() {
    this.setData({
      showDetailModal: false
    });
  },
  
  // 删除运送记录
  deleteDelivery: function() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此运送记录吗？删除后无法恢复。',
      confirmColor: '#FF0000',
      success: res => {
        if (res.confirm) {
          this.performDelete();
        }
      }
    });
  },
  
  // 执行删除操作
  performDelete: function() {
    wx.showLoading({
      title: '删除中...',
    });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'deleteArtworkDelivery',
        id: this.data.currentId
      }
    })
    .then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: '删除失败',
          icon: 'error'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
      console.error('删除运送记录失败', err);
    });
  },
  
  // 开始编辑运送记录
  startEditDelivery: function() {
    this.setData({
      isEditing: true,
      showDetailModal: false
    });
  },
  
  // 运送方式选择器变化事件处理
  bindDeliveryMethodChange: function(e) {
    this.setData({
      deliveryMethodIndex: e.detail.value
    });
  },

  // 快递公司选择器变化事件处理
  bindExpressCompanyChange: function(e) {
    this.setData({
      expressCompanyIndex: e.detail.value
    });
  },

  // 输入快递单号
  inputTrackingNumber: function(e) {
    this.setData({
      trackingNumber: e.detail.value
    });
  },

  // 寄出日期选择器变化事件处理
  bindSendDateChange: function(e) {
    this.setData({
      sendDate: e.detail.value
    });
  },

  // 预计到达日期选择器变化事件处理
  bindEstimatedArrivalChange: function(e) {
    this.setData({
      estimatedArrival: e.detail.value
    });
  },

  // 输入包裹数量
  inputPackageCount: function(e) {
    this.setData({
      packageCount: e.detail.value
    });
  },

  // 输入备注说明
  inputRemarks: function(e) {
    this.setData({
      remarks: e.detail.value
    });
  },

  // 输入姓名
  inputName: function(e) {
    this.setData({
      name: e.detail.value
    });
  },

  // 输入作品名称
  inputArtworkName: function(e) {
    this.setData({
      artworkName: e.detail.value
    });
  },

  // 输入学校
  inputSchool: function(e) {
    this.setData({
      school: e.detail.value
    });
  },

  // 选择包裹外观照片
  choosePackageImage: function() {
    const that = this;
    const currentCount = this.data.isEditMode ? this.data.packageImagesDisplay.length : this.data.packageImages.length;
    
    wx.chooseMedia({
      count: 3 - currentCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success(res) {
        const tempFiles = res.tempFiles;
        const newImages = tempFiles.map(file => file.tempFilePath);
        
        if (that.data.isEditMode) {
          // 编辑模式下，新图片添加到两个数组中
          const packageImagesDisplay = [...that.data.packageImagesDisplay, ...newImages];
          const packageImages = [...that.data.packageImages, ...newImages];
          
          that.setData({
            packageImagesDisplay: packageImagesDisplay.slice(0, 3),
            packageImages: packageImages.slice(0, 3)
          });
        } else {
          // 新建模式下，直接添加
          that.setData({
            packageImages: [...that.data.packageImages, ...newImages].slice(0, 3)
          });
        }
      }
    });
  },

  // 预览包裹外观照片
  previewPackageImage: function(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.packageImages[index], 
      urls: this.data.packageImages
    });
  },

  // 删除包裹外观照片
  deletePackageImage: function(e) {
    const index = e.currentTarget.dataset.index;
    
    if (this.data.isEditMode) {
      // 编辑模式下，需要同时处理显示数组和原始数组
      const packageImagesDisplay = this.data.packageImagesDisplay;
      const packageImages = this.data.packageImages;
      
      packageImagesDisplay.splice(index, 1);
      packageImages.splice(index, 1);
      
      this.setData({
        packageImagesDisplay: packageImagesDisplay,
        packageImages: packageImages
      });
    } else {
      // 新建模式下，直接删除
      const packageImages = this.data.packageImages;
      packageImages.splice(index, 1);
      this.setData({
        packageImages: packageImages
      });
    }
  },

  // 选择作品包装照片
  chooseArtworkImage: function() {
    const that = this;
    const currentCount = this.data.isEditMode ? this.data.artworkImagesDisplay.length : this.data.artworkImages.length;
    
    wx.chooseMedia({
      count: 5 - currentCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success(res) {
        const tempFiles = res.tempFiles;
        const newImages = tempFiles.map(file => file.tempFilePath);
        
        if (that.data.isEditMode) {
          // 编辑模式下，新图片添加到两个数组中
          const artworkImagesDisplay = [...that.data.artworkImagesDisplay, ...newImages];
          const artworkImages = [...that.data.artworkImages, ...newImages];
          
          that.setData({
            artworkImagesDisplay: artworkImagesDisplay.slice(0, 5),
            artworkImages: artworkImages.slice(0, 5)
          });
        } else {
          // 新建模式下，直接添加
          that.setData({
            artworkImages: [...that.data.artworkImages, ...newImages].slice(0, 5)
          });
        }
      }
    });
  },

  // 预览作品包装照片
  previewArtworkImage: function(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.artworkImages[index], 
      urls: this.data.artworkImages
    });
  },

  // 删除作品包装照片
  deleteArtworkImage: function(e) {
    const index = e.currentTarget.dataset.index;
    
    if (this.data.isEditMode) {
      // 编辑模式下，需要同时处理显示数组和原始数组
      const artworkImagesDisplay = this.data.artworkImagesDisplay;
      const artworkImages = this.data.artworkImages;
      
      artworkImagesDisplay.splice(index, 1);
      artworkImages.splice(index, 1);
      
      this.setData({
        artworkImagesDisplay: artworkImagesDisplay,
        artworkImages: artworkImages
      });
    } else {
      // 新建模式下，直接删除
      const artworkImages = this.data.artworkImages;
      artworkImages.splice(index, 1);
      this.setData({
        artworkImages: artworkImages
      });
    }
  },

  // 上传图片到云存储
  uploadImagesToCloud: async function(fileList, dirName) {
    const uploadTasks = fileList.map(filePath => {
      const extension = filePath.split('.').pop();
      const cloudPath = `${dirName}/${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
      
      return wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      });
    });
    
    try {
      const uploadResults = await Promise.all(uploadTasks);
      return uploadResults.map(res => res.fileID);
    } catch (error) {
      console.error('上传图片失败', error);
      throw new Error('上传图片失败，请重试');
    }
  },

  // 显示错误消息
  showError: function(message) {
    this.setData({
      showErrorModal: true,
      errorMessage: message,
      isSubmitting: false
    });
  },
  
  // 关闭成功弹窗
  closeSuccessModal: function() {
    this.setData({
      showSuccessModal: false
    });
    
    // 提交成功后跳转到个人中心或其他页面
    wx.switchTab({
      url: '/pages/profile/index'
    });
  },
  
  // 关闭错误弹窗
  closeErrorModal: function() {
    this.setData({
      showErrorModal: false,
      errorMessage: ''
    });
  },
  
  // 跳转到作品运送指南
  navigateToGuide: function() {
    // 跳转到大陶展专区的作品运送指南
    wx.navigateTo({
      url: '/pages/pottery-exhibition/index?guide=delivery'
    });
  },

  // 提交运送信息
  submitDeliveryInfo: async function(e) {
    // 防止重复提交
    if (this.data.isSubmitting) {
      return;
    }

    this.setData({
      isSubmitting: true
    });
    
    try {
      // 验证基本信息字段
      if (!this.data.name.trim()) {
        this.showError('请输入姓名');
        return;
      }
      
      if (!this.data.artworkName.trim()) {
        this.showError('请输入作品名称');
        return;
      }
      
      if (!this.data.school.trim()) {
        this.showError('请输入学校名称');
        return;
      }
      
      // 验证运送信息字段
      if (this.data.deliveryMethodIndex === -1) {
        this.showError('请选择运送方式');
        return;
      }
      
      if (this.data.deliveryMethods[this.data.deliveryMethodIndex] === '快递' && this.data.expressCompanyIndex === -1) {
        this.showError('请选择快递物流公司');
        return;
      }
      
      if (!this.data.trackingNumber) {
        this.showError('请输入快递单号，自送请输入"自送"');
        return;
      }
      
      if (!this.data.sendDate) {
        this.showError('请选择寄出日期');
        return;
      }
      
      if (!this.data.packageCount || this.data.packageCount <= 0) {
        this.showError('请输入有效的包裹数量');
        return;
      }
      
      if (this.data.packageImages.length === 0) {
        this.showError('请上传包裹外观照片');
        return;
      }
      
      if (this.data.artworkImages.length === 0) {
        this.showError('请上传作品包装照片');
        return;
      }
      
      wx.showLoading({
        title: this.data.isEditMode ? '更新中...' : '正在提交...',
      });
      
      // 处理包裹图片上传
      const packageImagesToUpload = this.data.packageImages.filter(img => !img.startsWith('cloud://'));
      const existingPackageImages = this.data.packageImages.filter(img => img.startsWith('cloud://'));
      
      // 处理作品图片上传
      const artworkImagesToUpload = this.data.artworkImages.filter(img => !img.startsWith('cloud://'));
      const existingArtworkImages = this.data.artworkImages.filter(img => img.startsWith('cloud://'));
      
      // 上传新图片
      const [newPackageFileIDs, newArtworkFileIDs] = await Promise.all([
        packageImagesToUpload.length > 0 ? this.uploadImagesToCloud(packageImagesToUpload, 'artwork-delivery/package') : Promise.resolve([]),
        artworkImagesToUpload.length > 0 ? this.uploadImagesToCloud(artworkImagesToUpload, 'artwork-delivery/artwork') : Promise.resolve([])
      ]);
      
      // 合并已有的和新上传的图片ID
      const finalPackageImages = [...existingPackageImages, ...newPackageFileIDs];
      const finalArtworkImages = [...existingArtworkImages, ...newArtworkFileIDs];
      
      // 构建提交数据
      const deliveryData = {
        // 基本信息确认
        name: this.data.name.trim(),
        artworkName: this.data.artworkName.trim(),
        school: this.data.school.trim(),
        
        // 运送信息
        deliveryMethod: this.data.deliveryMethods[this.data.deliveryMethodIndex],
        expressCompany: this.data.expressCompanyIndex !== -1 ? this.data.expressCompanies[this.data.expressCompanyIndex] : '',
        trackingNumber: this.data.trackingNumber,
        sendDate: this.data.sendDate,
        estimatedArrival: this.data.estimatedArrival,
        packageCount: this.data.packageCount,
        remarks: this.data.remarks,
        packageImages: finalPackageImages,
        artworkImages: finalArtworkImages
      };
      
      // 根据模式选择云函数类型
      const type = this.data.isEditMode ? 'updateArtworkDelivery' : 'createArtworkDelivery';
      
      // 如果是编辑模式，添加ID
      if (this.data.isEditMode) {
        deliveryData.id = this.data.currentId;
      } else {
        deliveryData.createTime = new Date();
      }
      
      // 调用云函数
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: type,
          ...deliveryData
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: this.data.isEditMode ? '更新成功' : '提交成功',
          icon: 'success'
        });
        
        // 清空缓存
        if (this.data.isEditMode) {
          wx.removeStorageSync('editDelivery');
        }
        
        // 返回上一页或跳转到个人中心
        setTimeout(() => {
          if (this.data.isEditMode) {
            wx.navigateBack();
          } else {
            wx.switchTab({
              url: '/pages/profile/index'
            });
          }
        }, 1500);
      } else {
        this.showError(res.result.errMsg || (this.data.isEditMode ? '更新失败，请稍后重试' : '提交失败，请稍后重试'));
      }
    } catch (error) {
      wx.hideLoading();
      console.error(this.data.isEditMode ? '更新失败' : '提交失败', error);
      this.showError(this.data.isEditMode ? '更新失败，请稍后重试' : '提交失败，请稍后重试');
    } finally {
      this.setData({
        isSubmitting: false
      });
    }
  },
  
  // 重置表单
  resetForm: function() {
    this.setData({
      // 基本信息确认
      name: '',
      artworkName: '',
      school: '',
      
      // 运送信息
      deliveryMethodIndex: -1,
      expressCompanyIndex: -1,
      trackingNumber: '',
      sendDate: '',
      estimatedArrival: '',
      packageCount: '1',
      remarks: '',
      packageImages: [],
      artworkImages: []
    });
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

  }
})