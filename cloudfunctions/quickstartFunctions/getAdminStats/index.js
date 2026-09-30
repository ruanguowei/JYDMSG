// cloudfunctions/quickstartFunctions/getAdminStats/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const { collectionName, publicEdition, resolveEdition } = require('../common/edition')

exports.main = async (event, context) => {
  try {
    const edition = await resolveEdition(db, {
      editionId: event && event.editionId,
      useCurrent: !(event && event.editionId),
      mode: 'read'
    })
    const submissionsCollection = collectionName(edition, 'submissions')
    const cleanedCollection = collectionName(edition, 'cleaned')
    const finalScoringCollection = collectionName(edition, 'finalScoring')

    // 获取总报名数
    const totalSubmissionsResult = await db.collection(submissionsCollection)
      .where({
        status: 'approved'
      })
      .count()
    
    // 获取有初评评分的作品数
    const preliminaryResult = await db.collection(cleanedCollection)
      .where({
        qualification: _.neq(false),
        'evaluations.0': _.exists(true)
      })
      .count()
    
    // 获取有终评评分的作品数（假设有phase字段标识）
    const finalResult = await db.collection(finalScoringCollection)
      .where({
        qualification: _.neq(false),
        'evaluations.0': _.exists(true)
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
      },
      edition: publicEdition(edition)
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











