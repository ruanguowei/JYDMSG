// cloudfunctions/quickstartFunctions/fetchSubmissionsForEvaluation/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 从event中获取专家ID，如果没有则从context中获取
    const expertId = event.expertId || context.OPENID
    
    // 获取作品（放宽条件，避免因为状态枚举差异取不到数据）
    const submissionsResult = await db.collection('pottery_submissions')
      .orderBy('submissionTime', 'desc')
      .get()
    
    const submissions = (submissionsResult.data || []).map(item => {
      // 检查该作品是否已被当前专家评分
      const isEvaluated = item.evaluations && item.evaluations.some(eval => 
        eval.expertId === expertId
      )
      
      return {
        id: item._id,
        title: item.artworkName || item.title || '未命名作品',
        authorName: item.name || item.authorName || '',
        schoolName: item.school || item.schoolName || '',
        category: item.category || '',
        categoryName: getCategoryName(item.category),
        imageUrl: (item.artworkImages && item.artworkImages[0]) || item.photoUrl || '',
        description: item.artworkDescription || item.description || '',
        submitTime: item.submissionTime || item.submitTime || null,
        isEvaluated: isEvaluated,
        totalScore: isEvaluated ? 
          item.evaluations.find(eval => eval.expertId === expertId).totalScore : 0
      }
    })
    
    return {
      success: true,
      data: submissions
    }
    
  } catch (error) {
    console.error('获取待评选作品失败:', error)
    return {
      success: false,
      message: '获取作品列表失败'
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
