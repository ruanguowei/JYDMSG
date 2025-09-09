// cloudfunctions/quickstartFunctions/fetchEvaluationResults/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const expertId = event.expertId || context.OPENID
  
  try {
    // 获取该专家已评分的所有作品
    const submissionsResult = await db.collection('pottery_submissions')
      .where({
        'evaluations.expertId': expertId
      })
      .orderBy('lastEvaluationTime', 'desc')
      .get()
    
    const results = submissionsResult.data.map(item => {
      // 找到该专家的评分记录
      const expertEvaluation = item.evaluations.find(eval => eval.expertId === expertId)
      
      return {
        id: item._id,
        title: item.title,
        authorName: item.authorName,
        schoolName: item.schoolName,
        category: item.category,
        categoryName: getCategoryName(item.category),
        imageUrl: item.imageUrl,
        description: item.description,
        themeFit: expertEvaluation.themeFit,
        creativity: expertEvaluation.creativity,
        craftsmanship: expertEvaluation.craftsmanship,
        aesthetics: expertEvaluation.aesthetics,
        totalScore: expertEvaluation.totalScore,
        evaluationTime: expertEvaluation.evaluationTime
      }
    })
    
    return {
      success: true,
      data: results
    }
    
  } catch (error) {
    console.error('获取评选结果失败:', error)
    return {
      success: false,
      message: '获取评选结果失败'
    }
  }
}

// 获取分类名称
function getCategoryName(category) {
  const categoryMap = {
    'technique': '技艺类',
    'culture': '文脉类', 
    'algorithm': '算法类',
    'industry': '产业类',
    'vision': '视界类'
  }
  return categoryMap[category] || '未知分类'
}
