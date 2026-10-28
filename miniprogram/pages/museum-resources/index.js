Page({
  data: {error:''},
  // Preserve existing bookmarks while the new museum module opens directly.
  onLoad() { this.navigateToMuseumCollections(); },
  navigateToMuseumCollections() {
    wx.redirectTo({
      url: '/pages/museum-collections/index',
      fail: () => this.setData({error:'馆藏页面暂时无法打开，请重试'})
    });
  },

  navigateToMuseumArtists() {
    wx.navigateTo({
      url: '/pages/museum-artists/index'
    });
  },

  navigateToCatalogLinks() {
    wx.navigateToMiniProgram({
      appId: 'wx9c2d982dec74abe7',
      path: 'pages/bookcase/bookcase?scene=kwdj',
      envVersion: 'release',
      fail: err => {
        console.error('打开云展网电子画册失败:', err);
        if ((err.errMsg || '').includes('cancel')) {
          return;
        }
        wx.showToast({
          title: '无法打开电子画册',
          icon: 'none'
        });
      }
    });
  }
});
