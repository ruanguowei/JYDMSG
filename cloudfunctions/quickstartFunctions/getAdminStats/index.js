// cloudfunctions/quickstartFunctions/getAdminStats/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    // 获取总报名数
    const totalSubmissionsResult = await db.collection('pottery_submissions')
      .where({
        status: 'approved'
      })
      .count()
    
    // 获取有初评评分的作品数
    const preliminaryResult = await db.collection('pottery_submissions')
      .where({
        status: 'approved',
        'evaluations.0': _.exists(true)
      })
      .count()
    
    // 获取有终评评分的作品数（假设有phase字段标识）
    const finalResult = await db.collection('pottery_submissions')
      .where({
        status: 'approved',
        evaluations: _.elemMatch({
          phase: _.in(['final', '终评'])
        })
      })
      .count()
    
    // 获取专家评委数
    const expertResult = await db.collection('experts')
      .count()
    
    return {
      success: true,
      data: {
        totalSubmissions: totalSubmissionsResult.total || 0,
        preliminaryCount: preliminaryResult.total || 0,
        finalCount: finalResult.total || 0,
        expertCount: expertResult.total || 0
      }
    }
    
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return {
      success: false,
      data: {
        totalSubmissions: 0,
        preliminaryCount: 0,
        finalCount: 0,
        expertCount: 0
      }
    }
  }
}











