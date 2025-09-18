const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 从 evaluation_settings 集合读取一条当前配置
    const res = await db.collection('evaluation_settings').limit(1).get()
    const setting = (res.data && res.data[0]) || null
    if (!setting) {
      return { success: true, data: null, message: '未配置评审时间' }
    }
    return {
      success: true,
      data: {
        // 返回原始存储值，前端按本地时区解析
        startTime: setting.startTime,
        endTime: setting.endTime,
        note: setting.note || ''
      }
    }
  } catch (e) {
    console.error('获取评审配置失败', e)
    return { success: false, message: '获取评审配置失败' }
  }
}


