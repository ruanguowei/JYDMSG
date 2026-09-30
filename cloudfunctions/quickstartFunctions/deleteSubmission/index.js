// 云函数删除参展申请记录
const cloud = require('wx-server-sdk');
const { collectionName, publicEdition, resolveEdition } = require('../common/edition');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('删除函数被调用:', JSON.stringify({
    editionId: event.editionId || (event.data && event.data.editionId),
    hasSubmissionId: Boolean(event.data && event.data.submissionId)
  }));
  
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
    const edition = await resolveEdition(db, {
      editionId: event.editionId || (event.data && event.data.editionId),
      useCurrent: !(event.editionId || (event.data && event.data.editionId)),
      mode: 'write'
    });
    const submissionsCollection = collectionName(edition, 'submissions');

    // 首先查询记录是否存在并且属于当前用户
    console.log('开始查询记录...');
    const record = await db.collection(submissionsCollection).doc(submissionId).get();
    console.log('记录查询完成:', Boolean(record.data));
    
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
    
    console.log('需要删除的文件数量:', filesToDelete.length);
    
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
    await db.collection(submissionsCollection).doc(submissionId).remove();
    console.log('数据库记录删除成功');
    
    return {
      success: true,
      edition: publicEdition(edition),
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
