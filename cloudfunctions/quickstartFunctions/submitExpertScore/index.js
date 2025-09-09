// cloudfunctions/quickstartFunctions/submitExpertScore/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { submissionId, scores, totalScore, finalScore, deductions, expertId, expertName } = event
  
  try {
    // 验证评分数据
    if (!submissionId || !scores || !expertId) {
      return {
        success: false,
        message: '参数不完整'
      }
    }
    
    // 验证评分范围
    const { themeFit, creativity, craftsmanship, aesthetics } = scores
    if (themeFit < 0 || themeFit > 3 || 
        creativity < 0 || creativity > 3 ||
        craftsmanship < 0 || craftsmanship > 2 ||
        aesthetics < 0 || aesthetics > 2) {
      return {
        success: false,
        message: '评分超出有效范围'
      }
    }
    
    // 检查评审时间是否在有效期内
    const now = new Date()
    const startTime = new Date('2025-10-18')
    const endTime = new Date('2025-10-22')
    
    if (now < startTime || now > endTime) {
      return {
        success: false,
        message: '评审时间未到或已结束'
      }
    }
    
    // 获取作品信息
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
    
    // 创建评分记录
    const evaluationRecord = {
      expertId: expertId,
      expertName: expertName,
      themeFit: themeFit,
      creativity: creativity,
      craftsmanship: craftsmanship,
      aesthetics: aesthetics,
      totalScore: totalScore,
      finalScore: finalScore || totalScore,
      deductions: deductions || {},
      evaluationTime: new Date(),
      ip: context.CLIENTIP || 'unknown'
    }
    
    // 更新作品评分记录
    let evaluations = submission.evaluations || []
    
    // 检查是否已有该专家的评分记录
    const existingIndex = evaluations.findIndex(eval => eval.expertId === expertId)
    
    if (existingIndex >= 0) {
      // 更新现有评分
      evaluations[existingIndex] = evaluationRecord
    } else {
      // 添加新评分
      evaluations.push(evaluationRecord)
    }
    
    // 更新数据库
    await db.collection('potterySubmissions')
      .doc(submissionId)
      .update({
        data: {
          evaluations: evaluations,
          lastEvaluationTime: new Date()
        }
      })
    
    // 记录评分日志
    await db.collection('evaluationLogs').add({
      data: {
        submissionId: submissionId,
        expertId: expertId,
        expertName: expertName,
        scores: scores,
        totalScore: totalScore,
        finalScore: finalScore || totalScore,
        deductions: deductions || {},
        evaluationTime: new Date(),
        ip: context.CLIENTIP || 'unknown'
      }
    })
    
    return {
      success: true,
      message: '评分提交成功'
    }
    
  } catch (error) {
    console.error('提交评分失败:', error)
    return {
      success: false,
      message: '提交评分失败，请重试'
    }
  }
}
