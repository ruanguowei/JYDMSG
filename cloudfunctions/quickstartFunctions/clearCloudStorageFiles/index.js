const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 扫描数据库并清理云存储里的用户照片、作品图片、递送照片与证书
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 开始云存储清理函数 ===');
    console.log('事件参数:', JSON.stringify(event));

    // 安全锁 1: 必须明确确认清理
    if (!event.confirmClear) {
      return {
        success: false,
        errMsg: '操作拒绝：必须指定 confirmClear = true 才能运行清理。'
      };
    }

    // 安全锁 2: 默认 Dry-Run 只读预检模式
    const dryRun = event.dryRun !== false; // 只有明确传入 false 时才执行物理删除
    console.log(`执行模式: ${dryRun ? 'Dry-Run (只读预检)' : 'PHYSICAL CLEARING (物理删除!)'}`);

    // 需要扫描的目标数据库集合
    const collectionsToScan = [
      'pottery_submissions',
      'pottery_submissions_clean',
      'pottery_submissions_preliminary',
      'pottery_submissions_for_final',
      'pottery_submissions_final',
      'artwork_deliveries'
    ];

    // 需要清理的目标文件夹前缀（从 cloud://.../ 中提取判断）
    const foldersToClean = [
      'artwork_photos',
      'personal_photos',
      'artwork-delivery',
      '证书',
      '第二届入围视频作品'
    ];

    const uniqueFileIDs = new Set();
    const scanReports = {};

    // 1. 开始分批扫描数据库，收集所有云存储文件 ID
    for (const collName of collectionsToScan) {
      try {
        console.log(`正在扫描集合: ${collName}`);
        const countRes = await db.collection(collName).count();
        const total = countRes.total;
        scanReports[collName] = { totalRecords: total, extractedFiles: 0 };

        if (total === 0) continue;

        const batchSize = 100;
        const batches = Math.ceil(total / batchSize);

        for (let i = 0; i < batches; i++) {
          const res = await db.collection(collName)
            .skip(i * batchSize)
            .limit(batchSize)
            .get();

          let extractedInBatch = 0;
          for (const record of res.data) {
            traverseAndExtract(record, foldersToClean, uniqueFileIDs);
          }
        }
        
        // 计算当前集合提取出的文件数量
        // 由于是 Set 结构，这里仅作记录参考
        console.log(`集合 ${collName} 扫描完成`);
      } catch (collErr) {
        console.error(`扫描集合 ${collName} 失败:`, collErr);
        scanReports[collName] = { error: collErr.message };
      }
    }

    const fileList = Array.from(uniqueFileIDs);
    console.log(`扫描完成！共提取出符合清理条件的唯一云存储文件数: ${fileList.length}`);

    // 2. 按文件夹分类统计文件数（用于分析报告）
    const folderStats = {};
    foldersToClean.forEach(f => { folderStats[f] = 0; });
    folderStats['other_matched'] = 0;

    fileList.forEach(fileID => {
      // 提取 cloud://bucket/ 之后的部分
      const pathPart = fileID.split('/').slice(3).join('/');
      let matched = false;
      for (const folder of foldersToClean) {
        if (pathPart.startsWith(folder + '/')) {
          folderStats[folder]++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        folderStats['other_matched']++;
      }
    });

    // 3. 执行删除操作 (如果是物理删除模式)
    const deleteResults = {
      successCount: 0,
      failCount: 0,
      errors: []
    };

    if (!dryRun && fileList.length > 0) {
      console.log('=== 警告：开始物理删除文件 ===');
      const deleteBatchSize = 50; // cloud.deleteFile 最大支持单次 50 个文件
      const totalFiles = fileList.length;
      
      for (let i = 0; i < totalFiles; i += deleteBatchSize) {
        const batch = fileList.slice(i, i + deleteBatchSize);
        try {
          console.log(`正在删除批次: ${i} 至 ${i + batch.length}，共 ${totalFiles} 个文件`);
          const res = await cloud.deleteFile({
            fileList: batch
          });
          
          if (res.fileList) {
            res.fileList.forEach(item => {
              if (item.status === 0) {
                deleteResults.successCount++;
              } else {
                deleteResults.failCount++;
                deleteResults.errors.push({ fileID: item.fileID, status: item.status, errMsg: item.errMsg });
              }
            });
          }
        } catch (delErr) {
          console.error(`删除批次失败 (${i} - ${i + batch.length}):`, delErr);
          deleteResults.failCount += batch.length;
          deleteResults.errors.push({ batch: `${i} - ${i + batch.length}`, error: delErr.message });
        }
      }
      console.log('=== 物理删除完成 ===');
    }

    return {
      success: true,
      dryRun: dryRun,
      message: dryRun 
        ? `预检扫描成功，共发现符合删除条件的文件 ${fileList.length} 个（只读预检，未物理删除）。`
        : `物理清理执行成功！已成功物理删除 ${deleteResults.successCount} 个文件，失败 ${deleteResults.failCount} 个。`,
      data: {
        totalFound: fileList.length,
        folderStats: folderStats,
        scanDetails: scanReports,
        deleteResults: dryRun ? null : {
          success: deleteResults.successCount,
          failed: deleteResults.failCount,
          errors: deleteResults.errors
        },
        fileListPreview: fileList.slice(0, 50) // 返回前 50 个文件作为预览
      }
    };

  } catch (error) {
    console.error('清理云存储文件异常:', error);
    return {
      success: false,
      errMsg: '清理云存储文件异常: ' + error.message
    };
  }
};

/**
 * 递归遍历对象提取特定格式的云存储路径
 */
function traverseAndExtract(obj, foldersToClean, resultSet) {
  if (typeof obj === 'string') {
    if (obj.startsWith('cloud://')) {
      const pathPart = obj.split('/').slice(3).join('/'); // 获取环境ID之后的文件路径
      const isTarget = foldersToClean.some(folder => pathPart.startsWith(folder + '/'));
      if (isTarget) {
        resultSet.add(obj);
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => traverseAndExtract(item, foldersToClean, resultSet));
  } else if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(value => traverseAndExtract(value, foldersToClean, resultSet));
  }
}
