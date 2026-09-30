Page({
  navigateToMuseumCollections() {
    wx.navigateTo({
      url: '/pages/museum-collections/index'
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
