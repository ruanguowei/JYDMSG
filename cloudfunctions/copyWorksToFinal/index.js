// cloudfunctions/copyWorksToFinal/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 将作品从评分表复制到结果表
 * 根据作品名称批量复制
 */
exports.main = async (event, context) => {
  const {
    works = [],  // 要复制的作品名称数组
    sourceTable = 'pottery_submissions_for_final',  // 源表（评分表）
    targetTable = 'pottery_submissions_final',  // 目标表（结果表）
    mode = 'best-effort',  // 执行模式
    overwrite = false  // 如果作品已存在，是否覆盖
  } = event;
  
  try {
    console.log('=== 开始批量复制作品 ===');
    console.log('源表:', sourceTable);
    console.log('目标表:', targetTable);
    console.log('复制数量:', works.length);
    console.log('覆盖模式:', overwrite ? '是' : '否');
    console.log('执行模式:', mode);
    
    // ========== 步骤1：参数验证 ==========
    if (!Array.isArray(works) || works.length === 0) {
      return {
        success: false,
        message: '参数错误：works必须是非空数组'
      };
    }
    
    console.log('✅ 参数验证通过');
    console.log('');
    
    // ========== 步骤2：查找源表中的作品 ==========
    console.log('=== 步骤2：在源表中查找作品 ===');
    
    const lookupResults = [];
    
    for (let i = 0; i < works.length; i++) {
      const workName = works[i];
      console.log('');
      console.log(`--- 查找第${i + 1}件：${workName} ---`);
      
      const result = {
        index: i,
        workName: workName,
        sourceWork: null,
        targetExists: false,
        valid: true,
        errors: []
      };
      
      // 在源表中查找
      try {
        const querySource = await db.collection(sourceTable)
          .where({ artworkName: workName })
          .get();
        
        if (querySource.data.length === 0) {
          // 尝试用 title 字段查找
          const querySourceB = await db.collection(sourceTable)
            .where({ title: workName })
            .get();
          
          if (querySourceB.data.length > 0) {
            result.sourceWork = querySourceB.data[0];
            console.log(`  ✅ 源表找到: ${result.sourceWork._id.substring(0, 8)}... (通过title字段)`);
          } else {
            result.valid = false;
            result.errors.push(`源表中未找到: "${workName}"`);
            console.log(`  ❌ 源表中未找到该作品`);
          }
        } else if (querySource.data.length === 1) {
          result.sourceWork = querySource.data[0];
          console.log(`  ✅ 源表找到: ${result.sourceWork._id.substring(0, 8)}...`);
        } else {
          result.valid = false;
          result.errors.push(`源表中作品重名: "${workName}" (找到${querySource.data.length}个)`);
          console.log(`  ⚠️ 源表中重名，找到 ${querySource.data.length} 个`);
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`查找源表失败: ${error.message}`);
        console.error(`  ❌ 查找源表失败:`, error.message);
      }
      
      // 检查目标表中是否已存在
      if (result.sourceWork) {
        try {
          const queryTarget = await db.collection(targetTable)
            .where({ artworkName: workName })
            .get();
          
          if (queryTarget.data.length > 0) {
            result.targetExists = true;
            result.targetWorkId = queryTarget.data[0]._id;
            
            if (overwrite) {
              console.log(`  ⚠️ 目标表中已存在，将覆盖 (ID: ${result.targetWorkId.substring(0, 8)}...)`);
            } else {
              result.valid = false;
              result.errors.push(`目标表中已存在"${workName}"，且未开启覆盖模式`);
              console.log(`  ❌ 目标表中已存在，跳过（未开启覆盖模式）`);
            }
          } else {
            console.log(`  ✅ 目标表中不存在，可以插入`);
          }
        } catch (error) {
          console.error(`  ⚠️ 检查目标表失败:`, error.message);
        }
      }
      
      if (result.valid) {
        console.log(`  ✅ 第${i + 1}件查找成功`);
      } else {
        console.log(`  ❌ 第${i + 1}件查找失败:`, result.errors.join(', '));
      }
      
      lookupResults.push(result);
    }
    
    const validCount = lookupResults.filter(r => r.valid).length;
    const invalidCount = lookupResults.filter(r => !r.valid).length;
    
    console.log('');
    console.log('=== 查找总结 ===');
    console.log(`总计: ${works.length} 件`);
    console.log(`✅ 可复制: ${validCount} 件`);
    console.log(`❌ 跳过: ${invalidCount} 件`);
    console.log('');
    
    // ========== 步骤3：根据模式决定是否继续 ==========
    if (mode === 'all-or-nothing' && invalidCount > 0) {
      return {
        success: false,
        message: `查找失败，取消所有复制（${invalidCount}件有问题）`,
        error: {
          mode: 'all-or-nothing',
          total: works.length,
          lookupErrors: lookupResults
            .filter(r => !r.valid)
            .map(r => ({
              index: r.index,
              workName: r.workName,
              errors: r.errors
            }))
        }
      };
    }
    
    // ========== 步骤4：执行复制 ==========
    console.log('=== 步骤4：执行复制操作 ===');
    const executeResults = [];
    
    for (let i = 0; i < lookupResults.length; i++) {
      const lookup = lookupResults[i];
      
      console.log('');
      console.log(`--- 执行第${i + 1}件 ---`);
      
      if (!lookup.valid) {
        if (mode === 'stop-on-error') {
          console.log(`⏸️ 第${i + 1}件查找失败，停止后续复制`);
          executeResults.push({
            index: i,
            success: false,
            workName: lookup.workName,
            error: '查找失败',
            details: lookup.errors
          });
          break;
        } else {
          console.log(`⏭️ 第${i + 1}件查找失败，跳过`);
          executeResults.push({
            index: i,
            success: false,
            workName: lookup.workName,
            error: '查找失败',
            details: lookup.errors
          });
          continue;
        }
      }
      
      try {
        const sourceWork = lookup.sourceWork;
        const workName = sourceWork.artworkName || sourceWork.title;
        
        console.log(`  准备复制: "${workName}"`);
        console.log(`    从: ${sourceTable}`);
        console.log(`    到: ${targetTable}`);
        
        // 准备复制数据
        const copyData = { ...sourceWork };
        delete copyData._id;  // 删除原ID
        
        // 添加复制元数据
        copyData._copiedAt = new Date();
        copyData._copiedFrom = sourceTable;
        copyData._sourceId = sourceWork._id;
        
        if (lookup.targetExists && overwrite) {
          // 覆盖模式：更新已存在的记录
          await db.collection(targetTable)
            .doc(lookup.targetWorkId)
            .update({ data: copyData });
          
          console.log(`  ✅ 覆盖成功 (目标ID: ${lookup.targetWorkId.substring(0, 8)}...)`);
          
          executeResults.push({
            index: i,
            success: true,
            workName: workName,
            action: '覆盖',
            sourceId: sourceWork._id,
            targetId: lookup.targetWorkId
          });
          
        } else {
          // 插入模式：添加新记录
          const addResult = await db.collection(targetTable).add({
            data: copyData
          });
          
          console.log(`  ✅ 插入成功 (新ID: ${addResult._id.substring(0, 8)}...)`);
          
          executeResults.push({
            index: i,
            success: true,
            workName: workName,
            action: '插入',
            sourceId: sourceWork._id,
            targetId: addResult._id
          });
        }
        
        console.log(`  🎉 第${i + 1}件复制完成`);
        
      } catch (error) {
        console.error(`  ❌ 第${i + 1}件复制失败:`, error.message);
        
        executeResults.push({
          index: i,
          success: false,
          workName: lookup.workName,
          error: '数据库操作失败',
          details: error.message
        });
        
        if (mode === 'stop-on-error') {
          console.log('⏸️ 遇到错误，停止后续复制');
          break;
        }
      }
    }
    
    // ========== 步骤5：生成返回结果 ==========
    const succeededCount = executeResults.filter(r => r.success).length;
    const failedCount = executeResults.filter(r => !r.success).length;
    const insertedCount = executeResults.filter(r => r.success && r.action === '插入').length;
    const overwrittenCount = executeResults.filter(r => r.success && r.action === '覆盖').length;
    
    console.log('');
    console.log('========================================');
    console.log('=== 批量复制操作完成 ===');
    console.log('========================================');
    console.log('执行模式:', mode);
    console.log('源表:', sourceTable);
    console.log('目标表:', targetTable);
    console.log('总计:', works.length, '件');
    console.log('✅ 成功:', succeededCount, '件');
    console.log('   ├─ 插入:', insertedCount, '件');
    console.log('   └─ 覆盖:', overwrittenCount, '件');
    console.log('❌ 失败:', failedCount, '件');
    
    if (succeededCount > 0) {
      console.log('');
      console.log('成功复制的作品:');
      executeResults.filter(r => r.success).forEach(r => {
        console.log(`  ${r.action}: "${r.workName}"`);
      });
    }
    
    if (failedCount > 0) {
      console.log('');
      console.log('失败的复制:');
      executeResults.filter(r => !r.success).forEach(r => {
        console.log(`  第${r.index + 1}件: ${r.workName} - ${r.error}`);
      });
    }
    
    console.log('========================================');
    console.log('');
    
    const allSuccess = failedCount === 0;
    
    return {
      success: allSuccess || mode === 'best-effort',
      message: allSuccess 
        ? `批量复制完成：${works.length}件全部成功（插入${insertedCount}件，覆盖${overwrittenCount}件）`
        : `批量复制完成：${works.length}件中${succeededCount}件成功，${failedCount}件失败`,
      data: {
        mode: mode,
        sourceTable: sourceTable,
        targetTable: targetTable,
        total: works.length,
        succeeded: succeededCount,
        inserted: insertedCount,
        overwritten: overwrittenCount,
        failed: failedCount,
        results: executeResults,
        operationTime: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('批量复制作品失败:', error);
    return {
      success: false,
      message: '批量复制失败: ' + error.message,
      error: error.message
    };
  }
}





