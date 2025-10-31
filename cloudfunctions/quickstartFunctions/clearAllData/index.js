// cloudfunctions/quickstartFunctions/clearAllData/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 清空所有作品数据（危险操作，仅用于测试环境）
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 警告：开始清空所有作品数据（原表+清洗表）===');
    
    // 先统计两个表的总数
    const countResult = await db.collection('pottery_submissions').count();
    const countResultClean = await db.collection('pottery_submissions_clean').count();
    const totalCount = countResult.total;
    const totalCountClean = countResultClean.total;
    
    console.log('原表作品数:', totalCount);
    console.log('清洗表作品数:', totalCountClean);
    
    if (totalCount === 0 && totalCountClean === 0) {
      return {
        success: true,
        message: '数据库已为空',
        data: { deletedCount: 0 }
      };
    }
    
    // 分批删除原表
    let deletedCount = 0;
    const batchSize = 100;
    
    if (totalCount > 0) {
      console.log('=== 开始清空原表 ===');
      while (deletedCount < totalCount) {
        const result = await db.collection('pottery_submissions')
          .limit(batchSize)
          .get();
        
        if (result.data.length === 0) break;
        
        const promises = result.data.map(item => 
          db.collection('pottery_submissions').doc(item._id).remove()
        );
        
        await Promise.all(promises);
        deletedCount += result.data.length;
        console.log(`原表已删除 ${deletedCount}/${totalCount} 件作品`);
      }
    }
    
    // 分批删除清洗表
    let deletedCountClean = 0;
    
    if (totalCountClean > 0) {
      console.log('=== 开始清空清洗表 ===');
      while (deletedCountClean < totalCountClean) {
        const result = await db.collection('pottery_submissions_clean')
          .limit(batchSize)
          .get();
        
        if (result.data.length === 0) break;
        
        const promises = result.data.map(item => 
          db.collection('pottery_submissions_clean').doc(item._id).remove()
        );
        
        await Promise.all(promises);
        deletedCountClean += result.data.length;
        console.log(`清洗表已删除 ${deletedCountClean}/${totalCountClean} 件作品`);
      }
    }
    
    console.log('=== 所有数据清理完成 ===');
    
    return {
      success: true,
      message: `已成功清空数据库：原表${deletedCount}件，清洗表${deletedCountClean}件`,
      data: {
        deletedCount: deletedCount,
        deletedCountClean: deletedCountClean,
        totalDeleted: deletedCount + deletedCountClean
      }
    };
    
  } catch (error) {
    console.error('清空数据失败:', error);
    return {
      success: false,
      message: '清空数据失败',
      error: error.message
    };
  }
}

