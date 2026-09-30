// cloudfunctions/exportImageList/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100

/**
 * 导出图片列表云函数
 * 将作品名称、分类、下载链接写入云存储的 JSON 文件
 * 
 * @param {string} tableName - 表名，默认 'secondWorks'
 * @param {string} outputFile - 输出文件名，默认 'image_list.json'
 */
exports.main = async (event, context) => {
  const {
    tableName = 'secondWorks',
    outputFile = 'image_list.json'
  } = event;
  
  try {
    console.log('=== 导出图片列表 ===');
    console.log('表名:', tableName);
    
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
        .field({
          _id: true,
          artworkName: true,
          category: true,
          perspectiveImage: true
        })
        .orderBy('_id', 'asc')
        .limit(MAX_LIMIT)
        .get();
      
      if (result.data.length === 0) break;
      
      allData = allData.concat(result.data);
      lastId = result.data[result.data.length - 1]._id;
      
      console.log(`已读取 ${allData.length} 条数据...`);
    }
    
    console.log('总数据量:', allData.length);
    
    // 过滤有图片的数据
    const worksWithImage = allData.filter(item => item.perspectiveImage);
    console.log('有图片的作品:', worksWithImage.length);
    
    if (worksWithImage.length === 0) {
      return {
        success: false,
        message: '没有找到包含图片的作品'
      };
    }
    
    // 第2步：判断图片URL类型并获取下载链接
    // 检查第一条数据判断是 fileID 还是 HTTP URL
    const firstImage = worksWithImage[0].perspectiveImage;
    const isHttpUrl = firstImage.startsWith('http://') || firstImage.startsWith('https://');
    
    console.log('图片存储类型:', isHttpUrl ? 'HTTP URL（直接可用）' : '云存储 fileID');
    
    let imageList = [];
    
    if (isHttpUrl) {
      // 已经是 HTTP URL，直接使用
      imageList = worksWithImage.map(item => ({
        artworkName: item.artworkName || '未命名作品',
        category: item.category || '未分类',
        downloadUrl: item.perspectiveImage
      }));
      console.log(`共 ${imageList.length} 张图片，URL 直接可用`);
    } else {
      // 是云存储 fileID，需要获取临时链接
      const fileIDs = worksWithImage.map(item => item.perspectiveImage);
      const BATCH_SIZE = 50;
      const tempUrls = {};
      
      for (let i = 0; i < fileIDs.length; i += BATCH_SIZE) {
        const batch = fileIDs.slice(i, i + BATCH_SIZE);
        const result = await cloud.getTempFileURL({
          fileList: batch
        });
        
        result.fileList.forEach(file => {
          if (file.tempFileURL) {
            tempUrls[file.fileID] = file.tempFileURL;
          }
        });
        
        console.log(`已获取 ${Object.keys(tempUrls).length}/${fileIDs.length} 个下载链接`);
      }
      
      imageList = worksWithImage.map(item => ({
        artworkName: item.artworkName || '未命名作品',
        category: item.category || '未分类',
        downloadUrl: tempUrls[item.perspectiveImage] || null
      })).filter(item => item.downloadUrl);
    }
    
    // 按分类统计
    const categoryStats = {};
    imageList.forEach(item => {
      if (!categoryStats[item.category]) {
        categoryStats[item.category] = 0;
      }
      categoryStats[item.category]++;
    });
    
    console.log('');
    console.log('=== 分类统计 ===');
    Object.keys(categoryStats).forEach(cat => {
      console.log(`${cat}: ${categoryStats[cat]} 件`);
    });
    
    // 第3步：写入云存储 JSON 文件
    console.log('');
    console.log('=== 写入文件 ===');
    
    const jsonContent = JSON.stringify({
      exportTime: new Date().toISOString(),
      total: imageList.length,
      categoryStats,
      imageList
    }, null, 2);
    
    const uploadResult = await cloud.uploadFile({
      cloudPath: `exports/${outputFile}`,
      fileContent: Buffer.from(jsonContent, 'utf-8')
    });
    
    console.log('文件已上传:', uploadResult.fileID);
    
    // 获取下载链接
    const urlResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    });
    
    const downloadUrl = urlResult.fileList[0].tempFileURL;
    console.log('下载链接:', downloadUrl);
    
    console.log('');
    console.log('=== 导出完成 ===');
    console.log('共', imageList.length, '张图片');
    console.log('JSON 文件已保存到云存储');
    
    return {
      success: true,
      message: `成功导出 ${imageList.length} 张图片信息到 ${outputFile}`,
      data: {
        total: imageList.length,
        categoryStats,
        fileID: uploadResult.fileID,
        downloadUrl: downloadUrl
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
