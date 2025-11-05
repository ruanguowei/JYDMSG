// cloudfunctions/queryWorkStatus/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 查询作品入围状态
 * 通过手机号+姓名查询作品是否入围
 */
exports.main = async (event, context) => {
  const {
    phone,  // 手机号
    name    // 学生姓名
  } = event;
  
  try {
    console.log('=== 查询作品入围状态 ===');
    console.log('手机号:', phone);
    console.log('姓名:', name);
    
    // 参数验证
    if (!phone || !name) {
      return {
        success: false,
        message: '请输入手机号和姓名'
      };
    }
    
    // 去除手机号和姓名的空格
    const phoneClean = phone.trim();
    const nameClean = name.trim();
    
    // 在终评结果表中查询（最终入围的作品）
    const result = await db.collection('pottery_submissions_final')
      .where({
        phone: phoneClean,
        name: nameClean
      })
      .get();
    
    console.log('查询结果数量:', result.data.length);
    
    if (result.data.length > 0) {
      // 找到作品，已入围
      const work = result.data[0];
      
      console.log('✅ 作品已入围');
      console.log('作品名称:', work.artworkName || work.title);
      console.log('学校:', work.school);
      
      return {
        success: true,
        qualified: true,
        message: '恭喜！您的作品已入围',
        data: {
          artworkName: work.artworkName || work.title,
          category: work.category || '',
          school: work.school || '',
          teacher: work.teacher || ''
        }
      };
      
    } else {
      // 未找到，未入围
      console.log('❌ 作品未入围');
      
      return {
        success: true,
        qualified: false,
        message: '很遗憾，您的作品未入围'
      };
    }
    
  } catch (error) {
    console.error('查询失败:', error);
    return {
      success: false,
      message: '查询失败，请重试',
      error: error.message
    };
  }
}



