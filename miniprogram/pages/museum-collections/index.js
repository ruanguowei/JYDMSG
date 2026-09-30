Page({
  data: {
    loading: true,
    keyword: '',
    collections: []
  },

  onLoad() {
    this.fetchCollections();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.fetchCollections();
  },

  fetchCollections() {
    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchMuseumContent',
        action: 'listCollections',
        keyword: this.data.keyword,
        limit: 30
      },
      success: res => {
        const result = res.result || {};
        if (result.success) {
          this.setData({
            collections: result.data || [],
            loading: false
          });
        } else {
          this.setData({ loading: false });
          wx.showToast({ title: result.errMsg || '获取馆藏失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('获取馆藏失败:', err);
        this.setData({ loading: false });
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/museum-collection-detail/index?id=${id}`
    });
  }
});
