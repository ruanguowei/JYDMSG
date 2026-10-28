const app = getApp()
const { buildBannerImage } = require('../../utils/banner-image');

Page({
  data: {
    banners: [],
    hasBanners: false,
    bannerCurrent: 0,
    bannerAutoplay: false,
    notices: [],
    visibleNotices: [],
    noticesExpanded: false,
    hasMoreNotices: false,
    noticesEmpty: true,
    loading: true,
    showModal: false,
    currentNotice: null,
    appointmentEnabled: true
  },
  
  onLoad: function() {
    this._isPageActive = true;
    // 页面加载时调用云函数获取最新数据
    this.fetchHomeData();
  },

  onUnload: function() {
    this._isPageActive = false;
    this._homeDataLoading = false;
  },
  
  navigateToAppointment: function() {
    if (this.data.appointmentEnabled === false) {
      wx.showToast({
        title: '预约功能暂未开放',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/appointment/index'
    })
  },
  
  navigateToPotteryExhibition: function() {
    wx.switchTab({
      url: '/pages/pottery-exhibition/index'
    })
  },

  navigateToMuseumResources: function() {
    wx.navigateTo({
      url: '/pages/museum-collections/index'
    });
  },

  onBannerChange: function(e) {
    const current = e.detail.current;
    if (!Number.isInteger(current) || !this.data.banners[current]) return;
    const patch = { bannerCurrent: current };
    patch[`banners[${current}].shouldLoad`] = true;
    if (this.data.banners[current].imageLoaded || this.data.banners[current].imageFailed) {
      patch[`banners[${(current + 1) % this.data.banners.length}].shouldLoad`] = true;
    }
    this.setData(patch);
  },

  onBannerLoad: function(e) {
    const index = Number(e.currentTarget.dataset.index);
    const banner = this.data.banners[index];
    if (!banner || e.currentTarget.dataset.src !== banner.imageUrl) return;
    const patch = {};
    patch[`banners[${index}].imageLoaded`] = true;
    patch[`banners[${index}].imageFailed`] = false;
    // 第一张显示后才轮播，并预加载紧邻的一张，避免同时下载全部横幅。
    if (index === 0) patch.bannerAutoplay = this.data.banners.length > 1;
    const next = (index + 1) % this.data.banners.length;
    if (index === this.data.bannerCurrent) patch[`banners[${next}].shouldLoad`] = true;
    this.setData(patch);
  },

  onBannerError: function(e) {
    const index = Number(e.currentTarget.dataset.index);
    const banner = this.data.banners[index];
    if (!banner || e.currentTarget.dataset.src !== banner.imageUrl) return;
    const patch = {};
    if (banner.imageUrl !== banner.originalImageUrl) {
      patch[`banners[${index}].imageUrl`] = banner.originalImageUrl;
    } else {
      patch[`banners[${index}].imageFailed`] = true;
      if (index === 0) patch.bannerAutoplay = this.data.banners.length > 1;
      const next = (index + 1) % this.data.banners.length;
      if (index === this.data.bannerCurrent) patch[`banners[${next}].shouldLoad`] = true;
    }
    this.setData(patch);
  },
  
  // 展开或收起已加载的公告
  toggleNotices: function() {
    const noticesExpanded = !this.data.noticesExpanded;
    this.setData({
      noticesExpanded,
      visibleNotices: noticesExpanded ? this.data.notices : this.data.notices.slice(0, 3)
    });
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
    const size = e.currentTarget.dataset.size || '';
    
    if (!url) {
      wx.showToast({
        title: '文件链接无效',
        icon: 'none'
      });
      return;
    }
    
    // 检查文件大小并提示用户
    if (size) {
      const sizeInMB = this.parseFileSize(size);
      if (sizeInMB > 10) { // 大于10MB的文件
        wx.showModal({
          title: '文件较大',
          content: '该文件较大，下载可能需要较长时间，是否继续？',
          confirmText: '继续',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.startPDFDownload(url, name, size);
            }
          }
        });
        return;
      }
    }
    
    this.startPDFDownload(url, name, size);
  },
  
  // 开始PDF下载
  startPDFDownload: function(url, name, size) {
    // 显示加载提示（不显示文件大小）
    wx.showLoading({
      title: '正在加载PDF...',
      mask: true
    });
    
    // 如果是云存储链接，先获取临时访问链接
    if (url.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [url],
        success: res => {
          if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
            // 不立即隐藏loading，让openPDFDocument处理
            this.openPDFDocument(res.fileList[0].tempFileURL, name, size);
          } else {
            wx.hideLoading();
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
      this.openPDFDocument(url, name, size);
    }
  },
  
  // 解析文件大小字符串为MB数值
  parseFileSize: function(sizeStr) {
    if (!sizeStr) return 0;
    
    const size = parseFloat(sizeStr);
    const unit = sizeStr.toUpperCase();
    
    if (unit.includes('GB')) {
      return size * 1024;
    } else if (unit.includes('MB')) {
      return size;
    } else if (unit.includes('KB')) {
      return size / 1024;
    } else {
      return size / (1024 * 1024); // 假设是字节
    }
  },
  
  // 打开PDF文档
  openPDFDocument: function(url, name, size) {
    const self = this;
    
    // 更新加载提示（不显示文件大小）
    wx.showLoading({
      title: '正在下载PDF...',
      mask: true
    });
    
    wx.downloadFile({
      url: url,
      success: function(res) {
        wx.hideLoading();
        if (res.statusCode === 200) {
          // 显示预览提示
          wx.showLoading({
            title: '正在打开PDF...',
            mask: true
          });
          
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf',
            success: function() {
              wx.hideLoading();
              console.log('PDF预览成功');
            },
            fail: function(err) {
              wx.hideLoading();
              console.error('PDF预览失败:', err);
              wx.showToast({
                title: 'PDF预览失败',
                icon: 'none',
                duration: 3000
              });
            }
          });
        } else {
          wx.showToast({
            title: '文件下载失败',
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('文件下载失败:', err);
        wx.showToast({
          title: '文件下载失败，请检查网络连接',
          icon: 'none',
          duration: 3000
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
    if (this._homeDataLoading) {
      return;
    }

    this._homeDataLoading = true;
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchHomeData'
      },
      success: res => {
        if (!this._isPageActive) {
          return;
        }

        if (res.result && res.result.success) {
          const { banners, announcements, appointmentEnabled } = res.result.data;
          const notices = announcements || [];
          const displayBanners = (banners || []).filter(banner => banner && banner.imageUrl).map((banner, index) => ({
            ...banner,
            ...buildBannerImage(banner.imageUrl),
            shouldLoad: index === 0
          }));
          
          this.setData({
            banners: displayBanners,
            hasBanners: displayBanners.length > 0,
            bannerCurrent: 0,
            bannerAutoplay: false,
            notices,
            visibleNotices: notices.slice(0, 3),
            noticesExpanded: false,
            hasMoreNotices: notices.length > 3,
            noticesEmpty: notices.length === 0,
            appointmentEnabled: appointmentEnabled !== false, // 默认为 true
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
        if (!this._isPageActive) {
          return;
        }
        this.setData({ loading: false });
        wx.showToast({
          title: '网络异常',
          icon: 'none'
        });
      },
      complete: () => {
        this._homeDataLoading = false;
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  }
})
