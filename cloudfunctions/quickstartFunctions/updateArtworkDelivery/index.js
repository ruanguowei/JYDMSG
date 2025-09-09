// 更新作品运送记录
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取基本信息
  const { id, deliveryMethod, expressCompany, trackingNumber, sendDate, estimatedArrival, packageCount, remarks, packageImages, artworkImages } = event;
  const openid = cloud.getWXContext().OPENID;
  
  if (!id || !deliveryMethod) {
    return {
      success: false,
      errMsg: '参数不完整'
    };
  }
  
  try {
    // 首先查询记录，确认存在且属于当前用户
    const recordResult = await db.collection('artwork_deliveries')
      .doc(id)
      .get();
      
    if (!recordResult.data || recordResult.data._openid !== openid) {
      return {
        success: false,
        errMsg: '没有权限更新此记录'
      };
    }
    
    // 构建更新数据
    const updateData = {
      deliveryMethod,
      expressCompany: expressCompany || '',
      trackingNumber: trackingNumber || '',
      sendDate: sendDate || '',
      estimatedArrival: estimatedArrival || '',
      packageCount: packageCount || '1',
      remarks: remarks || '',
      updateTime: db.serverDate()
    };
    
    // 处理图片信息
    if (packageImages && Array.isArray(packageImages)) {
      updateData.packageImages = packageImages;
    }
    
    if (artworkImages && Array.isArray(artworkImages)) {
      updateData.artworkImages = artworkImages;
    }
    
    // 更新记录
    await db.collection('artwork_deliveries')
      .doc(id)
      .update({
        data: updateData
      });
    
    // 需要删除的旧图片
    const oldPackageImages = recordResult.data.packageImages || [];
    const oldArtworkImages = recordResult.data.artworkImages || [];
    
    // 找出不再使用的图片
    const newPackageImages = packageImages || [];
    const newArtworkImages = artworkImages || [];
    
    const unusedPackageImages = oldPackageImages.filter(fileID => !newPackageImages.includes(fileID));
    const unusedArtworkImages = oldArtworkImages.filter(fileID => !newArtworkImages.includes(fileID));
    
    const unusedImages = [...unusedPackageImages, ...unusedArtworkImages];
    
    // 删除不再使用的图片
    if (unusedImages.length > 0) {
      await cloud.deleteFile({
        fileList: unusedImages
      });
    }
    
    return {
      success: true,
      message: '更新成功'
    };
  } catch (err) {
    console.error('更新运送记录失败', err);
    return {
      success: false,
      errMsg: '更新失败',
      err
    };
  }
}; 