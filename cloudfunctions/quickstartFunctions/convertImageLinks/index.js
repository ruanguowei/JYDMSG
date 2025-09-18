// 云函数入口文件 - 批量转换图片链接
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始批量转换图片链接...');
    
    // 获取所有需要转换的记录
    const result = await db.collection('pottery_submissions')
      .where({
        // 查找包含cloud://链接的记录
        perspectiveImage: db.command.regex('cloud://', 'i')
      })
      .get();
    
    console.log(`找到 ${result.data.length} 条需要转换的记录`);
    
    const convertPromises = result.data.map(async (record) => {
      try {
        // 转换单个记录的图片链接
        const convertedData = await convertRecordImages(record);
        
        // 更新记录
        await db.collection('pottery_submissions')
          .doc(record._id)
          .update({
            data: convertedData
          });
        
        console.log(`已转换记录: ${record._id}`);
        return { success: true, id: record._id };
      } catch (error) {
        console.error(`转换记录失败 ${record._id}:`, error);
        return { success: false, id: record._id, error: error.message };
      }
    });
    
    const results = await Promise.all(convertPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`转换完成: 成功 ${successCount} 条，失败 ${failCount} 条`);
    
    return {
      success: true,
      message: `转换完成: 成功 ${successCount} 条，失败 ${failCount} 条`,
      data: {
        total: result.data.length,
        success: successCount,
        failed: failCount,
        results: results
      }
    };
    
  } catch (error) {
    console.error('批量转换失败:', error);
    return {
      success: false,
      message: '批量转换失败: ' + error.message
    };
  }
}

// 转换单个记录的图片链接
async function convertRecordImages(record) {
  const convertImageLinks = async (imageData) => {
    if (!imageData) return '';
    
    // 如果是cloud://格式，转换为HTTPS
    if (typeof imageData === 'string' && imageData.startsWith('cloud://')) {
      try {
        const result = await cloud.getTempFileURL({
          fileList: [imageData]
        });
        return result.fileList[0]?.tempFileURL || imageData;
      } catch (error) {
        console.error('转换图片链接失败:', error);
        return imageData;
      }
    }
    
    return imageData;
  };
  
  const convertImageArray = async (imageArray) => {
    if (!Array.isArray(imageArray) || imageArray.length === 0) return [];
    
    const cloudImages = imageArray.filter(img => img && img.startsWith('cloud://'));
    if (cloudImages.length === 0) return imageArray;
    
    try {
      const result = await cloud.getTempFileURL({
        fileList: cloudImages
      });
      
      // 创建映射表
      const urlMap = {};
      result.fileList.forEach(item => {
        urlMap[item.fileID] = item.tempFileURL;
      });
      
      // 替换cloud://链接为HTTPS链接
      return imageArray.map(img => {
        if (img && img.startsWith('cloud://')) {
          return urlMap[img] || img;
        }
        return img;
      });
    } catch (error) {
      console.error('转换图片数组失败:', error);
      return imageArray;
    }
  };
  
  // 转换所有图片字段
  const convertedPhotoUrl = await convertImageLinks(record.photoUrl);
  const convertedPerspectiveImage = await convertImageLinks(record.perspectiveImage);
  const convertedFourViewImages = await convertImageArray(record.fourViewImages || []);
  const convertedDetailImages = await convertImageArray(record.detailImages || []);
  
  return {
    photoUrl: convertedPhotoUrl,
    perspectiveImage: convertedPerspectiveImage,
    fourViewImages: convertedFourViewImages,
    detailImages: convertedDetailImages,
    updatedAt: Date.now()
  };
}
