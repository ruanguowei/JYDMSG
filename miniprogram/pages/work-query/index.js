// pages/work-query/index.js
Page({
  data: {
    phone: '',
    name: '',
    loading: false,
    showResult: false,
    qualified: false,
    resultData: null,
    works: [],
    editionIndex: 0,
    editionOptions: [
      { editionId: 'pottery-2026', label: '第三届' },
      { editionId: 'pottery-2025', label: '第二届' }
    ],
    edition: null
  },

  onLoad: function() {
    // 页面加载
  },

  // 输入手机号
  onPhoneInput: function(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  // 输入姓名
  onNameInput: function(e) {
    this.setData({
      name: e.detail.value
    });
  },

  onEditionChange: function(e) {
    this.setData({
      editionIndex: Number(e.detail.value || 0)
    });
  },

  // 查询入围状态
  queryStatus: function() {
    const { phone, name } = this.data;
    
    // 验证输入
    if (!phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!name.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }

    // 简单验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone.trim())) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    // 调用云函数查询
    wx.cloud.callFunction({
      name: 'queryWorkStatus',
      data: {
        phone: phone.trim(),
        name: name.trim(),
        editionId: this.data.editionOptions[this.data.editionIndex].editionId
      },
      success: res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success) {
          // 显示查询结果
          this.setData({
            showResult: true,
            qualified: res.result.qualified,
            resultData: res.result.data || null,
            works: res.result.works || (res.result.data ? [res.result.data] : []),
            edition: res.result.edition || null
          });
        } else {
          wx.showToast({
            title: res.result.message || '查询失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ loading: false });
        console.error('查询失败', err);
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 重新查询
  resetQuery: function() {
    this.setData({
      showResult: false,
      phone: '',
      name: '',
      qualified: false,
      resultData: null,
      works: [],
      edition: null
    });
  },

  // 预览证书图片
  previewCertificate: function(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({
        urls: [url],
        current: url
      });
    }
  }
});



