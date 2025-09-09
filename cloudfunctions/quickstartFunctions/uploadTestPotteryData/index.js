// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  try {
    // 测试数据
    const testData = {
      // 个人信息 - 基础信息
      name: '张三',
      gender: '男',
      school: '清华大学',
      grade: '研一',
      birthDate: '1998-06',
      major: '陶瓷艺术设计',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      idNumber: '110101199806012345',
      
      // 个人信息 - 指导老师信息
      teacher: '李四',
      teacherPhone: '13900139000',
      
      // 个人信息 - 地址与照片
      address: '北京市海淀区清华大学美术学院',
      photoUrl: 'cloud://prod-0g0i1kuf32a5d7bc.7072-prod-0g0i1kuf32a5d7bc-1311738031/personal_photos/test_personal.jpg',
      
      // 作品信息 - 基本信息
      artworkName: '中国梦·陶韵',
      createYear: '2023',
      
      // 作品信息 - 尺寸详情
      dimensions: {
        length: '30',
        width: '20',
        height: '15'
      },
      
      // 作品信息 - 类别与材料
      category: '技艺',
      craftMaterial: '瓷土，釉上彩，1300°C高温烧制，传统手工拉坯成型，结合青花工艺与釉下彩绘技术',
      
      // 作品信息 - 作品简介
      artworkDescription: '这是一件融合传统与现代元素的陶艺作品，表达了对中国传统文化的传承与创新。作品采用了传统青花工艺，结合现代设计语言，展现出独特的艺术魅力。灵感来源于中国传统山水画，通过陶瓷材料重新诠释东方美学。',
      
      // 作品信息 - 照片列表
      artworkImages: [
        'cloud://prod-0g0i1kuf32a5d7bc.7072-prod-0g0i1kuf32a5d7bc-1311738031/artwork_photos/test_artwork1.jpg',
        'cloud://prod-0g0i1kuf32a5d7bc.7072-prod-0g0i1kuf32a5d7bc-1311738031/artwork_photos/test_artwork2.jpg',
        'cloud://prod-0g0i1kuf32a5d7bc.7072-prod-0g0i1kuf32a5d7bc-1311738031/artwork_photos/test_artwork3.jpg'
      ],
      
      // 状态信息
      openid: wxContext.OPENID || 'test_openid_' + Date.now(),
      status: 'pending', // 审核状态：pending（待审核）, approved（已通过）, rejected（已拒绝）
      submissionTime: new Date(),
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    
    // 详细日志，方便调试
    console.log('准备提交的测试数据:', JSON.stringify(testData, null, 2));
    
    // 保存到数据库
    const result = await db.collection('pottery_submissions').add({
      data: testData
    })
    
    console.log('数据库插入结果:', result);
    
    return {
      success: true,
      data: {
        submissionId: result._id,
        message: '测试数据已成功添加到pottery_submissions集合',
        testData: testData // 返回测试数据以便于查看
      }
    }
  } catch (error) {
    console.error('添加测试数据失败', error)
    return {
      success: false,
      errMsg: '添加测试数据失败：' + error.message,
      error: error
    }
  }
} 