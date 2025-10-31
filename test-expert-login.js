// 测试专家登录查询
// 在微信开发者工具的控制台中运行此代码

wx.cloud.callFunction({
  name: 'quickstartFunctions',
  data: {
    type: 'expertLogin',
    expertCode: '01',
    expertName: '01'
  },
  success: res => {
    console.log('登录结果:', res)
    if (res.result && res.result.success) {
      console.log('✅ 登录成功!')
      console.log('专家信息:', res.result)
    } else {
      console.log('❌ 登录失败')
      console.log('错误信息:', res.result.message)
    }
  },
  fail: err => {
    console.error('❌ 调用云函数失败:', err)
  }
})

