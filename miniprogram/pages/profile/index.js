// pages/profile/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    appointments: [],
    submissions: [],
    deliveries: [],
    showSubmissionDetailsModal: false,
    currentSubmission: null,
    currentSubmissionIndex: -1,
    showDeliveryDetailsModal: false,
    currentDelivery: null,
    currentDeliveryIndex: -1,
    deliveryPackageImages: [],
    deliveryArtworkImages: []
  },

  /**
   * 查看预约页面
   */
  viewAppointments() {
    wx.navigateTo({
      url: '/pages/appointment/index'
    });
  },

  /**
   * 查看参展页面
   */
  viewSubmissions() {
    wx.navigateTo({
      url: '/pages/pottery-submission/index'
    });
  },

  /**
   * 跳转到参展查询页面
   */
  navigateToQuery() {
    wx.navigateTo({
      url: '/pages/pottery-query/index'
    });
  },

  /**
   * 查看运送页面
   */
  viewDeliveries() {
    wx.navigateTo({
      url: '/pages/artwork-delivery/index'
    });
  },
  
  /**
   * 查看预约详情
   */
  viewAppointmentDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/appointment/index?id=${id}&mode=view`
    });
  },
  
  /**
   * 查看作品提交详情
   */
  viewSubmissionDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/pottery-submission/index?id=${id}&mode=view`
    });
  },
  
  /**
   * 显示运送详情弹窗
   */
  showDeliveryDetails(e) {
    const index = e.currentTarget.dataset.index;
    const delivery = this.data.deliveries[index];
    
    // 处理图片数据格式
    let packageImages = delivery.packageImages || [];
    let artworkImages = delivery.artworkImages || [];
    
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
    
    // 更新delivery对象中的图片数组
    const processedDelivery = {
      ...delivery,
      packageImages,
      artworkImages
    };
    
    this.setData({
      currentDelivery: processedDelivery,
      currentDeliveryIndex: index,
      showDeliveryDetailsModal: true
    });
    
    // 加载图片
    this.loadDeliveryImages(processedDelivery);
  },
  
  /**
   * 加载运送图片
   */
  loadDeliveryImages(delivery) {
    if (delivery.packageImages && delivery.packageImages.length > 0) {
      this.getCloudFileUrls(delivery.packageImages, 'deliveryPackageImages');
    } else {
      this.setData({
        deliveryPackageImages: []
      });
    }
    
    if (delivery.artworkImages && delivery.artworkImages.length > 0) {
      this.getCloudFileUrls(delivery.artworkImages, 'deliveryArtworkImages');
    } else {
      this.setData({
        deliveryArtworkImages: []
      });
    }
  },
  
  /**
   * 获取云存储文件URL
   */
  getCloudFileUrls(fileIDs, targetField) {
    wx.cloud.getTempFileURL({
      fileList: fileIDs,
      success: res => {
        const urls = res.fileList.map(file => file.tempFileURL);
        this.setData({
          [targetField]: urls
        });
      },
      fail: err => {
        console.error('获取文件URL失败', err);
        this.setData({
          [targetField]: []
        });
      }
    });
  },
  
  /**
   * 隐藏运送详情弹窗
   */
  hideDeliveryDetails() {
    this.setData({
      showDeliveryDetailsModal: false,
      currentDelivery: null,
      currentDeliveryIndex: -1,
      deliveryPackageImages: [],
      deliveryArtworkImages: []
    });
  },
  
  /**
   * 预览运送图片
   */
  previewDeliveryImage(e) {
    const { url, urls, type } = e.currentTarget.dataset;
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },
  
  /**
   * 删除运送记录
   */
  deleteDelivery(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此运送记录吗？删除后无法恢复。',
      confirmColor: '#FF0000',
      success: res => {
        if (res.confirm) {
          this.performDeleteDelivery(id);
        }
      }
    });
  },
  
  /**
   * 执行删除运送记录
   */
  performDeleteDelivery(id) {
    wx.showLoading({
      title: '删除中...',
    });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'deleteArtworkDelivery',
        id: id
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 重新加载数据
        this.getUserData();
      } else {
        wx.showToast({
          title: '删除失败',
          icon: 'error'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('删除运送记录失败', err);
      
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    });
  },
  
  /**
   * 修改运送信息
   */
  editDelivery() {
    const delivery = this.data.currentDelivery;
    
    // 将运送数据存储到缓存中，供修改页面使用
    wx.setStorageSync('editDelivery', delivery);
    
    this.hideDeliveryDetails();
    
    // 跳转到运送页面，并传递编辑模式参数
    wx.navigateTo({
      url: `/pages/artwork-delivery/index?mode=edit&id=${delivery._id}`
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取用户数据
    this.getUserData();
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
    // 每次页面显示时更新数据，稍微延迟确保openid已获取
    setTimeout(() => {
      this.getUserData();
    }, 500);
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
    // 下拉刷新时更新数据
    this.getUserData().then(() => {
      wx.stopPullDownRefresh();
    });
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

  /**
   * 获取用户openid
   */
  getOpenid() {
    // 首先尝试从app.globalData获取
    const app = getApp();
    if (app.globalData.openid) {
      return app.globalData.openid;
    }
    
    // 如果globalData中没有，调用app的getOpenid方法
    app.getOpenid();
    // 返回一个占位值，实际上查询会失败，但getOpenid方法会更新本地存储
    // 用户需要刷新页面才能看到数据
    return '';
  },

  /**
   * 获取用户数据
   */
  getUserData() {
    console.log('开始获取用户数据...');
    wx.showLoading({
      title: '加载中',
    });

    return new Promise(async (resolve, reject) => {
      try {
        // 优先从多个来源获取openid
        let openid = wx.getStorageSync('openid') || getApp().globalData.openid;
        console.log('从本地存储获取的openid:', wx.getStorageSync('openid'));
        console.log('从app.globalData获取的openid:', getApp().globalData.openid);
        console.log('最终使用的openid:', openid);
        
        // 如果还是没有openid，调用app.js的方法获取
        if (!openid) {
          console.log('没有openid，调用app.getOpenid()获取');
          const app = getApp();
          
          // 调用app.js中的getOpenid方法
          await new Promise((resolve) => {
            app.getOpenid();
            // 等待一段时间让openid获取完成
            setTimeout(() => {
              openid = wx.getStorageSync('openid') || app.globalData.openid;
              console.log('等待后获取的openid:', openid);
              resolve();
            }, 2000);
          });
        }
        
        // 如果还是没有openid，直接调用云函数获取
        if (!openid) {
          console.log('仍然没有openid，直接调用云函数获取');
          const loginRes = await wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: {
              type: 'getOpenId'
            }
          });
          
          console.log('云函数getOpenId返回结果:', loginRes);
          
          if (loginRes.result && loginRes.result.openid) {
            openid = loginRes.result.openid;
            wx.setStorageSync('openid', openid);
            getApp().globalData.openid = openid;
            console.log('获取到openid并存储:', openid);
          } else {
            console.error('获取openid失败，云函数返回:', loginRes);
            wx.hideLoading();
            wx.showToast({
              title: '获取用户信息失败',
              icon: 'error'
            });
            reject('获取openid失败');
            return;
          }
        }
        
        console.log('最终确定使用的openid:', openid);
        
        const db = wx.cloud.database();
        
        // 获取预约记录
        console.log('开始查询预约记录...');
        const appointmentsPromise = db.collection('appointments')
          .where({
            _openid: openid
          })
          .orderBy('createTime', 'desc')
          .limit(5)
          .get()
          .then(res => {
            console.log('预约记录查询结果:', res.data);
            console.log('预约记录数量:', res.data.length);
            
            // 过滤只保留今天及以后的预约
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            console.log('今天的日期:', today);
            
            const filteredAppointments = res.data.filter(appointment => {
              try {
                // 更可靠的日期解析方式
                let appointmentDate;
                
                // 如果date字段是标准日期格式（YYYY-MM-DD）
                if (appointment.date && appointment.date.includes('-')) {
                  appointmentDate = new Date(appointment.date);
                } 
                // 如果是中文格式（2025年1月15日）
                else if (appointment.date && appointment.date.includes('年')) {
                  const dateStr = appointment.date.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
                  appointmentDate = new Date(dateStr);
                } 
                // 其他格式尝试直接解析
                else {
                  appointmentDate = new Date(appointment.date);
                }
                
                // 检查日期是否有效
                if (isNaN(appointmentDate.getTime())) {
                  console.warn('无效的预约日期:', appointment.date);
                  return true; // 如果日期无效，保留记录
                }
                
                appointmentDate.setHours(0, 0, 0, 0);
                const isValid = appointmentDate >= today;
                
                console.log('预约日期:', appointment.date, '转换后:', appointmentDate, '是否>=今天:', isValid);
                return isValid;
                
              } catch (error) {
                console.error('日期解析错误:', error, '原始日期:', appointment.date);
                return true; // 如果解析出错，保留记录
              }
            });
            
            console.log('过滤后的预约记录:', filteredAppointments);
            console.log('过滤后的预约记录数量:', filteredAppointments.length);
            
            this.setData({
              appointments: filteredAppointments
            });
          })
          .catch(err => {
            console.error('获取预约记录失败', err);
          });
        
        // 获取作品提交记录
        console.log('开始查询作品提交记录...');
        const submissionsPromise = db.collection('pottery_submissions')
          .where({
            _openid: openid
          })
          .get()
          .then(res => {
            console.log('作品提交记录查询结果:', res.data);
            console.log('作品提交记录数量:', res.data.length);
            
            this.setData({
              submissions: res.data
            });
          })
          .catch(err => {
            console.error('获取作品记录失败', err);
          });
          
        // 获取作品运送记录
        console.log('开始查询运送记录...');
        const deliveriesPromise = db.collection('artwork_deliveries')
          .where({
            _openid: openid
          })
          .get()
          .then(res => {
            console.log('运送记录查询结果:', res.data);
            console.log('运送记录数量:', res.data.length);
            
            // 处理运送记录数据，确保图片字段为数组类型
            const processedDeliveries = res.data.map(delivery => {
              // 处理包裹图片
              let packageImages = delivery.packageImages || [];
              if (typeof packageImages === 'string') {
                try {
                  packageImages = JSON.parse(packageImages);
                } catch (e) {
                  console.error('解析packageImages失败', e);
                  packageImages = [];
                }
              }
              if (!Array.isArray(packageImages)) {
                packageImages = [];
              }

              // 处理作品图片
              let artworkImages = delivery.artworkImages || [];
              if (typeof artworkImages === 'string') {
                try {
                  artworkImages = JSON.parse(artworkImages);
                } catch (e) {
                  console.error('解析artworkImages失败', e);
                  artworkImages = [];
                }
              }
              if (!Array.isArray(artworkImages)) {
                artworkImages = [];
              }

              // 返回处理后的数据
              return {
                ...delivery,
                packageImages,
                artworkImages
              };
            });

            this.setData({
              deliveries: processedDeliveries
            });
          })
          .catch(err => {
            console.error('获取运送记录失败', err);
          });
        
        // 等待所有数据加载完成
        console.log('等待所有查询完成...');
        await Promise.all([appointmentsPromise, submissionsPromise, deliveriesPromise]);
        
        console.log('所有数据加载完成');
        wx.hideLoading();
        resolve();
        
      } catch (err) {
        wx.hideLoading();
        console.error('加载数据失败', err);
        wx.showToast({
          title: '加载数据失败',
          icon: 'error'
        });
        reject(err);
      }
    });
  },

  /**
   * 显示作品详情
   */
  showSubmissionDetails(e) {
    const index = e.currentTarget.dataset.index;
    const submission = this.data.submissions[index];
    
    this.setData({
      showSubmissionDetailsModal: true,
      currentSubmission: submission,
      currentSubmissionIndex: index
    });
  },

  /**
   * 隐藏作品详情
   */
  hideSubmissionDetails() {
    this.setData({
      showSubmissionDetailsModal: false,
      currentSubmission: null,
      currentSubmissionIndex: -1
    });
  },

  /**
   * 预览作品图片
   */
  previewSubmissionImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },
  
  /**
   * 删除预约
   */
  deleteAppointment(e) {
    const id = e.currentTarget.dataset.id;
    const date = e.currentTarget.dataset.date;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除${date}的预约吗？`,
      confirmColor: '#FF0000',
      success: res => {
        if (res.confirm) {
          this.performDeleteAppointment(id);
        }
      }
    });
  },
  
  /**
   * 执行删除预约
   */
  performDeleteAppointment(id) {
    wx.showLoading({
      title: '删除中...',
    });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'deleteAppointment',
        id: id
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 重新加载数据
        this.getUserData();
      } else {
        wx.showToast({
          title: '删除失败',
          icon: 'error'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('删除预约失败', err);
      
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    });
  }
})