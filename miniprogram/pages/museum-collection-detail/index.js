Page({
  data: {
    loading: true,
    item: null
  },

  onLoad(options) {
    this.fetchDetail(options.id);
  },

  fetchDetail(id) {
    if (!id) {
      wx.showToast({ title: '缺少作品 ID', icon: 'none' });
      return;
    }

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchMuseumContent',
        action: 'collectionDetail',
        id
      },
      success: res => {
        const result = res.result || {};
        if (result.success) {
          this.setData({ item: result.data, loading: false });
          wx.setNavigationBarTitle({ title: result.data.title || '馆藏详情' });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: result.errMsg || '获取详情失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('获取馆藏详情失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  openArtist() {
    const item = this.data.item;
    if (!item || !item.artistId) return;
    wx.navigateTo({
      url: `/pages/museum-artist-detail/index?artistId=${item.artistId}`
    });
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    const item = this.data.item || {};
    const urls = [item.coverImage].concat(item.detailImages || []).filter(Boolean);
    wx.previewImage({ current, urls });
  }
});
