// cloudfunctions/cleanOrphanEvaluations/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 清理孤儿评分数据
 * 删除作品评分记录中，专家数据库里已不存在的评审信息
 */
exports.main = async (event, context) => {
  const {
    targetTable = 'pottery_submissions_clean',  // 目标表：pottery_submissions_clean | pottery_submissions_for_final
    dryRun = true  // 预览模式：true=只检查不删除，false=实际删除
  } = event;
  
  try {
    console.log('=== 清理孤儿评分数据 ===');
    console.log('目标表:', targetTable);
    console.log('模式:', dryRun ? '预览模式（只检查）' : '删除模式（实际删除）');
    
    // 1. 读取所有有效的专家 expertCode
    const expertsResult = await db.collection('experts')
      .where({ status: 'active' })
      .get();
    
    const validExpertCodes = expertsResult.data.map(expert => expert.expertCode);
    console.log('有效专家数:', validExpertCodes.length);
    console.log('有效专家代码:', validExpertCodes);
    
    if (validExpertCodes.length === 0) {
      return {
        success: false,
        message: '专家数据库为空，无法执行清理'
      };
    }
    
    // 2. 分批读取所有作品
    console.log('');
    console.log('=== 读取作品数据 ===');
    
    const MAX_LIMIT = 100;
    let allWorks = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await db.collection(targetTable)
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      allWorks = allWorks.concat(result.data);
      skip += MAX_LIMIT;
      hasMore = result.data.length === MAX_LIMIT;
      
      console.log(`已读取 ${allWorks.length} 件作品...`);
    }
    
    console.log('作品总数:', allWorks.length);
    
    // 3. 检查每件作品的评分记录
    console.log('');
    console.log('=== 检查评分记录 ===');
    
    let worksNeedClean = 0;  // 需要清理的作品数
    let totalOrphanEvaluations = 0;  // 孤儿评分总数
    const cleanDetails = [];  // 清理详情
    const worksToUpdate = [];  // 需要更新的作品
    
    allWorks.forEach(work => {
      const evaluations = work.evaluations || [];
      
      if (evaluations.length === 0) {
        return;  // 没有评分，跳过
      }
      
      // 找出孤儿评分（expertCode 不在有效专家列表中）
      const validEvaluations = [];
      const orphanEvaluations = [];
      
      evaluations.forEach(evaluation => {
        const expertCode = evaluation.expertCode;
        
        if (validExpertCodes.includes(expertCode)) {
          // 有效评分
          validEvaluations.push(evaluation);
        } else {
          // 孤儿评分（专家不存在）
          orphanEvaluations.push(evaluation);
          totalOrphanEvaluations++;
        }
      });
      
      // 如果有孤儿评分，记录这件作品
      if (orphanEvaluations.length > 0) {
        worksNeedClean++;
        
        const detail = {
          workId: work._id,
          artworkName: work.artworkName || work.title,
          totalEvaluations: evaluations.length,
          validEvaluations: validEvaluations.length,
          orphanEvaluations: orphanEvaluations.length,
          orphanExpertCodes: orphanEvaluations.map(e => e.expertCode),
          orphanExpertNames: orphanEvaluations.map(e => e.expertName || '未知')
        };
        
        cleanDetails.push(detail);
        
        // 如果不是预览模式，准备更新数据
        if (!dryRun) {
          worksToUpdate.push({
            workId: work._id,
            newEvaluations: validEvaluations  // 只保留有效评分
          });
        }
        
        console.log(`作品: ${work.artworkName || work.title}`);
        console.log(`  原评分数: ${evaluations.length}, 有效: ${validEvaluations.length}, 孤儿: ${orphanEvaluations.length}`);
        console.log(`  孤儿专家: ${orphanEvaluations.map(e => e.expertName || e.expertCode).join(', ')}`);
      }
    });
    
    console.log('');
    console.log('=== 检查统计 ===');
    console.log('总作品数:', allWorks.length);
    console.log('需要清理的作品数:', worksNeedClean);
    console.log('孤儿评分总数:', totalOrphanEvaluations);
    
    // 4. 如果是预览模式，直接返回结果
    if (dryRun) {
      console.log('');
      console.log('⚠️ 预览模式：未执行删除操作');
      
      return {
        success: true,
        message: `预览完成：发现${worksNeedClean}件作品包含${totalOrphanEvaluations}条孤儿评分`,
        preview: true,
        data: {
          targetTable: targetTable,
          totalWorks: allWorks.length,
          worksNeedClean: worksNeedClean,
          totalOrphanEvaluations: totalOrphanEvaluations,
          cleanDetails: cleanDetails.slice(0, 50)  // 只返回前50条详情
        }
      };
    }
    
    // 5. 实际删除模式：更新作品数据
    console.log('');
    console.log('=== 开始清理孤儿评分 ===');
    
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const item of worksToUpdate) {
      try {
        await db.collection(targetTable)
          .doc(item.workId)
          .update({
            data: {
              evaluations: item.newEvaluations
            }
          });
        
        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`已清理 ${updatedCount}/${worksToUpdate.length} 件作品...`);
        }
      } catch (error) {
        console.error(`更新作品 ${item.workId} 失败:`, error);
        failedCount++;
      }
    }
    
    console.log('');
    console.log('=== 清理完成 ===');
    console.log('成功更新:', updatedCount, '件作品');
    console.log('失败:', failedCount, '件作品');
    console.log('清理的孤儿评分总数:', totalOrphanEvaluations);
    
    return {
      success: true,
      message: `清理完成：${updatedCount}件作品，清除${totalOrphanEvaluations}条孤儿评分`,
      preview: false,
      data: {
        targetTable: targetTable,
        totalWorks: allWorks.length,
        worksUpdated: updatedCount,
        worksFailed: failedCount,
        orphanEvaluationsRemoved: totalOrphanEvaluations,
        cleanDetails: cleanDetails
      }
    };
    
  } catch (error) {
    console.error('清理孤儿评分失败:', error);
    return {
      success: false,
      message: '清理失败: ' + error.message,
      error: error.message
    };
  }
}






