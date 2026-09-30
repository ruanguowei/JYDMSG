Page({
  openWechatPrivacyContract() {
    if (typeof wx.openPrivacyContract !== 'function') {
      wx.showToast({ title: '当前微信版本暂不支持查看', icon: 'none' });
      return;
    }
    wx.openPrivacyContract({
      fail: () => {
        wx.showToast({ title: '隐私保护指引暂时无法打开', icon: 'none' });
      }
    });
  }
});
