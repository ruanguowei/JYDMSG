// cloudfunctions/quickstartFunctions/expertLogin/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { expertCode, expertName } = event
  
  try {
    // 从云数据库验证专家身份
    const expertResult = await db.collection('experts').where({
      expertCode: expertCode,
      expertName: expertName,
      status: 'active'
    }).get()
    
    if (expertResult.data.length === 0) {
      return {
        success: false,
        message: '专家验证码或姓名错误，请检查输入信息'
      }
    }
    
    const expert = expertResult.data[0]
    
    // 检查评审时间是否在有效期内
    const now = new Date()
    const startTime = new Date('2025-9-8')
    const endTime = new Date('2025-10-22')
    
    if (now < startTime || now > endTime) {
      return {
        success: false,
        message: '评审时间未到或已结束（评审时间：2025年10月18日-22日）'
      }
    }
    
    // 记录登录日志
    await db.collection('expertLoginLogs').add({
      data: {
        expertId: expert._id,
        expertCode: expert.expertCode,
        expertName: expert.expertName,
        loginTime: new Date(),
        ip: context.CLIENTIP || 'unknown'
      }
    })
    
    return {
      success: true,
      expertId: expert._id,
      expertName: expert.expertName,
      expertCode: expert.expertCode,
      expertType: expert.expertType || 'unknown',
      expertTitle: expert.expertTitle || '',
      expertPosition: expert.expertPosition || ''
    }
    
  } catch (error) {
    console.error('专家登录失败:', error)
    return {
      success: false,
      message: '登录失败，请重试'
    }
  }
}
