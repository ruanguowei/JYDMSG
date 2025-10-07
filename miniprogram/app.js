// app.js
const { getCloudEnv } = require('./envList.js');

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      // 自动获取对应的云环境ID
      const cloudEnvId = getCloudEnv();
      
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   开发版/体验版使用测试环境，正式版使用生产环境
        env: cloudEnvId,
        traceUser: true,
      });
      
      console.log('[小程序启动] 云环境已初始化:', cloudEnvId);
      
      // 获取用户openid并存储
      this.getOpenid();
    }

    this.globalData = {
      openid: '',
      cloudEnv: '',     // 存储当前使用的云环境ID
      envVersion: ''    // 存储当前版本类型
    };
    
    // 保存当前云环境到全局数据
    try {
      const accountInfo = wx.getAccountInfoSync();
      this.globalData.cloudEnv = getCloudEnv();
      this.globalData.envVersion = accountInfo.miniProgram.envVersion;
    } catch (error) {
      console.error('[全局数据] 保存环境信息失败', error);
    }
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
