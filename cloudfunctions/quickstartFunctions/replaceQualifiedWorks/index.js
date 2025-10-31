// cloudfunctions/quickstartFunctions/replaceQualifiedWorks/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 用未入围作品完全替换已入围作品
 * 不仅替换评分，而是整个作品数据
 */
exports.main = async (event, context) => {
  const {
    replacements = [],
    sourceTable = 'pottery_submissions_clean',
    targetTable = 'pottery_submissions_preliminary',
    mode = 'best-effort'
  } = event;
  
  try {
    console.log('=== 开始批量替换入围作品 ===');
    console.log('源表（未入围作品）:', sourceTable);
    console.log('目标表（入围结果）:', targetTable);
    console.log('执行模式:', mode);
    console.log('替换对数:', replacements.length);
    
    // ========== 步骤1：参数验证 ==========
    if (!Array.isArray(replacements) || replacements.length === 0) {
      return {
        success: false,
        message: '参数错误：replacements必须是非空数组'
      };
    }
    
    for (let i = 0; i < replacements.length; i++) {
      const replacement = replacements[i];
      if (!replacement.newWorkName || !replacement.oldWorkName) {
        return {
          success: false,
          message: `第${i}对参数不完整：需要提供 newWorkName 和 oldWorkName`,
          index: i
        };
      }
    }
    
    console.log('✅ 参数验证通过');
    console.log('');
    
    // ========== 步骤2：查找作品 ==========
    console.log('=== 步骤2：查找未入围作品和入围作品 ===');
    
    const lookupResults = [];
    
    for (let i = 0; i < replacements.length; i++) {
      const replacement = replacements[i];
      console.log('');
      console.log(`--- 查找第${i}对 ---`);
      console.log(`未入围作品: "${replacement.newWorkName}"`);
      console.log(`入围作品（将被替换）: "${replacement.oldWorkName}"`);
      
      const result = {
        index: i,
        newWork: null,        // 未入围作品
        oldWork: null,        // 入围作品
        valid: true,
        errors: []
      };
      
      // 查找未入围作品（在源表中）
      try {
        const queryNew = await db.collection(sourceTable)
          .where({
            artworkName: replacement.newWorkName
          })
          .get();
        
        if (queryNew.data.length === 0) {
          // 尝试用 title 字段查找
          const queryNewB = await db.collection(sourceTable)
            .where({
              title: replacement.newWorkName
            })
            .get();
          
          if (queryNewB.data.length > 0) {
            result.newWork = queryNewB.data[0];
            console.log(`  ✅ 未入围作品找到: ${result.newWork._id.substring(0, 8)}... (通过title字段)`);
          } else {
            result.valid = false;
            result.errors.push(`未入围作品未找到: "${replacement.newWorkName}"`);
            console.log(`  ❌ 未入围作品未在源表中找到`);
          }
        } else if (queryNew.data.length === 1) {
          result.newWork = queryNew.data[0];
          console.log(`  ✅ 未入围作品找到: ${result.newWork._id.substring(0, 8)}...`);
        } else {
          result.valid = false;
          result.errors.push(`未入围作品重名: "${replacement.newWorkName}" (找到${queryNew.data.length}个)`);
          console.log(`  ⚠️ 未入围作品重名，找到 ${queryNew.data.length} 个同名作品`);
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`查找未入围作品失败: ${error.message}`);
        console.error(`  ❌ 查找未入围作品失败:`, error.message);
      }
      
      // 查找入围作品（在目标表中）
      try {
        const queryOld = await db.collection(targetTable)
          .where({
            artworkName: replacement.oldWorkName
          })
          .get();
        
        if (queryOld.data.length === 0) {
          // 尝试用 title 字段查找
          const queryOldB = await db.collection(targetTable)
            .where({
              title: replacement.oldWorkName
            })
            .get();
          
          if (queryOldB.data.length > 0) {
            result.oldWork = queryOldB.data[0];
            console.log(`  ✅ 入围作品找到: ${result.oldWork._id.substring(0, 8)}... (通过title字段)`);
          } else {
            result.valid = false;
            result.errors.push(`入围作品未找到: "${replacement.oldWorkName}" (可能本来就没入围)`);
            console.log(`  ❌ 入围作品未在入围表中找到`);
          }
        } else if (queryOld.data.length === 1) {
          result.oldWork = queryOld.data[0];
          console.log(`  ✅ 入围作品找到: ${result.oldWork._id.substring(0, 8)}...`);
        } else {
          result.valid = false;
          result.errors.push(`入围作品重名: "${replacement.oldWorkName}" (找到${queryOld.data.length}个)`);
          console.log(`  ⚠️ 入围作品重名，找到 ${queryOld.data.length} 个同名作品`);
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`查找入围作品失败: ${error.message}`);
        console.error(`  ❌ 查找入围作品失败:`, error.message);
      }
      
      // 如果两个作品都找到了，检查未入围作品是否已在入围表中
      if (result.newWork && result.oldWork) {
        try {
          const checkQuery = await db.collection(targetTable)
            .where({
              artworkName: replacement.newWorkName
            })
            .get();
          
          if (checkQuery.data.length > 0) {
            result.valid = false;
            result.errors.push(`未入围作品"${replacement.newWorkName}"已在入围表中，无需替换`);
            console.log(`  ⚠️ 未入围作品已在入围表中`);
          } else {
            console.log(`  ✅ 确认未入围作品不在入围表中`);
          }
        } catch (error) {
          console.error(`  ⚠️ 检查重复失败:`, error.message);
        }
      }
      
      if (result.valid) {
        console.log(`  ✅ 第${i}对查找成功，准备替换`);
      } else {
        console.log(`  ❌ 第${i}对查找失败:`, result.errors.join(', '));
      }
      
      lookupResults.push(result);
    }
    
    const validCount = lookupResults.filter(r => r.valid).length;
    const invalidCount = lookupResults.filter(r => !r.valid).length;
    
    console.log('');
    console.log('=== 查找总结 ===');
    console.log(`总计: ${replacements.length} 对`);
    console.log(`✅ 可替换: ${validCount} 对`);
    console.log(`❌ 失败: ${invalidCount} 对`);
    console.log('');
    
    // ========== 步骤3：根据模式决定是否继续 ==========
    if (mode === 'all-or-nothing' && invalidCount > 0) {
      return {
        success: false,
        message: `查找失败，取消所有替换（${invalidCount}对未找到）`,
        error: {
          mode: 'all-or-nothing',
          total: replacements.length,
          lookupErrors: lookupResults
            .filter(r => !r.valid)
            .map(r => ({
              index: r.index,
              errors: r.errors
            }))
        }
      };
    }
    
    // ========== 步骤4：执行替换 ==========
    console.log('=== 步骤4：执行替换操作 ===');
    const executeResults = [];
    
    for (let i = 0; i < lookupResults.length; i++) {
      const lookup = lookupResults[i];
      const replacement = replacements[i];
      
      console.log('');
      console.log(`--- 执行第${i}对 ---`);
      
      if (!lookup.valid) {
        if (mode === 'stop-on-error') {
          console.log(`⏸️ 第${i}对查找失败，停止后续替换`);
          executeResults.push({
            index: i,
            success: false,
            error: '查找失败',
            details: lookup.errors
          });
          break;
        } else {
          console.log(`⏭️ 第${i}对查找失败，跳过执行`);
          executeResults.push({
            index: i,
            success: false,
            error: '查找失败',
            details: lookup.errors
          });
          continue;
        }
      }
      
      try {
        const newWork = lookup.newWork;
        const oldWork = lookup.oldWork;
        const targetId = oldWork._id;  // 保留入围表中的ID
        
        const newWorkName = newWork.artworkName || newWork.title;
        const oldWorkName = oldWork.artworkName || oldWork.title;
        const newEvalCount = (newWork.evaluations || []).length;
        const oldEvalCount = (oldWork.evaluations || []).length;
        
        console.log(`  准备替换:`);
        console.log(`    入围表ID: ${targetId.substring(0, 8)}...`);
        console.log(`    "${oldWorkName}" (${oldEvalCount}个评分)`);
        console.log(`    ↓ 替换为 ↓`);
        console.log(`    "${newWorkName}" (${newEvalCount}个评分)`);
        
        // 准备替换数据：使用未入围作品的完整数据
        const replaceData = { ...newWork };
        
        // 删除原_id（不能更新ID字段）
        delete replaceData._id;
        
        // 添加替换元数据
        replaceData._replacedAt = new Date();
        replaceData._replacedFrom = oldWorkName;
        replaceData._isReplaced = true;
        replaceData._sourceTable = sourceTable;
        
        // 执行替换：用未入围作品数据覆盖入围表中的记录
        await db.collection(targetTable).doc(targetId).update({
          data: replaceData
        });
        
        console.log(`  ✅ 替换成功`);
        console.log(`  📊 入围表ID ${targetId.substring(0, 8)}... 的数据已完全替换`);
        console.log(`     旧作品: "${oldWorkName}" → 新作品: "${newWorkName}"`);
        
        executeResults.push({
          index: i,
          success: true,
          newWork: {
            name: newWorkName,
            sourceId: newWork._id,
            evaluationCount: newEvalCount
          },
          oldWork: {
            name: oldWorkName,
            targetId: targetId,
            evaluationCount: oldEvalCount
          },
          replacedAt: replaceData._replacedAt
        });
        
      } catch (error) {
        console.error(`  ❌ 第${i}对替换失败:`, error.message);
        
        executeResults.push({
          index: i,
          success: false,
          error: '数据库更新失败',
          details: error.message
        });
        
        if (mode === 'stop-on-error') {
          console.log('⏸️ 遇到错误，停止后续替换');
          break;
        }
      }
    }
    
    // ========== 步骤5：生成返回结果 ==========
    const succeededCount = executeResults.filter(r => r.success).length;
    const failedCount = executeResults.filter(r => !r.success).length;
    
    console.log('');
    console.log('========================================');
    console.log('=== 批量替换操作完成 ===');
    console.log('========================================');
    console.log('执行模式:', mode);
    console.log('源表:', sourceTable);
    console.log('目标表:', targetTable);
    console.log('总计:', replacements.length, '对');
    console.log('✅ 成功:', succeededCount, '对');
    console.log('❌ 失败:', failedCount, '对');
    
    if (succeededCount > 0) {
      console.log('');
      console.log('成功替换的作品:');
      executeResults.filter(r => r.success).forEach(r => {
        console.log(`  第${r.index}对: "${r.oldWork.name}" → "${r.newWork.name}"`);
      });
    }
    
    if (failedCount > 0) {
      console.log('');
      console.log('失败的替换:');
      executeResults.filter(r => !r.success).forEach(r => {
        console.log(`  第${r.index}对: ${r.error}`);
      });
    }
    
    console.log('========================================');
    console.log('');
    
    const allSuccess = failedCount === 0;
    
    return {
      success: allSuccess || mode === 'best-effort',
      message: allSuccess 
        ? `批量替换完成：${replacements.length}对全部成功`
        : `批量替换完成：${replacements.length}对中${succeededCount}对成功，${failedCount}对失败`,
      data: {
        mode: mode,
        sourceTable: sourceTable,
        targetTable: targetTable,
        total: replacements.length,
        succeeded: succeededCount,
        failed: failedCount,
        results: executeResults,
        operationTime: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('批量替换入围作品失败:', error);
    return {
      success: false,
      message: '批量替换失败: ' + error.message,
      error: error.message
    };
  }
}


