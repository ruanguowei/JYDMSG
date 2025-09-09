// 删除作品运送记录
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const { id } = event;
  const openid = cloud.getWXContext().OPENID;
  
  if (!id) {
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
        errMsg: '没有权限删除此记录'
      };
    }
    
    // 删除记录
    await db.collection('artwork_deliveries')
      .doc(id)
      .remove();
      
    // 记录中可能存在的云存储图片也需要删除
    const packageImageFileIDs = recordResult.data.packageImageFileIDs || [];
    const artworkImageFileIDs = recordResult.data.artworkImageFileIDs || [];
    const allFileIDs = [...packageImageFileIDs, ...artworkImageFileIDs];
    
    if (allFileIDs.length > 0) {
      await cloud.deleteFile({
        fileList: allFileIDs
      });
    }
    
    return {
      success: true,
      message: '删除成功'
    };
  } catch (err) {
    console.error('删除运送记录失败', err);
    return {
      success: false,
      errMsg: '删除失败',
      err
    };
  }
}; 