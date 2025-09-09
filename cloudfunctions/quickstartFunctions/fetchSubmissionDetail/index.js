// cloudfunctions/quickstartFunctions/fetchSubmissionDetail/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { submissionId } = event
  const expertId = event.expertId || context.OPENID
  
  try {
    // 获取作品详情
    const submissionResult = await db.collection('pottery_submissions')
      .doc(submissionId)
      .get()
    
    if (!submissionResult.data) {
      return {
        success: false,
        message: '作品不存在'
      }
    }
    
    const submission = submissionResult.data
    
    // 检查是否已有评分记录
    let existingScores = {
      themeFit: 0,
      creativity: 0,
      craftsmanship: 0,
      aesthetics: 0
    }
    
    if (submission.evaluations && submission.evaluations.length > 0) {
      // 查找当前专家的评分记录
      const expertEvaluation = submission.evaluations.find(eval => 
        eval.expertId === expertId
      )
      
      if (expertEvaluation) {
        existingScores = {
          themeFit: expertEvaluation.themeFit || 0,
          creativity: expertEvaluation.creativity || 0,
          craftsmanship: expertEvaluation.craftsmanship || 0,
          aesthetics: expertEvaluation.aesthetics || 0
        }
      }
    }
    
    return {
      success: true,
      data: {
        id: submission._id,
        title: submission.artworkName || submission.title || '未命名作品',
        authorName: submission.name || submission.authorName || '',
        schoolName: submission.school || submission.schoolName || '',
        category: submission.category || '',
        categoryName: getCategoryName(submission.category),
        imageUrl: (submission.artworkImages && submission.artworkImages[0]) || submission.photoUrl || '',
        description: submission.artworkDescription || submission.description || '',
        submitTime: submission.submissionTime || submission.submitTime || null,
        existingScores: existingScores
      }
    }
    
  } catch (error) {
    console.error('获取作品详情失败:', error)
    return {
      success: false,
      message: '获取作品详情失败'
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
