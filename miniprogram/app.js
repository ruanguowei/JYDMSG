// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: "cloud1-7gnqlu9q952ceb2b",
        traceUser: true,
      });
      
      // 获取用户openid并存储
      this.getOpenid();
    }

    this.globalData = {
      openid: ''
    };
  },
  
  // 获取用户openid
  getOpenid: function() {
    // 调用云函数获取用户openid
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'login' },
      success: res => {
        console.log('云函数login调用成功:', res);
        const openid = res.result.openid;
        // 存储到本地缓存
        wx.setStorageSync('openid', openid);
        // 存储到全局变量
        this.globalData.openid = openid;
        console.log('获取用户openid成功:', openid);
      },
      fail: err => {
        console.error('获取用户openid失败:', err);
      }
    });
  }
});
