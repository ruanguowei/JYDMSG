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
      
      const { key: categoryKey, name: categoryName } = normalizeCategory(item.category)

      return {
        id: item._id,
        title: item.title,
        category: categoryKey,
        categoryName: categoryName,
        // 优先使用透视图，其次使用四面图第一张，最后使用其他图片
        imageUrl: item.perspectiveImage || 
                 (item.fourViewImages && item.fourViewImages[0]) || 
                 (item.artworkImages && item.artworkImages[0]) || 
                 (item.detailImages && item.detailImages[0]) || 
                 item.imageUrl || '',
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
  const { name } = normalizeCategory(category)
  return name
}

function normalizeCategory(category) {
  const map = {
    'technique': '技艺类', '技艺': '技艺类', '技艺类': '技艺类',
    'culture': '文脉类', '文脉': '文脉类', '文脉类': '文脉类',
    'algorithm': '算法类', '算法': '算法类', '算法类': '算法类',
    'industry': '产业类', '产业': '产业类', '产业类': '产业类',
    'vision': '视界类', '视界': '视界类', '视界类': '视界类'
  }
  const raw = (category || '').toString().replace(/[\s\u3000]+/g, '')
  const lower = raw.toLowerCase()
  const keyGuess = {
    'technique': 'technique',
    'culture': 'culture',
    'algorithm': 'algorithm',
    'industry': 'industry',
    'vision': 'vision'
  }[lower]
  const name = map[raw] || map[keyGuess] || '未知分类'
  const reverse = {
    '技艺类': 'technique',
    '文脉类': 'culture',
    '算法类': 'algorithm',
    '产业类': 'industry',
    '视界类': 'vision'
  }
  const key = reverse[name] || ''
  return { key, name }
}
