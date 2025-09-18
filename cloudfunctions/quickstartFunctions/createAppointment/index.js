// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { data } = event;

  try {
    // 确保数据合法性
    if (!data || !data.date || !data.time || !data.reason || !data.reservationName || !data.reservationPhone) {
      return {
        success: false,
        message: '预约信息不完整，请填写所有必填项'
      };
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(data.reservationPhone)) {
      return {
        success: false,
        message: '请输入正确的手机号码'
      };
    }
    
    // 验证姓名长度
    if (data.reservationName.length < 2 || data.reservationName.length > 20) {
      return {
        success: false,
        message: '姓名长度应在2-20个字符之间'
      };
    }

    // 获取用户的openid
    const openid = wxContext.OPENID;
    
    // 构建预约数据
    const appointmentData = {
      ...data,
      _openid: openid,
      status: 'approved', // 预约状态：approved(预约成功), pending(待审核), rejected(已拒绝)
      createTime: db.serverDate()
    };
    
    // 写入预约数据到appointments集合
    const result = await db.collection('appointments').add({
      data: appointmentData
    });
    
    if (result._id) {
      return {
        success: true,
        message: '预约创建成功',
        appointmentId: result._id
      };
    } else {
      return {
        success: false,
        message: '预约创建失败'
      };
    }
  } catch (err) {
    console.error('创建预约失败', err);
    return {
      success: false,
      message: '系统错误',
      error: err
    };
  }
}; 