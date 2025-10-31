// cloudfunctions/quickstartFunctions/clearTestData/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 清理测试数据
 * 删除所有标记为测试数据的作品
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 开始清理测试数据 ===');
    
    // 查询所有测试数据
    const result = await db.collection('pottery_submissions')
      .where({
        _isTestData: true
      })
      .get();
    
    const testDataCount = result.data.length;
    console.log('找到测试数据:', testDataCount, '件');
    
    if (testDataCount === 0) {
      return {
        success: true,
        message: '没有找到测试数据',
        data: { deletedCount: 0 }
      };
    }
    
    // 批量删除
    const promises = result.data.map(item => 
      db.collection('pottery_submissions').doc(item._id).remove()
    );
    
    await Promise.all(promises);
    
    console.log('=== 测试数据清理完成 ===');
    
    return {
      success: true,
      message: `已成功删除 ${testDataCount} 件测试数据`,
      data: {
        deletedCount: testDataCount
      }
    };
    
  } catch (error) {
    console.error('清理测试数据失败:', error);
    return {
      success: false,
      message: '清理测试数据失败',
      error: error.message
    };
  }
}






















