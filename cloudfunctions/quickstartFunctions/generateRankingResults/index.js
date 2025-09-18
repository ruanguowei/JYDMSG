// cloudfunctions/quickstartFunctions/generateRankingResults/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log('=== 开始生成排名结果 ===');
    
    // 获取作品提交数据
    const submissionsResult = await db.collection('pottery_submissions')
      .orderBy('submissionTime', 'desc')
      .get()
    
    // 获取作品运送数据
    const deliveriesResult = await db.collection('artwork_deliveries')
      .get()
    
    console.log('作品提交数据数量:', submissionsResult.data.length);
    console.log('作品运送数据数量:', deliveriesResult.data.length);
    
    // 计算每个作品的评分和排名
    const rankingData = submissionsResult.data.map(submission => {
      const evaluations = submission.evaluations || []
      
      // 计算总分（所有专家评分之和）
      const totalScore = evaluations.reduce((sum, eval) => sum + (eval.totalScore || 0), 0)
      
      // 计算各维度总分
      const themeFitTotal = evaluations.reduce((sum, eval) => sum + (eval.themeFit || 0), 0)
      const creativityTotal = evaluations.reduce((sum, eval) => sum + (eval.creativity || 0), 0)
      const craftsmanshipTotal = evaluations.reduce((sum, eval) => sum + (eval.craftsmanship || 0), 0)
      
      // 查找匹配的运送信息
      const delivery = deliveriesResult.data.find(d => 
        d.name === submission.name && 
        d.school === submission.school && 
        d.artworkName === submission.artworkName
      )
      
      return {
        // 基本信息
        artworkName: submission.artworkName || submission.title || '未命名作品',
        name: submission.name || '',
        school: submission.school || '',
        
        // 评分信息
        totalScore: totalScore,
        themeFitTotal: themeFitTotal,
        creativityTotal: creativityTotal,
        craftsmanshipTotal: craftsmanshipTotal,
        evaluationCount: evaluations.length,
        
        // 运送信息
        deliveryMethod: delivery ? delivery.deliveryMethod : '',
        expressCompany: delivery ? delivery.expressCompany : '',
        trackingNumber: delivery ? delivery.trackingNumber : '',
        
        // 时间信息
        submissionTime: submission.submissionTime || submission.submitTime || null,
        sendDate: delivery ? delivery.sendDate : '',
        
        // 保留所有原始数据
        _originalSubmission: submission,
        _originalDelivery: delivery
      }
    })
    
    // 排序：按总分降序，同分时按规则比较
    rankingData.sort((a, b) => {
      // 首先按总分降序
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore
      }
      
      // 同分时按主题契合度总分降序
      if (b.themeFitTotal !== a.themeFitTotal) {
        return b.themeFitTotal - a.themeFitTotal
      }
      
      // 再按创意表现力总分降序
      if (b.creativityTotal !== a.creativityTotal) {
        return b.creativityTotal - a.creativityTotal
      }
      
      // 最后按工艺得分总分降序
      return b.craftsmanshipTotal - a.craftsmanshipTotal
    })
    
    // 添加排名
    const finalRankingData = rankingData.map((item, index) => ({
      ...item,
      rank: index + 1
    }))
    
    console.log('排名计算完成，共', finalRankingData.length, '个作品');
    
    // 生成CSV内容
    const csvContent = generateCSV(finalRankingData)
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `排名结果_${timestamp}.csv`
    const cloudPath = `evaluation_results/${fileName}`
    
    // 上传到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: Buffer.from(csvContent, 'utf8')
    })
    
    console.log('CSV文件已保存到云存储:', uploadResult.fileID);
    
    return {
      success: true,
      message: '排名结果生成成功',
      data: {
        totalCount: finalRankingData.length,
        fileName: fileName,
        fileID: uploadResult.fileID,
        downloadUrl: uploadResult.fileID,
        rankingData: finalRankingData.slice(0, 10) // 只返回前10名用于预览
      }
    }
    
  } catch (error) {
    console.error('生成排名结果失败:', error)
    return {
      success: false,
      message: '生成排名结果失败，请重试'
    }
  }
}

// 生成CSV内容
function generateCSV(data) {
  const headers = [
    '排名',
    '作品名称', 
    '作者姓名',
    '学校',
    '总分',
    '主题契合度总分',
    '创意表现力总分', 
    '工艺得分总分',
    '评分专家数量',
    '运送方式',
    '快递公司',
    '运单号',
    '提交时间',
    '发送时间',
    // 作品提交数据的所有字段
    '作品ID',
    '作品描述',
    '作品类型',
    '作品分类',
    '作品尺寸',
    '创作说明',
    '技术报告',
    '透视图',
    '四面图数量',
    '局部图数量',
    '作品图片数量',
    '视频时长',
    '视频文件',
    '创建时间',
    '更新时间',
    // 作品运送数据的所有字段
    '运送记录ID',
    '包裹数量',
    '预计到达时间',
    '备注',
    '包裹图片数量',
    '作品图片数量(运送)',
    '运送创建时间',
    '运送更新时间'
  ]
  
  const csvRows = [headers.join(',')]
  
  data.forEach(item => {
    const submission = item._originalSubmission || {}
    const delivery = item._originalDelivery || {}
    
    const row = [
      item.rank,
      escapeCSVField(item.artworkName),
      escapeCSVField(item.name),
      escapeCSVField(item.school),
      item.totalScore,
      item.themeFitTotal,
      item.creativityTotal,
      item.craftsmanshipTotal,
      item.evaluationCount,
      escapeCSVField(item.deliveryMethod),
      escapeCSVField(item.expressCompany),
      escapeCSVField(item.trackingNumber),
      escapeCSVField(formatDate(item.submissionTime)),
      escapeCSVField(formatDate(item.sendDate)),
      // 作品提交数据
      escapeCSVField(submission._id),
      escapeCSVField(submission.artworkDescription || submission.description),
      escapeCSVField(submission.workType),
      escapeCSVField(submission.category),
      escapeCSVField(submission.dimensions), // 使用转义函数处理JSON数据
      escapeCSVField(submission.creationDescription),
      escapeCSVField(submission.technicalReport),
      escapeCSVField(submission.perspectiveImage),
      (submission.fourViewImages || []).length,
      (submission.detailImages || []).length,
      (submission.artworkImages || []).length,
      submission.videoDuration || '',
      escapeCSVField(submission.videoFile),
      escapeCSVField(formatDate(submission.createTime)),
      escapeCSVField(formatDate(submission.updateTime)),
      // 作品运送数据
      escapeCSVField(delivery._id),
      delivery.packageCount || '',
      escapeCSVField(formatDate(delivery.estimatedArrival)),
      escapeCSVField(delivery.remarks),
      (delivery.packageImages || []).length,
      (delivery.artworkImages || []).length,
      escapeCSVField(formatDate(delivery.createTime)),
      escapeCSVField(formatDate(delivery.updateTime))
    ]
    csvRows.push(row.join(','))
  })
  
  return csvRows.join('\n')
}

// CSV字段转义函数
function escapeCSVField(value) {
  // 处理null/undefined
  if (value === null || value === undefined) {
    return '""'
  }
  
  // 如果是对象，转换为JSON字符串
  if (typeof value === 'object') {
    value = JSON.stringify(value)
  }
  
  // 转换为字符串
  value = String(value)
  
  // 转义双引号：将 " 替换为 ""
  value = value.replace(/"/g, '""')
  
  // 用双引号包围整个字段
  return `"${value}"`
}

// 格式化日期
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN')
}
