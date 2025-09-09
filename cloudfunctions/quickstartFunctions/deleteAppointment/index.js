// 删除预约记录
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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
    const recordResult = await db.collection('appointments')
      .doc(id)
      .get();
      
    if (!recordResult.data || recordResult.data._openid !== openid) {
      return {
        success: false,
        errMsg: '没有权限删除此记录'
      };
    }
    
    // 删除记录
    await db.collection('appointments')
      .doc(id)
      .remove();
      
    return {
      success: true,
      message: '删除成功'
    };
  } catch (err) {
    console.error('删除预约记录失败', err);
    return {
      success: false,
      errMsg: '删除失败',
      err
    };
  }
}; 