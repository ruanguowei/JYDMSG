/**
 * 修复数据库中的日期格式
 * 将 Date 对象转换为 13 位时间戳，解决 CMS 导出 Excel 时的格式错误
 */

const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: 'test-4gx2v0bw182a'  // 替换为你的云环境ID
})

async function fixDateFormat() {
  try {
    console.log('开始调用修复日期格式云函数...')
    
    const result = await cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fixDateFormat'
      }
    })
    
    console.log('\n修复结果:')
    console.log('═════════════════════════════════')
    console.log('状态:', result.result.success ? '✓ 成功' : '✗ 失败')
    console.log('消息:', result.result.message)
    console.log('总记录数:', result.result.total)
    console.log('成功更新:', result.result.successCount)
    console.log('失败数量:', result.result.errorCount)
    console.log('═════════════════════════════════\n')
    
    if (result.result.success) {
      console.log('✓ 日期格式修复完成！现在可以在 CMS 中正常导出 Excel 了。')
    } else {
      console.error('✗ 修复失败:', result.result.message)
    }
    
  } catch (error) {
    console.error('调用云函数失败:', error)
  }
}

// 执行修复
fixDateFormat()





























