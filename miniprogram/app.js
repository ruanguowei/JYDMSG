// app.js
const { getCloudEnv } = require('./envList.js');

App({
  globalData: {
    openid: '',
    cloudEnv: '',
    envVersion: '',
    currentEdition: {
      editionId: 'pottery-2026',
      year: 2026,
      editionNumber: 3,
      title: '第三届全国大学生陶艺作品展',
      status: 'preparing',
      featureFlags: {}
    }
  },

  onLaunch: function () {
    const cloudEnvId = getCloudEnv();

    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   当前联调授权：开发版、体验版和正式版均使用生产环境
        env: cloudEnvId,
        traceUser: true,
      });
      
      console.log('[小程序启动] 云环境已初始化:', cloudEnvId);
      
      // 获取用户openid并存储
      this.getOpenid().catch(() => {
        // getOpenid 内部已记录错误；启动流程不因网络波动中断
      });

      this.loadCurrentEdition().catch(() => {
        // 届次配置失败时保留内置兜底，写操作仍由云函数校验
      });
    }

    // 保存当前云环境到全局数据
    try {
      const accountInfo = wx.getAccountInfoSync();
      this.globalData.cloudEnv = cloudEnvId;
      this.globalData.envVersion = accountInfo.miniProgram.envVersion;
    } catch (error) {
      console.error('[全局数据] 保存环境信息失败', error);
    }
  },
  
  // 获取用户openid
  getOpenid: function() {
    if (this._openidRequest) {
      return this._openidRequest;
    }

    this._openidRequest = new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'login' },
        success: res => {
          const result = res && res.result;
          const openid = result && result.openid;
          if (!openid) {
            reject(new Error('云函数未返回openid'));
            return;
          }

          wx.setStorageSync('openid', openid);
          this.globalData.openid = openid;
          resolve(openid);
        },
        fail: err => {
          console.error('获取用户openid失败:', err);
          reject(err);
        }
      });
    }).then(openid => {
      this._openidRequest = null;
      return openid;
    }).catch(error => {
      this._openidRequest = null;
      throw error;
    });

    return this._openidRequest;
  },

  loadCurrentEdition: function(options = {}) {
    const cachedEdition = wx.getStorageSync('currentEdition');
    if (cachedEdition && cachedEdition.editionId && cachedEdition.expiresAt > Date.now()) {
      this.globalData.currentEdition = cachedEdition.data || cachedEdition;
      return Promise.resolve(this.globalData.currentEdition);
    }

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getCurrentEdition',
          editionId: options.editionId
        },
        success: res => {
          const result = res && res.result;
          const edition = result && (result.edition || result.data);

          if (!result || !result.success || !edition || !edition.editionId) {
            reject(new Error((result && result.errMsg) || '云函数未返回有效届次配置'));
            return;
          }

          this.globalData.currentEdition = edition;
          wx.setStorageSync('currentEdition', {
            editionId: edition.editionId,
            data: edition,
            expiresAt: Date.now() + 5 * 60 * 1000
          });
          resolve(edition);
        },
        fail: err => {
          console.error('获取当前届次失败:', err);
          reject(err);
        }
      });
    });
  }
});
