// 云函数获取所有参展申请记录
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  // 如果没有openid，则返回错误
  if (!openid) {
    return {
      success: false,
      errMsg: '用户未登录'
    };
  }
  
  try {
    console.log('当前用户openid:', openid);
    
    // 获取用户所有的参展申请记录
    // 按更新时间降序排列，最新的在最前面
    const submissionsResult = await db.collection('pottery_submissions')
      .where({
        _openid: openid // 修改为标准的_openid字段
      })
      .orderBy('updatedAt', 'desc')
      .get();
    
    console.log('原始查询结果:', submissionsResult);
    
    // 格式化数据
    const submissions = submissionsResult.data.map(item => {
      // 格式化提交时间为可读格式
      let submitTimeFormatted = '';
      if (item.submitTime) {
        const date = new Date(item.submitTime);
        submitTimeFormatted = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else if (item.updatedAt) {
        // 如果没有submitTime字段，尝试使用updatedAt
        const date = new Date(item.updatedAt);
        submitTimeFormatted = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      return {
        ...item,
        submitTime: submitTimeFormatted
      };
    });
    
    console.log('获取到的记录数量:', submissions.length);
    
    return {
      success: true,
      data: submissions
    };
  } catch (err) {
    console.error('获取参展申请记录失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取参展申请记录失败'
    };
  }
}; 