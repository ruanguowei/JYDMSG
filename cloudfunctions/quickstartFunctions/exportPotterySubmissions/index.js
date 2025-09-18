const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 获取所有参展申请数据
    const submissionsResult = await db.collection('pottery_submissions')
      .orderBy('createdAt', 'desc')
      .get()
    
    const results = submissionsResult.data.map(item => {
      // 处理时间字段，转换为13位时间戳
      let createdAtTimestamp = null
      let updatedAtTimestamp = null
      
      if (item.createdAt) {
        // 如果是特殊日期对象格式 {$date: timestamp}
        if (typeof item.createdAt === 'object' && item.createdAt.$date) {
          createdAtTimestamp = item.createdAt.$date
        } else if (typeof item.createdAt === 'number') {
          createdAtTimestamp = item.createdAt
        } else {
          // 尝试转换为时间戳
          const date = new Date(item.createdAt)
          createdAtTimestamp = date.getTime()
        }
      }
      
      if (item.updatedAt) {
        // 如果是特殊日期对象格式 {$date: timestamp}
        if (typeof item.updatedAt === 'object' && item.updatedAt.$date) {
          updatedAtTimestamp = item.updatedAt.$date
        } else if (typeof item.updatedAt === 'number') {
          updatedAtTimestamp = item.updatedAt
        } else {
          // 尝试转换为时间戳
          const date = new Date(item.updatedAt)
          updatedAtTimestamp = date.getTime()
        }
      }
      
      return {
        参展者姓名: item.name,
        性别: item.gender,
        所在学校: item.school,
        年级: item.grade,
        出生年月: item.birthDate,
        专业: item.major,
        联系电话: item.phone,
        邮箱: item.email,
        身份证号码: item.idNumber,
        指导老师: item.teacher,
        指导老师电话: item.teacherPhone,
        邮寄地址: item.address,
        作品名称: item.artworkName,
        创作年份: item.createYear,
        作品长度: item.dimensions?.length || '',
        作品宽度: item.dimensions?.width || '',
        作品高度: item.dimensions?.height || '',
        作品类别: getCategoryName(item.category),
        作品工艺材料: item.craftMaterial,
        作品简介: item.artworkDescription,
        审核状态: getStatusName(item.status),
        创建时间: createdAtTimestamp,
        更新时间: updatedAtTimestamp
      }
    })
    
    // 生成CSV格式数据
    const csvContent = generateCSV(results)
    
    // 上传到云存储
    const fileName = `pottery_submissions_export_${Date.now()}.csv`
    const uploadResult = await cloud.uploadFile({
      cloudPath: `exports/${fileName}`,
      fileContent: Buffer.from(csvContent, 'utf8')
    })
    
    return {
      success: true,
      downloadUrl: uploadResult.fileID,
      fileName: fileName,
      recordCount: results.length
    }
    
  } catch (error) {
    console.error('导出参展申请数据失败:', error)
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
    'vision': '视界类',
    '技艺': '技艺类',
    '文脉': '文脉类',
    '算法': '算法类',
    '产业': '产业类',
    '视界': '视界类'
  }
  return categoryMap[category] || '未知分类'
}

// 获取状态名称
function getStatusName(status) {
  const statusMap = {
    'pending': '待审核',
    'approved': '已通过',
    'rejected': '已拒绝'
  }
  return statusMap[status] || '未知状态'
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




