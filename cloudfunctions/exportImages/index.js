// cloudfunctions/exportImages/index.js
const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100

/**
 * 导出图片云函数
 * 将指定表中的 perspectiveImage 按 category 分类导出到云存储
 * 
 * @param {string} tableName - 表名，默认 'secondWorks'
 * @param {string} exportFolder - 导出到云存储的文件夹名，默认 'exported_images'
 * @param {number} limit - 限制导出数量，0表示全部，默认 0
 */
exports.main = async (event, context) => {
  const {
    tableName = 'secondWorks',
    exportFolder = 'exported_images',
    limit = 0
  } = event;
  
  try {
    console.log('=== 图片导出云函数 ===');
    console.log('表名:', tableName);
    console.log('导出文件夹:', exportFolder);
    console.log('限制数量:', limit || '全部');
    console.log('');
    
    // 第1步：读取所有数据
    let allData = [];
    let lastId = null;
    
    while (true) {
      let query = db.collection(tableName);
      
      if (lastId) {
        query = query.where({
          _id: db.command.gt(lastId)
        });
      }
      
      const result = await query
        .orderBy('_id', 'asc')
        .limit(MAX_LIMIT)
        .get();
      
      if (result.data.length === 0) break;
      
      allData = allData.concat(result.data);
      lastId = result.data[result.data.length - 1]._id;
      
      console.log(`已读取 ${allData.length} 条数据...`);
      
      // 如果设置了限制且已达到，停止读取
      if (limit > 0 && allData.length >= limit) {
        allData = allData.slice(0, limit);
        break;
      }
    }
    
    console.log('');
    console.log('总数据量:', allData.length, '条');
    
    // 过滤有图片的数据
    const worksWithImage = allData.filter(item => item.perspectiveImage);
    console.log('有图片的作品:', worksWithImage.length, '件');
    
    if (worksWithImage.length === 0) {
      return {
        success: false,
        message: '没有找到包含图片的作品'
      };
    }
    
    // 第2步：按分类统计
    const categoryStats = {};
    worksWithImage.forEach(item => {
      const cat = item.category || '未分类';
      if (!categoryStats[cat]) {
        categoryStats[cat] = 0;
      }
      categoryStats[cat]++;
    });
    
    console.log('');
    console.log('=== 分类统计 ===');
    Object.keys(categoryStats).forEach(cat => {
      console.log(`${cat}: ${categoryStats[cat]} 件`);
    });
    console.log('');
    
    // 第3步：下载并上传图片
    console.log('=== 开始导出图片 ===');
    
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const exported = [];
    
    // 用于处理同名文件
    const nameCounter = {};
    
    for (let i = 0; i < worksWithImage.length; i++) {
      const work = worksWithImage[i];
      const category = sanitizeFileName(work.category || '未分类');
      let artworkName = sanitizeFileName(work.artworkName || '未命名作品');
      
      // 处理同名作品
      const nameKey = `${category}/${artworkName}`;
      if (nameCounter[nameKey]) {
        nameCounter[nameKey]++;
        artworkName = `${artworkName}_${nameCounter[nameKey]}`;
      } else {
        nameCounter[nameKey] = 1;
      }
      
      // 获取文件扩展名
      const ext = getFileExtension(work.perspectiveImage);
      const cloudPath = `${exportFolder}/${category}/${artworkName}${ext}`;
      
      try {
        // 下载图片
        const downloadResult = await cloud.downloadFile({
          fileID: work.perspectiveImage
        });
        
        // 上传到新路径
        const uploadResult = await cloud.uploadFile({
          cloudPath: cloudPath,
          fileContent: downloadResult.fileContent
        });
        
        successCount++;
        exported.push({
          artworkName: work.artworkName,
          category: work.category,
          cloudPath: cloudPath,
          fileID: uploadResult.fileID
        });
        
        if (successCount % 10 === 0) {
          console.log(`进度: ${successCount}/${worksWithImage.length}`);
        }
        
      } catch (err) {
        failCount++;
        errors.push({
          artworkName: work.artworkName,
          error: err.message
        });
        console.error(`导出失败: ${work.artworkName}`, err.message);
      }
    }
    
    console.log('');
    console.log('=== 导出完成 ===');
    console.log('成功:', successCount);
    console.log('失败:', failCount);
    console.log('');
    console.log('图片已导出到云存储:', exportFolder);
    console.log('可在云开发控制台 -> 存储 中查看和下载');
    
    return {
      success: true,
      message: `导出完成：${successCount}/${worksWithImage.length} 成功`,
      data: {
        tableName,
        exportFolder,
        total: worksWithImage.length,
        success: successCount,
        failed: failCount,
        categoryStats,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined
      }
    };
    
  } catch (error) {
    console.error('导出失败:', error);
    return {
      success: false,
      message: '导出失败: ' + error.message,
      error: error.message
    };
  }
}

/**
 * 清理文件名中的非法字符
 */
function sanitizeFileName(name) {
  if (!name) return '未命名';
  
  // 替换非法字符
  let clean = name
    .replace(/[\\/:*?"<>|]/g, '_')  // Windows非法字符
    .replace(/\s+/g, '_')            // 空格替换为下划线
    .replace(/\.+/g, '_')            // 多个点替换
    .replace(/_+/g, '_')             // 多个下划线合并
    .replace(/^_|_$/g, '')           // 去掉首尾下划线
    .trim();
  
  // 限制长度
  if (clean.length > 50) {
    clean = clean.substring(0, 50);
  }
  
  return clean || '未命名';
}

/**
 * 从云存储fileID或URL中提取文件扩展名
 */
function getFileExtension(fileID) {
  if (!fileID) return '.jpg';
  
  // 尝试从fileID中提取扩展名
  const match = fileID.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    const ext = match[1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
      return '.' + ext;
    }
  }
  
  return '.jpg';  // 默认jpg
}
