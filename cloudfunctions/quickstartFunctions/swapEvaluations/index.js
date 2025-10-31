// cloudfunctions/quickstartFunctions/swapEvaluations/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 交换作品的评分数据
 * 支持批量交换，ID+名称双重验证
 */
exports.main = async (event, context) => {
  const {
    swaps = [],
    targetTable = 'pottery_submissions_clean',
    mode = 'best-effort'  // 'all-or-nothing' | 'best-effort' | 'stop-on-error'
  } = event;
  
  try {
    console.log('=== 开始批量交换作品评分 ===');
    console.log('目标表:', targetTable);
    console.log('执行模式:', mode);
    console.log('交换对数:', swaps.length);
    
    // ========== 步骤1：参数验证 ==========
    if (!Array.isArray(swaps) || swaps.length === 0) {
      return {
        success: false,
        message: '参数错误：swaps必须是非空数组'
      };
    }
    
    // 验证每个交换对的参数完整性
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      if (!swap.workId1 || !swap.workName1 || !swap.workId2 || !swap.workName2) {
        return {
          success: false,
          message: `第${i}对参数不完整：需要提供 workId1, workName1, workId2, workName2`,
          index: i
        };
      }
      
      if (swap.workId1 === swap.workId2) {
        return {
          success: false,
          message: `第${i}对错误：不能交换同一个作品`,
          index: i
        };
      }
    }
    
    // 检查ID冲突（同一作品不能出现在多对中）
    const allWorkIds = [];
    const conflicts = {};
    
    swaps.forEach((swap, index) => {
      [swap.workId1, swap.workId2].forEach(id => {
        if (!conflicts[id]) {
          conflicts[id] = [];
        }
        conflicts[id].push(index);
        allWorkIds.push(id);
      });
    });
    
    // 找出冲突的ID
    const conflictIds = Object.keys(conflicts).filter(id => conflicts[id].length > 1);
    
    if (conflictIds.length > 0) {
      return {
        success: false,
        message: '检测到ID冲突：同一作品不能出现在多个交换对中',
        error: {
          conflicts: conflictIds.map(id => ({
            workId: id,
            appearsIn: conflicts[id]
          }))
        }
      };
    }
    
    console.log('✅ 参数验证通过');
    
    // ========== 步骤2：批量读取所有作品 ==========
    const uniqueIds = [...new Set(allWorkIds)];
    console.log('');
    console.log('=== 步骤2：批量读取作品数据 ===');
    console.log('需要读取的作品数:', uniqueIds.length);
    console.log('目标表:', targetTable);
    
    const worksMap = {};  // ID -> 作品数据
    let foundCount = 0;
    let notFoundCount = 0;
    
    // 批量读取作品
    for (const workId of uniqueIds) {
      try {
        const result = await db.collection(targetTable).doc(workId).get();
        if (result.data) {
          worksMap[workId] = result.data;
          foundCount++;
          const workName = result.data.artworkName || result.data.title || '【无名称】';
          console.log(`✅ 找到作品: ${workId.substring(0, 8)}... - "${workName}"`);
        } else {
          worksMap[workId] = null;
          notFoundCount++;
          console.log(`❌ 未找到: ${workId.substring(0, 8)}... - 表中不存在此ID`);
        }
      } catch (error) {
        worksMap[workId] = null;
        notFoundCount++;
        console.error(`❌ 读取失败: ${workId.substring(0, 8)}... - ${error.message}`);
      }
    }
    
    console.log('');
    console.log(`读取统计: 找到 ${foundCount} 件, 未找到 ${notFoundCount} 件`);
    console.log('✅ 作品数据读取完成');
    console.log('');
    
    // ========== 步骤3：批量验证 ==========
    console.log('=== 步骤3：批量验证作品信息 ===');
    const validationResults = [];
    
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      console.log('');
      console.log(`--- 验证第${i}对 ---`);
      console.log(`作品1 ID: ${swap.workId1.substring(0, 8)}...`);
      console.log(`作品1 期望名称: "${swap.workName1}"`);
      console.log(`作品2 ID: ${swap.workId2.substring(0, 8)}...`);
      console.log(`作品2 期望名称: "${swap.workName2}"`);
      
      const result = {
        index: i,
        valid: true,
        errors: []
      };
      
      // 检查作品1是否存在
      const work1 = worksMap[swap.workId1];
      if (!work1) {
        result.valid = false;
        result.errors.push({
          type: 'work1_not_found',
          message: '作品1不存在',
          workId: swap.workId1
        });
        console.log(`  ❌ 作品1: 在表 ${targetTable} 中不存在`);
      } else {
        console.log(`  ✅ 作品1: 找到`);
      }
      
      // 检查作品2是否存在
      const work2 = worksMap[swap.workId2];
      if (!work2) {
        result.valid = false;
        result.errors.push({
          type: 'work2_not_found',
          message: '作品2不存在',
          workId: swap.workId2
        });
        console.log(`  ❌ 作品2: 在表 ${targetTable} 中不存在`);
      } else {
        console.log(`  ✅ 作品2: 找到`);
      }
      
      // 如果作品存在，验证名称
      if (work1) {
        const realName1 = work1.artworkName || work1.title || '';
        console.log(`  作品1实际名称: "${realName1}"`);
        if (realName1.trim() !== swap.workName1.trim()) {
          result.valid = false;
          result.errors.push({
            type: 'work1_name_mismatch',
            message: '作品1名称不匹配',
            workId: swap.workId1,
            expected: realName1,
            provided: swap.workName1
          });
          console.log(`  ❌ 作品1名称不匹配!`);
          console.log(`     数据库中: "${realName1}"`);
          console.log(`     你输入的: "${swap.workName1}"`);
        } else {
          console.log(`  ✅ 作品1名称匹配`);
        }
      }
      
      if (work2) {
        const realName2 = work2.artworkName || work2.title || '';
        console.log(`  作品2实际名称: "${realName2}"`);
        if (realName2.trim() !== swap.workName2.trim()) {
          result.valid = false;
          result.errors.push({
            type: 'work2_name_mismatch',
            message: '作品2名称不匹配',
            workId: swap.workId2,
            expected: realName2,
            provided: swap.workName2
          });
          console.log(`  ❌ 作品2名称不匹配!`);
          console.log(`     数据库中: "${realName2}"`);
          console.log(`     你输入的: "${swap.workName2}"`);
        } else {
          console.log(`  ✅ 作品2名称匹配`);
        }
      }
      
      validationResults.push(result);
      
      if (!result.valid) {
        console.log(`  ❌ 第${i}对验证失败`);
      } else {
        console.log(`  ✅ 第${i}对验证通过`);
      }
    }
    
    const validCount = validationResults.filter(r => r.valid).length;
    const invalidCount = validationResults.filter(r => !r.valid).length;
    
    console.log('');
    console.log('=== 验证总结 ===');
    console.log(`总计: ${swaps.length} 对`);
    console.log(`✅ 通过: ${validCount} 对`);
    console.log(`❌ 失败: ${invalidCount} 对`);
    console.log('');
    
    // ========== 步骤4：根据模式决定是否继续 ==========
    if (mode === 'all-or-nothing' && invalidCount > 0) {
      // 全部或全不模式：任何一对失败都取消所有交换
      return {
        success: false,
        message: `验证失败，取消所有交换（${invalidCount}对验证失败）`,
        error: {
          mode: 'all-or-nothing',
          total: swaps.length,
          validationErrors: validationResults
            .filter(r => !r.valid)
            .map(r => ({
              index: r.index,
              errors: r.errors
            }))
        }
      };
    }
    
    // ========== 步骤5：执行交换 ==========
    console.log('=== 步骤5：执行交换操作 ===');
    const executeResults = [];
    
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      const validation = validationResults[i];
      
      console.log('');
      console.log(`--- 执行第${i}对 ---`);
      
      // 如果验证失败，跳过（best-effort模式）或停止（stop-on-error模式）
      if (!validation.valid) {
        if (mode === 'stop-on-error') {
          console.log(`⏸️ 第${i}对验证失败，停止后续交换`);
          executeResults.push({
            index: i,
            success: false,
            error: '验证失败',
            details: validation.errors
          });
          break;
        } else {
          // best-effort: 跳过
          console.log(`⏭️ 第${i}对验证失败，跳过执行`);
          executeResults.push({
            index: i,
            success: false,
            error: '验证失败',
            details: validation.errors
          });
          continue;
        }
      }
      
      // 执行交换
      try {
        const work1 = worksMap[swap.workId1];
        const work2 = worksMap[swap.workId2];
        
        const evals1 = work1.evaluations || [];
        const evals2 = work2.evaluations || [];
        
        const work1Name = work1.artworkName || work1.title;
        const work2Name = work2.artworkName || work2.title;
        
        console.log(`  准备交换:`);
        console.log(`    "${work1Name}" (${evals1.length}个评分) ⟷ "${work2Name}" (${evals2.length}个评分)`);
        
        // 更新作品1：使用作品2的评分
        await db.collection(targetTable).doc(swap.workId1).update({
          data: { evaluations: evals2 }
        });
        console.log(`  ✅ 更新作品1成功`);
        
        // 更新作品2：使用作品1的评分
        await db.collection(targetTable).doc(swap.workId2).update({
          data: { evaluations: evals1 }
        });
        console.log(`  ✅ 更新作品2成功`);
        
        console.log(`  🎉 第${i}对交换完成`);
        console.log(`    "${work1Name}": ${evals1.length}个 → ${evals2.length}个评分`);
        console.log(`    "${work2Name}": ${evals2.length}个 → ${evals1.length}个评分`);
        
        executeResults.push({
          index: i,
          success: true,
          work1: {
            id: swap.workId1,
            name: work1Name,
            beforeCount: evals1.length,
            afterCount: evals2.length
          },
          work2: {
            id: swap.workId2,
            name: work2Name,
            beforeCount: evals2.length,
            afterCount: evals1.length
          }
        });
        
      } catch (error) {
        console.error(`  ❌ 第${i}对交换失败:`, error.message);
        
        executeResults.push({
          index: i,
          success: false,
          error: '数据库更新失败',
          details: error.message
        });
        
        if (mode === 'stop-on-error') {
          console.log('⏸️ 遇到错误，停止后续交换');
          break;
        }
      }
    }
    
    // ========== 步骤6：生成返回结果 ==========
    const succeededCount = executeResults.filter(r => r.success).length;
    const failedCount = executeResults.filter(r => !r.success).length;
    
    console.log('');
    console.log('========================================');
    console.log('=== 批量交换操作完成 ===');
    console.log('========================================');
    console.log('执行模式:', mode);
    console.log('目标表:', targetTable);
    console.log('总计:', swaps.length, '对');
    console.log('✅ 成功:', succeededCount, '对');
    console.log('❌ 失败:', failedCount, '对');
    
    if (succeededCount > 0) {
      console.log('');
      console.log('成功交换的作品:');
      executeResults.filter(r => r.success).forEach(r => {
        console.log(`  第${r.index}对: "${r.work1.name}" ⟷ "${r.work2.name}"`);
      });
    }
    
    if (failedCount > 0) {
      console.log('');
      console.log('失败的交换:');
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
        ? `批量交换完成：${swaps.length}对全部成功`
        : `批量交换完成：${swaps.length}对中${succeededCount}对成功，${failedCount}对失败`,
      data: {
        mode: mode,
        total: swaps.length,
        succeeded: succeededCount,
        failed: failedCount,
        results: executeResults,
        table: targetTable,
        operationTime: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('批量交换作品评分失败:', error);
    return {
      success: false,
      message: '批量交换失败: ' + error.message,
      error: error.message
    };
  }
}

