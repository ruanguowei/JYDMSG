// cloudfunctions/quickstartFunctions/fetchEvaluationResults/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { loadExpertResults, publicEdition } = require('../common/evaluationResults')

exports.main = async (event, context) => {
  try {
    const expertId = event.expertId || context.OPENID
    const loaded = await loadExpertResults(db, {
      expertId,
      editionId: event.editionId
    })
    
    return {
      success: true,
      data: loaded.results,
      edition: publicEdition(loaded.edition)
    }
    
  } catch (error) {
    console.error('获取评选结果失败:', error)
    return {
      success: false,
      message: '获取评选结果失败'
    }
  }
}
