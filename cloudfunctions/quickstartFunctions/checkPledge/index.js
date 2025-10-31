// cloudfunctions/quickstartFunctions/checkPledge/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 检查专家是否已签署承诺书
 */
exports.main = async (event, context) => {
  try {
    const { expertCode } = event;
    
    if (!expertCode) {
      return {
        success: false,
        message: '缺少专家代码'
      };
    }
    
    console.log('检查承诺书签署状态，专家代码:', expertCode);
    
    // 查询专家信息
    const result = await db.collection('experts')
      .where({ expertCode: expertCode })
      .get();
    
    if (result.data.length === 0) {
      return {
        success: false,
        message: '专家信息不存在'
      };
    }
    
    const expert = result.data[0];
    const hasSigned = expert.pledgeSigned || false;
    
    console.log('承诺书签署状态:', hasSigned);
    
    return {
      success: true,
      data: {
        hasSigned: hasSigned,
        signTime: expert.pledgeSignTime || null,
        dateRange: expert.pledgeDateRange || ''
      }
    };
    
  } catch (error) {
    console.error('检查承诺书失败:', error);
    return {
      success: false,
      message: '检查失败: ' + error.message
    };
  }
}






