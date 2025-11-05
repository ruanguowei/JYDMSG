// cloudfunctions/swapEvaluationsByName/index.js
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
    targetTable = 'pottery_submissions_clean',  // 默认表（用于同表交换）
    mode = 'best-effort'
  } = event;
  
  try {
    console.log('=== 开始批量交换作品评分（按名称） ===');
    console.log('默认表:', targetTable);
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
      
      // 设置默认表（如果没有单独指定）
      if (!swap.table1) {
        swap.table1 = targetTable;
      }
      if (!swap.table2) {
        swap.table2 = targetTable;
      }
    }
    
    console.log('✅ 参数验证通过');
    console.log('');
    
    // ========== 步骤2：批量查找作品 ==========
    console.log('=== 步骤2：根据名称查找作品 ===');
    
    const lookupResults = [];
    
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      const table1 = swap.table1 || targetTable;
      const table2 = swap.table2 || targetTable;
      
      console.log('');
      console.log(`--- 查找第${i}对 ---`);
      console.log(`作品1名称: "${swap.workName1}" (表: ${table1})`);
      console.log(`作品2名称: "${swap.workName2}" (表: ${table2})`);
      
      const result = {
        index: i,
        work1: null,
        work2: null,
        table1: table1,
        table2: table2,
        valid: true,
        errors: []
      };
      
      // 查找作品1（支持 artworkName 和 title 字段）
      try {
        const query1 = await db.collection(table1)
          .where({
            artworkName: swap.workName1
          })
          .get();
        
        if (query1.data.length === 0) {
          // 尝试用 title 字段查找
          const query1b = await db.collection(table1)
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
        const query2 = await db.collection(table2)
          .where({
            artworkName: swap.workName2
          })
          .get();
        
        if (query2.data.length === 0) {
          // 尝试用 title 字段查找
          const query2b = await db.collection(table2)
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
        
        const work1Name = work1.artworkName || work1.title;
        const work2Name = work2.artworkName || work2.title;
        const work1Id = work1._id;
        const work2Id = work2._id;
        
        const table1 = lookup.table1;
        const table2 = lookup.table2;
        
        console.log(`  准备交换完整数据:`);
        console.log(`    表1: ${table1} - "${work1Name}" (ID: ${work1Id.substring(0, 8)}...)`);
        console.log(`    表2: ${table2} - "${work2Name}" (ID: ${work2Id.substring(0, 8)}...)`);
        
        // 准备交换数据：复制所有字段，但保留原ID
        const work1Data = { ...work1 };
        const work2Data = { ...work2 };
        
        // 删除_id字段（不交换ID）
        delete work1Data._id;
        delete work2Data._id;
        
        // 更新作品1：使用作品2的所有数据（保留作品1的ID）
        await db.collection(table1).doc(work1Id).update({
          data: work2Data
        });
        console.log(`  ✅ 更新作品1成功：用作品2的数据覆盖 (表: ${table1})`);
        
        // 更新作品2：使用作品1的所有数据（保留作品2的ID）
        await db.collection(table2).doc(work2Id).update({
          data: work1Data
        });
        console.log(`  ✅ 更新作品2成功：用作品1的数据覆盖 (表: ${table2})`);
        
        console.log(`  🎉 第${i}对交换完成`);
        console.log(`    表1 ID ${work1Id.substring(0, 8)}... 现在是: "${work2Name}"的数据`);
        console.log(`    表2 ID ${work2Id.substring(0, 8)}... 现在是: "${work1Name}"的数据`);
        
        executeResults.push({
          index: i,
          success: true,
          work1: {
            id: work1Id,
            table: table1,
            originalName: work1Name,
            newName: work2Name
          },
          work2: {
            id: work2Id,
            table: table2,
            originalName: work2Name,
            newName: work1Name
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
    console.log('默认表:', targetTable);
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
        defaultTable: targetTable,
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


