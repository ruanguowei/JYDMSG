const envList = [
  {
    envId: 'jdzyzdmsg-5g4rgrjl2008796f',
    envName: '景德镇艺术职业大学美术馆(生产环境)',
    type: 'production'
  },
  {
    envId: 'jdzyzdmsg-test-4gx2v0bw182af653',
    envName: '景德镇艺术职业大学美术馆(测试环境)',
    type: 'test'
  }
];

const isMac = false;

/**
 * 根据小程序版本自动选择云环境
 * @returns {string} 云环境ID
 */
function getCloudEnv() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo.miniProgram.envVersion;
    
    // release: 正式版 → 生产环境
    // trial: 体验版 → 测试环境
    // develop: 开发版 → 测试环境
    
    let targetEnv;
    if (envVersion === 'release') {
      // 正式版使用生产环境
      targetEnv = envList.find(env => env.type === 'production');
      console.log('[云环境] 正式版 - 使用生产环境');
    } else {
      // 开发版和体验版使用测试环境
      targetEnv = envList.find(env => env.type === 'test');
      console.log(`[云环境] ${envVersion === 'trial' ? '体验版' : '开发版'} - 使用测试环境`);
    }
    
    console.log(`[云环境] 当前版本: ${envVersion}, 环境: ${targetEnv.envName}, ID: ${targetEnv.envId}`);
    return targetEnv.envId;
    
  } catch (error) {
    // 如果获取失败，默认使用测试环境（开发时）
    console.warn('[云环境] 获取版本信息失败，使用测试环境', error);
    return envList.find(env => env.type === 'test').envId;
  }
}

module.exports = {
  envList,
  isMac,
  getCloudEnv  // 导出获取环境的方法
};
