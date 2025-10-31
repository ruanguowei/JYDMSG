// cloudfunctions/quickstartFunctions/swapEvaluationsByName/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 根据作品名称交换评分数据
 * 只需要提供作品名称，自动查找并交换
 */
exports.main = async (event, context) => {
  const {
    swaps = [],
    targetTable = 'pottery_submissions_clean',
    mode = 'best-effort'
  } = event;
  
  try {
    console.log('=== 开始批量交换作品评分（按名称） ===');
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
    
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      if (!swap.workName1 || !swap.workName2) {
        return {
          success: false,
          message: `第${i}对参数不完整：需要提供 workName1 和 workName2`,
          index: i
        };
      }
    }
    
    console.log('✅ 参数验证通过');
    console.log('');
    
    // ========== 步骤2：批量查找作品 ==========
    console.log('=== 步骤2：根据名称查找作品 ===');
    
    const lookupResults = [];
    
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      console.log('');
      console.log(`--- 查找第${i}对 ---`);
      console.log(`作品1名称: "${swap.workName1}"`);
      console.log(`作品2名称: "${swap.workName2}"`);
      
      const result = {
        index: i,
        work1: null,
        work2: null,
        valid: true,
        errors: []
      };
      
      // 查找作品1（支持 artworkName 和 title 字段）
      try {
        const query1 = await db.collection(targetTable)
          .where({
            artworkName: swap.workName1
          })
          .get();
        
        if (query1.data.length === 0) {
          // 尝试用 title 字段查找
          const query1b = await db.collection(targetTable)
            .where({
              title: swap.workName1
            })
            .get();
          
          if (query1b.data.length > 0) {
            result.work1 = query1b.data[0];
            console.log(`  ✅ 作品1找到: ${result.work1._id.substring(0, 8)}... (通过title字段)`);
          } else {
            result.valid = false;
            result.errors.push(`作品1未找到: "${swap.workName1}"`);
            console.log(`  ❌ 作品1未找到`);
          }
        } else if (query1.data.length === 1) {
          result.work1 = query1.data[0];
          console.log(`  ✅ 作品1找到: ${result.work1._id.substring(0, 8)}...`);
        } else {
          result.valid = false;
          result.errors.push(`作品1重名: "${swap.workName1}" (找到${query1.data.length}个)`);
          console.log(`  ⚠️ 作品1重名，找到 ${query1.data.length} 个同名作品`);
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`查找作品1失败: ${error.message}`);
        console.error(`  ❌ 查找作品1失败:`, error.message);
      }
      
      // 查找作品2
      try {
        const query2 = await db.collection(targetTable)
          .where({
            artworkName: swap.workName2
          })
          .get();
        
        if (query2.data.length === 0) {
          // 尝试用 title 字段查找
          const query2b = await db.collection(targetTable)
            .where({
              title: swap.workName2
            })
            .get();
          
          if (query2b.data.length > 0) {
            result.work2 = query2b.data[0];
            console.log(`  ✅ 作品2找到: ${result.work2._id.substring(0, 8)}... (通过title字段)`);
          } else {
            result.valid = false;
            result.errors.push(`作品2未找到: "${swap.workName2}"`);
            console.log(`  ❌ 作品2未找到`);
          }
        } else if (query2.data.length === 1) {
          result.work2 = query2.data[0];
          console.log(`  ✅ 作品2找到: ${result.work2._id.substring(0, 8)}...`);
        } else {
          result.valid = false;
          result.errors.push(`作品2重名: "${swap.workName2}" (找到${query2.data.length}个)`);
          console.log(`  ⚠️ 作品2重名，找到 ${query2.data.length} 个同名作品`);
        }
      } catch (error) {
        result.valid = false;
        result.errors.push(`查找作品2失败: ${error.message}`);
        console.error(`  ❌ 查找作品2失败:`, error.message);
      }
      
      if (result.valid) {
        console.log(`  ✅ 第${i}对查找成功`);
      } else {
        console.log(`  ❌ 第${i}对查找失败:`, result.errors.join(', '));
      }
      
      lookupResults.push(result);
    }
    
    const validCount = lookupResults.filter(r => r.valid).length;
    const invalidCount = lookupResults.filter(r => !r.valid).length;
    
    console.log('');
    console.log('=== 查找总结 ===');
    console.log(`总计: ${swaps.length} 对`);
    console.log(`✅ 找到: ${validCount} 对`);
    console.log(`❌ 失败: ${invalidCount} 对`);
    console.log('');
    
    // ========== 步骤3：根据模式决定是否继续 ==========
    if (mode === 'all-or-nothing' && invalidCount > 0) {
      return {
        success: false,
        message: `查找失败，取消所有交换（${invalidCount}对未找到）`,
        error: {
          mode: 'all-or-nothing',
          total: swaps.length,
          lookupErrors: lookupResults
            .filter(r => !r.valid)
            .map(r => ({
              index: r.index,
              errors: r.errors
            }))
        }
      };
    }
    
    // ========== 步骤4：执行交换 ==========
    console.log('=== 步骤4：执行交换操作 ===');
    const executeResults = [];
    
    for (let i = 0; i < lookupResults.length; i++) {
      const lookup = lookupResults[i];
      const swap = swaps[i];
      
      console.log('');
      console.log(`--- 执行第${i}对 ---`);
      
      if (!lookup.valid) {
        if (mode === 'stop-on-error') {
          console.log(`⏸️ 第${i}对查找失败，停止后续交换`);
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
        const work1 = lookup.work1;
        const work2 = lookup.work2;
        
        const evals1 = work1.evaluations || [];
        const evals2 = work2.evaluations || [];
        
        const work1Name = work1.artworkName || work1.title;
        const work2Name = work2.artworkName || work2.title;
        
        console.log(`  准备交换:`);
        console.log(`    "${work1Name}" (${evals1.length}个评分) ⟷ "${work2Name}" (${evals2.length}个评分)`);
        
        // 更新作品1：使用作品2的评分
        await db.collection(targetTable).doc(work1._id).update({
          data: { evaluations: evals2 }
        });
        console.log(`  ✅ 更新作品1成功`);
        
        // 更新作品2：使用作品1的评分
        await db.collection(targetTable).doc(work2._id).update({
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
            id: work1._id,
            name: work1Name,
            beforeCount: evals1.length,
            afterCount: evals2.length
          },
          work2: {
            id: work2._id,
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
    
    // ========== 步骤5：生成返回结果 ==========
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


