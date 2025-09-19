// cloudfunctions/quickstartFunctions/generateRankingResults/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 分类映射
const categoryMap = {
  'technique': '技艺类',
  'culture': '文脉类', 
  'algorithm': '算法类',
  'industry': '产业类',
  'vision': '视界类'
}

// 分类目标数量（用于参考，实际不筛选）
const categoryTargets = {
  'technique': 100,
  'culture': 100,
  'algorithm': 60,
  'industry': 60,
  'vision': 30
}

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
    
    // 按分类分组处理
    const categoryGroups = {}
    
    // 初始化分类组
    Object.keys(categoryMap).forEach(category => {
      categoryGroups[category] = []
    })
    
    // 计算每个作品的评分和分组
    submissionsResult.data.forEach(submission => {
      const evaluations = submission.evaluations || []
      const category = submission.category || 'technique'
      
      // 计算总分（所有专家评分之和）
      const totalScore = evaluations.reduce((sum, eval) => sum + (eval.totalScore || 0), 0)
      
      // 计算各维度总分
      const themeFitTotal = evaluations.reduce((sum, eval) => sum + (eval.themeFit || 0), 0)
      const creativityTotal = evaluations.reduce((sum, eval) => sum + (eval.creativity || 0), 0)
      const craftsmanshipTotal = evaluations.reduce((sum, eval) => sum + (eval.craftsmanship || 0), 0)
      const aestheticsTotal = evaluations.reduce((sum, eval) => sum + (eval.aesthetics || 0), 0)
      
      // 收集所有扣分项
      const allDeductions = evaluations
        .map(eval => eval.deductions || [])
        .flat()
        .filter(deduction => deduction && deduction.trim())
      
      // 查找匹配的运送信息
      const delivery = deliveriesResult.data.find(d => 
        d.name === submission.name && 
        d.school === submission.school && 
        d.artworkName === submission.artworkName
      )
      
      const item = {
        // 基本信息
        artworkName: submission.artworkName || submission.title || '未命名作品',
        name: submission.name || '',
        school: submission.school || '',
        category: category,
        categoryName: categoryMap[category] || '未知分类',
        
        // 评分信息
        totalScore: totalScore,
        themeFitTotal: themeFitTotal,
        creativityTotal: creativityTotal,
        craftsmanshipTotal: craftsmanshipTotal,
        aestheticsTotal: aestheticsTotal,
        evaluationCount: evaluations.length,
        deductions: allDeductions.join('; '), // 扣分项用分号分隔
        
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
      
      // 添加到对应分类组
      if (categoryGroups[category]) {
        categoryGroups[category].push(item)
      } else {
        // 如果分类不存在，添加到技艺类
        categoryGroups['technique'].push(item)
      }
    })
    
    // 对每个分类进行排名
    const rankedCategories = {}
    const fileResults = []
    
    Object.keys(categoryGroups).forEach(category => {
      const items = categoryGroups[category]
      
      if (items.length === 0) {
        console.log(`${categoryMap[category]} 无作品数据`);
        return
      }
      
      // 排序：按总分降序，同分时按规则比较
      items.sort((a, b) => {
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
      const rankedItems = items.map((item, index) => ({
        ...item,
        rank: index + 1
      }))
      
      rankedCategories[category] = rankedItems
      console.log(`${categoryMap[category]} 排名完成，共 ${rankedItems.length} 个作品`);
    })
    
    // 生成每个分类的CSV文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    
    for (const [category, items] of Object.entries(rankedCategories)) {
      if (items.length === 0) continue
      
      const csvContent = generateCSV(items)
      const fileName = `${categoryMap[category]}_排名结果_${timestamp}.csv`
      const cloudPath = `evaluation_results/${fileName}`
      
      // 上传到云存储
      const uploadResult = await cloud.uploadFile({
        cloudPath: cloudPath,
        fileContent: Buffer.from(csvContent, 'utf8')
      })
      
      fileResults.push({
        category: category,
        categoryName: categoryMap[category],
        fileName: fileName,
        fileID: uploadResult.fileID,
        downloadUrl: uploadResult.fileID,
        count: items.length,
        targetCount: categoryTargets[category] || 0
      })
      
      console.log(`${categoryMap[category]} CSV文件已保存:`, uploadResult.fileID);
    }
    
    return {
      success: true,
      message: '排名结果生成成功',
      data: {
        totalCount: submissionsResult.data.length,
        categoryResults: fileResults,
        summary: {
          技艺类: rankedCategories['technique']?.length || 0,
          文脉类: rankedCategories['culture']?.length || 0,
          算法类: rankedCategories['algorithm']?.length || 0,
          产业类: rankedCategories['industry']?.length || 0,
          视界类: rankedCategories['vision']?.length || 0
        }
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
    '作品分类',
    '总分',
    '主题契合度总分',
    '创意表现力总分', 
    '工艺得分总分',
    '美感与实用性总分',
    '扣分项',
    '评分专家数量',
    '运送方式',
    '快递公司',
    '运单号',
    '提交时间',
    '发送时间',
    // 作品提交数据的关键字段
    '作品类型',
    '作品尺寸',
    '透视图',
    '创建时间',
    '更新时间',
    // 作品运送数据的关键字段
    '包裹数量',
    '预计到达时间',
    '备注'
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
      escapeCSVField(item.categoryName),
      item.totalScore,
      item.themeFitTotal,
      item.creativityTotal,
      item.craftsmanshipTotal,
      item.aestheticsTotal,
      escapeCSVField(item.deductions),
      item.evaluationCount,
      escapeCSVField(item.deliveryMethod),
      escapeCSVField(item.expressCompany),
      escapeCSVField(item.trackingNumber),
      escapeCSVField(formatDate(item.submissionTime)),
      escapeCSVField(formatDate(item.sendDate)),
      // 作品提交数据
      escapeCSVField(submission.workType),
      escapeCSVField(submission.dimensions),
      escapeCSVField(submission.perspectiveImage),
      escapeCSVField(formatDate(submission.createTime)),
      escapeCSVField(formatDate(submission.updateTime)),
      // 作品运送数据
      delivery.packageCount || '',
      escapeCSVField(formatDate(delivery.estimatedArrival)),
      escapeCSVField(delivery.remarks)
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