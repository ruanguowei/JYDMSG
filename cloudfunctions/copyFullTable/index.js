// cloudfunctions/copyFullTable/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100  // 每次最多读取100条

/**
 * 复制整个表的数据到另一个表
 */
exports.main = async (event, context) => {
  const {
    sourceTable = 'pottery_submissions_final',  // 源表
    targetTable = 'secondWorks',                // 目标表
    overwrite = false,  // 如果目标表有数据，是否清空后再复制
    addMetadata = true  // 是否添加复制元数据
  } = event;
  
  try {
    console.log('=== 开始复制整表 ===');
    console.log('源表:', sourceTable);
    console.log('目标表:', targetTable);
    
    // 步骤1：获取源表总数
    const countResult = await db.collection(sourceTable).count();
    const total = countResult.total;
    console.log('源表总记录数:', total);
    
    if (total === 0) {
      return {
        success: false,
        message: '源表为空，无数据可复制'
      };
    }
    
    // 步骤2：检查目标表
    const targetCount = await db.collection(targetTable).count();
    if (targetCount.total > 0) {
      if (overwrite) {
        console.log('目标表有', targetCount.total, '条数据，将清空后复制');
        // 清空目标表（分批删除）
        const batchTimes = Math.ceil(targetCount.total / MAX_LIMIT);
        for (let i = 0; i < batchTimes; i++) {
          const deleteResult = await db.collection(targetTable)
            .limit(MAX_LIMIT)
            .get();
          
          for (const item of deleteResult.data) {
            await db.collection(targetTable).doc(item._id).remove();
          }
        }
        console.log('目标表已清空');
      } else {
        return {
          success: false,
          message: `目标表已有 ${targetCount.total} 条数据，请设置 overwrite: true 来清空后复制`
        };
      }
    }
    
    // 步骤3：分批读取源表数据
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    let allData = [];
    
    for (let i = 0; i < batchTimes; i++) {
      const result = await db.collection(sourceTable)
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get();
      
      allData = allData.concat(result.data);
      console.log(`读取进度: ${allData.length}/${total}`);
    }
    
    console.log('读取完成，共', allData.length, '条');
    
    // 步骤4：批量写入目标表
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (let i = 0; i < allData.length; i++) {
      try {
        const sourceData = allData[i];
        const copyData = { ...sourceData };
        const originalId = copyData._id;
        delete copyData._id;  // 删除原ID，让数据库生成新ID
        
        // 添加复制元数据
        if (addMetadata) {
          copyData._copiedAt = new Date();
          copyData._copiedFrom = sourceTable;
          copyData._sourceId = originalId;
        }
        
        await db.collection(targetTable).add({ data: copyData });
        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`写入进度: ${successCount}/${total}`);
        }
      } catch (err) {
        failCount++;
        errors.push({
          index: i,
          error: err.message
        });
      }
    }
    
    console.log('');
    console.log('=== 复制完成 ===');
    console.log('成功:', successCount);
    console.log('失败:', failCount);
    
    return {
      success: failCount === 0,
      message: `复制完成：${successCount}/${total} 成功`,
      data: {
        sourceTable,
        targetTable,
        total,
        success: successCount,
        failed: failCount,
        errors: errors.length > 0 ? errors : undefined
      }
    };
    
  } catch (error) {
    console.error('复制失败:', error);
    return {
      success: false,
      message: '复制失败: ' + error.message,
      error: error.message
    };
  }
}
