const app = getApp();
let that = null;
const ALLOWED_HOSTS = [
  'yunzhan365.com',
  'www.yunzhan365.com',
  'book.yunzhan365.com'
];

function isAllowedUrl(rawUrl) {
  try {
    const decoded = decodeURIComponent(rawUrl || '');
    const parsed = new URL(decoded);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.includes(parsed.hostname);
  } catch (error) {
    return false;
  }
}

Page({
  onLoad(options) {
    that = this;
    if (options.url != null) {
      if (!isAllowedUrl(options.url)) {
        wx.showModal({
          title: '链接不可打开',
          content: '该电子画册链接未通过业务域名白名单校验，请联系管理员检查云展网配置。',
          showCancel: false,
          success: () => {
            wx.navigateBack({ delta: 1 });
          }
        });
        return;
      }

      this.setData({
        webUrl: decodeURIComponent(options.url),
      });
      if (options.title != null) {
        wx.setNavigationBarTitle({
          title: options.title,
        });
      }
    } else {
      wx.navigateBack({
        delta: 1,
      });
    }
  },
});
