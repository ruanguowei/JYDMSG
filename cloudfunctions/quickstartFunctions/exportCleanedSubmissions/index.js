// cloudfunctions/quickstartFunctions/exportCleanedSubmissions/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    console.log('=== 开始导出报名数据（从清洗表）===')
    
    // 从清洗表读取数据（不执行清洗操作）
    const MAX_LIMIT = 100
    let allData = []
    let skip = 0
    let hasMore = true
    
    while (hasMore) {
      const result = await db.collection('pottery_submissions_clean')
        .skip(skip)
        .limit(MAX_LIMIT)
        .get()
      
      allData = allData.concat(result.data)
      skip += MAX_LIMIT
      hasMore = result.data.length === MAX_LIMIT
      
      console.log(`已查询 ${allData.length} 条数据...`)
    }
    
    console.log('清洗表数据总量:', allData.length)
    
    if (allData.length === 0) {
      return {
        success: false,
        message: '暂无数据可导出。请先执行"数据清洗"生成评分表。'
      }
    }
    
    // 直接从清洗表读取数据用于导出（不执行清洗）
    const submissionsResult = { data: allData }
    
    const results = submissionsResult.data.map((item, index) => {
      // 处理时间字段
      let createdAtStr = ''
      let updatedAtStr = ''
      let submissionTimeStr = ''
      
      if (item.createdAt) {
        try {
          const date = new Date(item.createdAt)
          createdAtStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        } catch (e) {
          createdAtStr = String(item.createdAt || '')
        }
      }
      
      if (item.updatedAt) {
        try {
          const date = new Date(item.updatedAt)
          updatedAtStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        } catch (e) {
          updatedAtStr = String(item.updatedAt || '')
        }
      }
      
      if (item.submissionTime) {
        try {
          const date = new Date(item.submissionTime)
          submissionTimeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        } catch (e) {
          submissionTimeStr = String(item.submissionTime || '')
        }
      }
      
      // 处理审核状态
      let statusName = '未知'
      if (item.status === 'approved') statusName = '已通过'
      else if (item.status === 'pending') statusName = '待审核'
      else if (item.status === 'rejected') statusName = '已拒绝'
      else if (item.status) statusName = item.status
      
      // 处理尺寸（可能是数组）
      let dimensionsStr = '';
      if (item.dimensions && Array.isArray(item.dimensions)) {
        dimensionsStr = item.dimensions.map(d => 
          `长${d.length || ''}×宽${d.width || ''}×高${d.height || ''}`
        ).join('; ');
      } else if (item.dimensions) {
        dimensionsStr = `长${item.dimensions.length || ''}×宽${item.dimensions.width || ''}×高${item.dimensions.height || ''}`;
      }
      
      return {
        序号: index + 1,
        参展者姓名: item.name || '',
        性别: item.gender || '',
        所在学校: item.school || '',
        学校省份: item.schoolProvinces || '',
        年级: item.grade || '',
        出生年月: item.birthDate || '',
        专业: item.major || '',
        联系电话: item.phone || '',
        邮箱: item.email || '',
        身份证号码: item.idNumber || '',
        指导老师: item.teacher || '',
        指导老师电话: item.teacherPhone || '',
        邮寄地址: item.address || '',
        参展作品名称: item.artworkName || '',
        创作年份: item.createYear || '',
        作品尺寸: dimensionsStr,
        作品类别: getCategoryName(item.category),
        作品工艺材料: item.craftMaterial || '',
        作品简介: item.artworkDescription || '',
        特殊陈列方式: item.specialDisplay || '',
        作品类型: item.workType || 'regular',
        参赛资格: item.qualification !== false ? '是' : '否',
        审核状态: statusName,
        提交时间: submissionTimeStr,
        创建时间: createdAtStr,
        更新时间: updatedAtStr
      }
    })
    
    // 生成CSV格式数据
    const csvContent = generateCSV(results)
    
    // 上传到云存储
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const fileName = `报名数据_${dateStr}.csv`
    
    console.log('开始上传文件到云存储...')
    
    const uploadResult = await cloud.uploadFile({
      cloudPath: `admin_exports/submissions/${fileName}`,
      fileContent: Buffer.from('\uFEFF' + csvContent, 'utf8') // 添加BOM头以支持Excel打开中文
    })
    
    console.log('导出成功，文件:', fileName)
    console.log('文件ID:', uploadResult.fileID)
    
    return {
      success: true,
      downloadUrl: uploadResult.fileID,
      fileName: fileName,
      recordCount: results.length,
      message: `成功导出 ${results.length} 条报名数据`
    }
    
  } catch (error) {
    console.error('导出报名数据失败:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: '导出失败: ' + error.message
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
  return categoryMap[category] || category || '未分类'
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
      let value = row[header]
      if (value === null || value === undefined) {
        value = ''
      }
      // 处理包含逗号、引号或换行的值
      value = String(value)
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csvContent += values.join(',') + '\n'
  })
  
  return csvContent
}

