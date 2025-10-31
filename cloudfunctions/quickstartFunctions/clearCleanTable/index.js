// cloudfunctions/quickstartFunctions/clearCleanTable/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 清空数据清洗表（只清洗表，不清原表）
 * ⚠️ 危险操作：会删除 pottery_submissions_clean 表的所有数据
 */
exports.main = async (event, context) => {
  try {
    console.log('=== ⚠️ 开始清空数据清洗表（危险操作）===');
    
    // 统计清洗表总数
    const countResult = await db.collection('pottery_submissions_clean').count();
    const totalCount = countResult.total;
    
    console.log('清洗表作品数:', totalCount);
    
    if (totalCount === 0) {
      return {
        success: true,
        message: '清洗表已为空',
        data: { deletedCount: 0 }
      };
    }
    
    // 分批删除清洗表
    let deletedCount = 0;
    const batchSize = 100;
    
    console.log('=== 开始清空清洗表 ===');
    while (deletedCount < totalCount) {
      const result = await db.collection('pottery_submissions_clean')
        .limit(batchSize)
        .get();
      
      if (result.data.length === 0) break;
      
      const promises = result.data.map(item => 
        db.collection('pottery_submissions_clean').doc(item._id).remove()
      );
      
      await Promise.all(promises);
      deletedCount += result.data.length;
      console.log(`已删除 ${deletedCount}/${totalCount} 件作品`);
    }
    
    console.log('');
    console.log('=== ✅ 清洗表清空完成 ===');
    console.log('已删除:', deletedCount, '件作品');
    console.log('原表（pottery_submissions）未受影响');
    console.log('');
    
    return {
      success: true,
      message: `成功清空清洗表，删除 ${deletedCount} 件作品`,
      data: {
        deletedCount: deletedCount
      }
    };
    
  } catch (error) {
    console.error('清空清洗表失败:', error);
    return {
      success: false,
      message: '清空清洗表失败: ' + error.message,
      error: error.message
    };
  }
}




