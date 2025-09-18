// cloudfunctions/quickstartFunctions/exportEvaluationResults/index.js
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
        作品标题: item.title,
        作者姓名: item.authorName,
        学校名称: item.schoolName,
        作品分类: getCategoryName(item.category),
        主题契合度: expertEvaluation.themeFit,
        创意与表现力: expertEvaluation.creativity,
        工艺与材料: expertEvaluation.craftsmanship,
        美感与实用性: expertEvaluation.aesthetics,
        总分: expertEvaluation.totalScore,
        评分时间: expertEvaluation.evaluationTime
      }
    })
    
    // 生成CSV格式数据
    const csvContent = generateCSV(results)
    
    // 上传到云存储
    const fileName = `expert_evaluation_results_${expertId}_${Date.now()}.csv`
    const uploadResult = await cloud.uploadFile({
      cloudPath: `evaluation_results/${fileName}`,
      fileContent: Buffer.from(csvContent, 'utf8')
    })
    
    return {
      success: true,
      downloadUrl: uploadResult.fileID,
      fileName: fileName,
      recordCount: results.length
    }
    
  } catch (error) {
    console.error('导出评选结果失败:', error)
    return {
      success: false,
      message: '导出失败，请重试'
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

// 生成CSV内容
function generateCSV(data) {
  if (data.length === 0) return ''
  
  // 获取表头
  const headers = Object.keys(data[0])
  
  // 生成CSV内容
  let csvContent = headers.join(',') + '\n'
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header]
      // 处理包含逗号或引号的值
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csvContent += values.join(',') + '\n'
  })
  
  return csvContent
}
