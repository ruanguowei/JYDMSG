// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const currentTime = db.serverDate();
  
  try {
    // 提取请求数据
    const {
      // 基本信息确认
      name,                // 姓名
      artworkName,         // 作品名称
      school,              // 学校
      
      // 运送信息
      deliveryMethod,      // 运送方式
      expressCompany,      // 快递公司
      trackingNumber,      // 快递单号
      sendDate,            // 寄出日期
      estimatedArrival,    // 预计到达日期
      packageCount,        // 包裹数量
      remarks,             // 备注说明
      packageImages,       // 包裹外观照片云存储ID数组
      artworkImages        // 作品包装照片云存储ID数组
    } = event;

    // 数据验证
    // 验证基本信息字段
    if (!name || !name.trim()) {
      return {
        success: false,
        errMsg: '请输入姓名'
      };
    }

    if (!artworkName || !artworkName.trim()) {
      return {
        success: false,
        errMsg: '请输入作品名称'
      };
    }

    if (!school || !school.trim()) {
      return {
        success: false,
        errMsg: '请输入学校名称'
      };
    }

    // 验证运送信息字段
    if (!deliveryMethod) {
      return {
        success: false,
        errMsg: '请选择运送方式'
      };
    }

    if (deliveryMethod === '快递') {
      if (!expressCompany) {
        return {
          success: false,
          errMsg: '请选择快递物流公司'
        };
      }
    }
    
    if (!trackingNumber) {
      return {
        success: false,
        errMsg: '请输入快递单号，自送请输入"自送"'
      };
    }

    if (!sendDate) {
      return {
        success: false,
        errMsg: '请选择寄出日期'
      };
    }

    if (!packageCount || packageCount <= 0) {
      return {
        success: false,
        errMsg: '请输入有效的包裹数量'
      };
    }

    if (!packageImages || packageImages.length === 0) {
      return {
        success: false,
        errMsg: '请上传包裹外观照片'
      };
    }

    if (!artworkImages || artworkImages.length === 0) {
      return {
        success: false,
        errMsg: '请上传作品包装照片'
      };
    }

    // 构建要保存的数据
    const deliveryData = {
      _openid: OPENID,
      // 基本信息确认
      name: name.trim(),
      artworkName: artworkName.trim(),
      school: school.trim(),
      
      // 运送信息
      deliveryMethod,
      expressCompany: expressCompany || '',
      trackingNumber: trackingNumber || '',
      sendDate,
      estimatedArrival: estimatedArrival || '',
      packageCount: parseInt(packageCount),
      remarks: remarks || '',
      // 使用正确的字段名，并确保存储为数组
      packageImages: Array.isArray(packageImages) ? packageImages : [],
      artworkImages: Array.isArray(artworkImages) ? artworkImages : [],
      status: 'pending',        // 状态: pending=待处理, received=已接收, rejected=已拒绝
      createTime: currentTime,  // 创建时间
      updateTime: currentTime   // 更新时间
    };

    // 将数据保存到数据库
    const result = await db.collection('artwork_deliveries').add({
      data: deliveryData
    });

    return {
      success: true,
      data: {
        deliveryId: result._id
      },
      message: '作品运送信息提交成功'
    };
  } catch (error) {
    console.error('提交作品运送信息失败', error);
    return {
      success: false,
      errMsg: '提交失败，请稍后重试',
      error: error
    };
  }
}; 