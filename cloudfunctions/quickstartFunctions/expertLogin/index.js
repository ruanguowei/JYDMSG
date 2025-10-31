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
    
    // 记录登录日志（暂时注释，避免集合不存在导致失败）
    try {
      await db.collection('expertLoginLogs').add({
        data: {
          expertId: expert._id,
          expertCode: expert.expertCode,
          expertName: expert.expertName,
          loginTime: new Date(),
          ip: context.CLIENTIP || 'unknown'
        }
      })
    } catch (logError) {
      console.log('记录登录日志失败，但不影响登录:', logError)
    }
    
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
