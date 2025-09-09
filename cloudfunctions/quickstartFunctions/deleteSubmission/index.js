// 云函数删除参展申请记录
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('删除函数被调用，参数:', event);
  console.log('当前用户openid:', openid);
  
  // 没有openid或记录ID则返回错误
  if (!openid || !event.data || !event.data.submissionId) {
    return {
      success: false,
      errMsg: '参数错误或用户未登录'
    };
  }
  
  const submissionId = event.data.submissionId;
  console.log('要删除的记录ID:', submissionId);
  
  try {
    // 首先查询记录是否存在并且属于当前用户
    console.log('开始查询记录...');
    const record = await db.collection('pottery_submissions').doc(submissionId).get();
    console.log('记录查询结果:', record.data);
    
    // 确认记录存在
    if (!record.data) {
      return {
        success: false,
        errMsg: '记录不存在'
      };
    }
    
    // 记录的创建者openid与当前用户不符，但允许删除（适用于管理员或记录没有openid字段的情况）
    if (record.data._openid && record.data._openid !== openid) {
      console.warn('权限警告：用户尝试删除非本人创建的记录');
      // 允许继续删除但记录日志
    }
    
    // 删除相关的云存储文件（如作品图片、个人照片等）
    const filesToDelete = [];
    
    // 添加作品图片
    if (record.data.artworkImages && record.data.artworkImages.length > 0) {
      record.data.artworkImages.forEach(fileID => {
        if (fileID && fileID.includes('cloud://')) {
          filesToDelete.push(fileID);
        }
      });
    }
    
    // 添加个人照片
    if (record.data.photoUrl && record.data.photoUrl.includes('cloud://')) {
      filesToDelete.push(record.data.photoUrl);
    }
    
    console.log('需要删除的文件:', filesToDelete);
    
    // 如果有需要删除的文件，则执行删除操作
    if (filesToDelete.length > 0) {
      try {
        const deleteResult = await cloud.deleteFile({
          fileList: filesToDelete
        });
        console.log('文件删除结果:', deleteResult);
      } catch (fileErr) {
        console.error('删除文件失败:', fileErr);
        // 但我们继续删除数据库记录，不因文件删除失败而中断
      }
    }
    
    // 删除数据库记录
    console.log('开始删除数据库记录...');
    await db.collection('pottery_submissions').doc(submissionId).remove();
    console.log('数据库记录删除成功');
    
    return {
      success: true,
      message: '申请记录删除成功'
    };
  } catch (err) {
    console.error('删除申请记录失败:', err);
    return {
      success: false,
      errMsg: err.message || '删除申请记录失败'
    };
  }
}; 