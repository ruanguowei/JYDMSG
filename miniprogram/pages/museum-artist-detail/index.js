Page({
  data: {
    loading: true,
    artist: null
  },

  onLoad(options) {
    this.fetchDetail(options);
  },

  fetchDetail(options) {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchMuseumContent',
        action: 'artistDetail',
        id: options.id,
        artistId: options.artistId
      },
      success: res => {
        const result = res.result || {};
        if (result.success) {
          this.setData({ artist: result.data, loading: false });
          wx.setNavigationBarTitle({ title: result.data.name || '艺术家详情' });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: result.errMsg || '获取详情失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('获取艺术家详情失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  openCollection(e) {
    wx.navigateTo({
      url: `/pages/museum-collection-detail/index?id=${e.currentTarget.dataset.id}`
    });
  }
});
