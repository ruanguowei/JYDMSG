// cloudfunctions/quickstartFunctions/exportEvaluationResults/index.js
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
    const results = loaded.results.map(item => ({
      作品标题: item.title,
      作品分类: item.categoryName,
      基础分: item.baseScore,
      扣分: item.deductionScore,
      最终分: item.totalScore,
      评分时间: item.evaluationTime
    }))
    
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
      recordCount: results.length,
      edition: publicEdition(loaded.edition)
    }
    
  } catch (error) {
    console.error('导出评选结果失败:', error)
    return {
      success: false,
      message: '导出失败，请重试'
    }
  }
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
