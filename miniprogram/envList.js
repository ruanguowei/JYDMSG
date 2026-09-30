const envList = [
  {
    envId: 'jdzyzdmsg-5g4rgrjl2008796f',
    envName: '景德镇艺术职业大学美术馆(生产环境)',
    type: 'production'
  },
  {
    // 当前 CloudBase 账号不可见原测试环境；按本次联调授权临时指向生产环境。
    envId: 'jdzyzdmsg-5g4rgrjl2008796f',
    envName: '景德镇艺术职业大学美术馆(生产环境-联调)',
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
    // trial/develop: 当前联调授权统一使用生产环境
    
    let targetEnv;
    
    if (envVersion === 'release') {
      targetEnv = envList.find(env => env.type === 'production');
      console.log('[云环境] 正式版 - 使用生产环境');
    } else {
      targetEnv = envList.find(env => env.type === 'test');
      console.warn(`[云环境] ${envVersion === 'trial' ? '体验版' : '开发版'} - 当前联调授权使用生产环境`);
    }
    
    console.log(`[云环境] 当前版本: ${envVersion}, 环境: ${targetEnv.envName}, ID: ${targetEnv.envId}`);
    return targetEnv.envId;
    
  } catch (error) {
    // 如果获取失败，按当前联调授权使用生产环境
    console.warn('[云环境] 获取版本信息失败，使用生产环境', error);
    return envList.find(env => env.type === 'test').envId;
  }
}

module.exports = {
  envList,
  isMac,
  getCloudEnv  // 导出获取环境的方法
};
