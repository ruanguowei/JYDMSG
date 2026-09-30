Page({
  data: {
    loading: true,
    keyword: '',
    artists: []
  },

  onLoad() {
    this.fetchArtists();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.fetchArtists();
  },

  fetchArtists() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchMuseumContent',
        action: 'listArtists',
        keyword: this.data.keyword,
        limit: 30
      },
      success: res => {
        const result = res.result || {};
        if (result.success) {
          this.setData({ artists: result.data || [], loading: false });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: result.errMsg || '获取艺术家失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('获取艺术家失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const artistId = e.currentTarget.dataset.artistId;
    const query = id ? `id=${id}` : `artistId=${artistId}`;
    wx.navigateTo({
      url: `/pages/museum-artist-detail/index?${query}`
    });
  }
});
