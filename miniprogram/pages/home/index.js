const app = getApp()

Page({
  data: {
    banners: [],
    notices: [],
    loading: true,
    showModal: false,
    currentNotice: null
  },
  
  onLoad: function() {
    // 页面加载时调用云函数获取最新数据
    this.fetchHomeData();
  },
  
  navigateToAppointment: function() {
    wx.navigateTo({
      url: '/pages/appointment/index'
    })
  },
  
  navigateToPotteryExhibition: function() {
    wx.switchTab({
      url: '/pages/pottery-exhibition/index'
    })
  },
  
  // 显示公告详情弹窗
  showNoticeDetail: function(e) {
    const index = e.currentTarget.dataset.id;
    if (this.data.notices[index]) {
      this.setData({
        currentNotice: this.data.notices[index],
        showModal: true
      });
    }
  },
  
  // 隐藏公告详情弹窗
  hideModal: function() {
    this.setData({
      showModal: false
    });
  },
  
  // 预览PDF文件
  previewPDF: function(e) {
    const url = e.currentTarget.dataset.url;
    const name = e.currentTarget.dataset.name || 'PDF文件';
    
    if (!url) {
      wx.showToast({
        title: '文件链接无效',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '正在加载PDF...'
    });
    
    // 如果是云存储链接，先获取临时访问链接
    if (url.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [url],
        success: res => {
          wx.hideLoading();
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            this.openPDFDocument(res.fileList[0].tempFileURL, name);
          } else {
            wx.showToast({
              title: '获取文件链接失败',
              icon: 'none'
            });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('获取临时文件URL失败:', err);
          wx.showToast({
            title: '获取文件失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 直接使用URL
      wx.hideLoading();
      this.openPDFDocument(url, name);
    }
  },
  
  // 打开PDF文档
  openPDFDocument: function(url, name) {
    wx.downloadFile({
      url: url,
      success: function(res) {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf',
            success: function() {
              console.log('PDF预览成功');
            },
            fail: function(err) {
              console.error('PDF预览失败:', err);
              wx.showToast({
                title: 'PDF预览失败',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '文件下载失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        console.error('文件下载失败:', err);
        wx.showToast({
          title: '文件下载失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 打开其他附件
  openAttachment: function(e) {
    const url = e.currentTarget.dataset.url;
    const type = e.currentTarget.dataset.type;
    const name = e.currentTarget.dataset.name || '附件';
    
    if (!url) {
      wx.showToast({
        title: '文件链接无效',
        icon: 'none'
      });
      return;
    }
    
    if (type === 'image') {
      // 预览图片
      wx.previewImage({
        urls: [url],
        current: url
      });
    } else {
      // 下载并打开文件
      wx.showLoading({
        title: '正在加载文件...'
      });
      
      wx.downloadFile({
        url: url,
        success: function(res) {
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.openDocument({
              filePath: res.tempFilePath,
              success: function() {
                console.log('文件打开成功');
              },
              fail: function(err) {
                console.error('文件打开失败:', err);
                wx.showToast({
                  title: '文件打开失败',
                  icon: 'none'
                });
              }
            });
          } else {
            wx.showToast({
              title: '文件下载失败',
              icon: 'none'
            });
          }
        },
        fail: function(err) {
          wx.hideLoading();
          console.error('文件下载失败:', err);
          wx.showToast({
            title: '文件下载失败',
            icon: 'none'
          });
        }
      });
    }
  },
  
  // 获取首页数据
  fetchHomeData: function(callback) {
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchHomeData'
      },
      success: res => {
        if (res.result && res.result.success) {
          const { banners, announcements } = res.result.data;
          
          this.setData({
            banners: banners || [],
            notices: announcements || [],
            loading: false
          });
        } else {
          console.error('获取首页数据失败', res);
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
      },
      complete: () => {
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  }
}) 