// cloudfunctions/restoreWorkQualifications/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 恢复作品的参赛资格
 * 将表中所有作品的 qualification 设置为 true
 * 或删除被取消资格的标记
 */
exports.main = async (event, context) => {
  const {
    targetTable = 'pottery_submissions_clean',  // 目标表
    mode = 'all',  // 'all'（所有作品） | 'disqualified'（只恢复被取消资格的）
    dryRun = true  // 预览模式：true=只检查不修改，false=实际修改
  } = event;
  
  try {
    console.log('=== 恢复作品参赛资格 ===');
    console.log('目标表:', targetTable);
    console.log('模式:', mode === 'all' ? '所有作品' : '只恢复被取消资格的');
    console.log('执行:', dryRun ? '预览模式（只检查）' : '实际修改');
    
    // 1. 确定查询条件
    let whereCondition = {};
    
    if (mode === 'disqualified') {
      // 只查询被取消资格的作品
      whereCondition = {
        qualification: false
      };
    } else {
      // 查询所有作品
      whereCondition = {};
    }
    
    // 2. 分批读取作品
    console.log('');
    console.log('=== 读取作品数据 ===');
    
    const MAX_LIMIT = 100;
    let allWorks = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await db.collection(targetTable)
        .where(whereCondition)
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      allWorks = allWorks.concat(result.data);
      skip += MAX_LIMIT;
      hasMore = result.data.length === MAX_LIMIT;
      
      console.log(`已读取 ${allWorks.length} 件作品...`);
    }
    
    console.log('作品总数:', allWorks.length);
    
    if (allWorks.length === 0) {
      return {
        success: true,
        message: mode === 'disqualified' ? '没有被取消资格的作品' : '表中没有作品',
        data: {
          totalWorks: 0,
          restored: 0
        }
      };
    }
    
    // 3. 统计需要恢复的作品
    let needRestoreCount = 0;
    const restoreDetails = [];
    
    allWorks.forEach(work => {
      let needRestore = false;
      const issues = [];
      
      // 检查 qualification 字段
      if (work.qualification === false) {
        needRestore = true;
        issues.push('qualification=false');
      }
      
      // 检查是否有取消资格的相关字段
      if (work.disqualifyReason) {
        needRestore = true;
        issues.push(`取消原因: ${work.disqualifyReason}`);
      }
      
      if (work.disqualifyExpert) {
        issues.push(`操作专家: ${work.disqualifyExpert}`);
      }
      
      if (mode === 'all' || needRestore) {
        needRestoreCount++;
        
        restoreDetails.push({
          workId: work._id,
          artworkName: work.artworkName || work.title,
          studentName: work.name,
          currentQualification: work.qualification,
          issues: issues.length > 0 ? issues : ['无问题，强制恢复资格']
        });
        
        if (issues.length > 0) {
          console.log(`作品: ${work.artworkName || work.title}`);
          console.log(`  问题: ${issues.join(', ')}`);
        }
      }
    });
    
    console.log('');
    console.log('=== 统计结果 ===');
    console.log('检查作品数:', allWorks.length);
    console.log('需要恢复:', needRestoreCount, '件');
    
    // 4. 如果是预览模式，返回预览结果
    if (dryRun) {
      console.log('');
      console.log('⚠️ 预览模式：未执行修改操作');
      
      return {
        success: true,
        message: `预览完成：${needRestoreCount}件作品需要恢复参赛资格`,
        preview: true,
        data: {
          targetTable: targetTable,
          totalWorks: allWorks.length,
          needRestore: needRestoreCount,
          restoreDetails: restoreDetails.slice(0, 50)  // 只返回前50条详情
        }
      };
    }
    
    // 5. 实际恢复模式：批量更新
    console.log('');
    console.log('=== 开始恢复参赛资格 ===');
    
    let restoredCount = 0;
    let failedCount = 0;
    
    for (const detail of restoreDetails) {
      try {
        // 更新数据：恢复参赛资格，删除取消资格的标记
        const updateData = {
          qualification: true
        };
        
        // 删除取消资格相关字段（使用 remove 命令）
        const removeFields = {};
        removeFields.disqualifyReason = db.command.remove();
        removeFields.disqualifyTime = db.command.remove();
        removeFields.disqualifyExpert = db.command.remove();
        removeFields.disqualifyExpertCode = db.command.remove();
        
        await db.collection(targetTable)
          .doc(detail.workId)
          .update({
            data: {
              ...updateData,
              ...removeFields
            }
          });
        
        restoredCount++;
        
        if (restoredCount % 20 === 0) {
          console.log(`已恢复 ${restoredCount}/${needRestoreCount} 件...`);
        }
      } catch (error) {
        console.error(`恢复作品 ${detail.workId} 失败:`, error.message);
        failedCount++;
      }
    }
    
    console.log('');
    console.log('=== 恢复完成 ===');
    console.log('成功恢复:', restoredCount, '件');
    console.log('失败:', failedCount, '件');
    
    return {
      success: true,
      message: `恢复完成：${restoredCount}件作品参赛资格已恢复`,
      preview: false,
      data: {
        targetTable: targetTable,
        totalWorks: allWorks.length,
        restored: restoredCount,
        failed: failedCount,
        restoreDetails: restoreDetails
      }
    };
    
  } catch (error) {
    console.error('恢复参赛资格失败:', error);
    return {
      success: false,
      message: '恢复失败: ' + error.message,
      error: error.message
    };
  }
}





