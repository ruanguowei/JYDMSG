Page({
  data: {
    loading: true,
    catalogs: []
  },

  onLoad() {
    this.fetchCatalogs();
  },

  fetchCatalogs() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchMuseumContent',
        action: 'listCatalogLinks',
        limit: 50
      },
      success: res => {
        const result = res.result || {};
        if (result.success) {
          this.setData({ catalogs: result.data || [], loading: false });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: result.errMsg || '获取画册失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('获取电子画册失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  openCatalog(e) {
    const url = e.currentTarget.dataset.url;
    const title = e.currentTarget.dataset.title || '电子画册';
    if (!url) {
      wx.showToast({ title: '画册链接未配置', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/web/index?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
    });
  }
});
