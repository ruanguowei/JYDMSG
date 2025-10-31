const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 修复 pottery_submissions 集合中的日期格式
 * 将 Date 对象转换为 13 位时间戳
 */
exports.main = async (event, context) => {
  try {
    console.log('开始修复日期格式...')
    
    // 获取所有数据
    const result = await db.collection('pottery_submissions').get()
    const submissions = result.data
    
    console.log(`共找到 ${submissions.length} 条数据`)
    
    let successCount = 0
    let errorCount = 0
    
    // 逐条更新
    for (const item of submissions) {
      try {
        const updateData = {}
        
        // 处理 createdAt 字段
        if (item.createdAt) {
          if (typeof item.createdAt === 'object') {
            // 如果是 Date 对象，转换为时间戳
            updateData.createdAt = item.createdAt.getTime ? 
              item.createdAt.getTime() : 
              (item.createdAt.$date || new Date(item.createdAt).getTime())
          } else if (typeof item.createdAt === 'string') {
            updateData.createdAt = new Date(item.createdAt).getTime()
          }
          // 如果已经是数字，不需要处理
        }
        
        // 处理 updatedAt 字段
        if (item.updatedAt) {
          if (typeof item.updatedAt === 'object') {
            updateData.updatedAt = item.updatedAt.getTime ? 
              item.updatedAt.getTime() : 
              (item.updatedAt.$date || new Date(item.updatedAt).getTime())
          } else if (typeof item.updatedAt === 'string') {
            updateData.updatedAt = new Date(item.updatedAt).getTime()
          }
        }
        
        // 如果有需要更新的字段
        if (Object.keys(updateData).length > 0) {
          await db.collection('pottery_submissions')
            .doc(item._id)
            .update({
              data: updateData
            })
          
          console.log(`✓ 更新成功: ${item._id}`, updateData)
          successCount++
        }
        
      } catch (error) {
        console.error(`✗ 更新失败: ${item._id}`, error)
        errorCount++
      }
    }
    
    return {
      success: true,
      message: '日期格式修复完成',
      total: submissions.length,
      successCount,
      errorCount
    }
    
  } catch (error) {
    console.error('修复日期格式失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}





























