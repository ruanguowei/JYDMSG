// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 从 timeLimit 集合获取作品运送时间限制配置
    const res = await db.collection('timeLimit').limit(1).get()
    const timeLimit = (res.data && res.data[0]) || null
    
    if (!timeLimit) {
      return {
        success: true,
        data: null,
        message: '未配置作品运送时间限制'
      }
    }
    
    return {
      success: true,
      data: {
        deliveryBeginTime: timeLimit.deliveryBeginTime,
        deliveryEndTime: timeLimit.deliveryEndTime,
        submissionBeginDeadline: timeLimit.submissionBeginDeadline,
        submissionEndDeadline: timeLimit.submissionEndDeadline,
        note: timeLimit.note || ''
      }
    }
  } catch (e) {
    console.error('获取作品运送时间限制失败', e)
    return {
      success: false,
      message: '获取作品运送时间限制失败'
    }
  }
}
