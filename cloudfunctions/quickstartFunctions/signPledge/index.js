// cloudfunctions/quickstartFunctions/signPledge/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 签署评选承诺书
 */
exports.main = async (event, context) => {
  try {
    const { expertCode, expertName, signTime, dateRange } = event;
    
    console.log('=== 签署承诺书 ===');
    console.log('专家代码:', expertCode);
    console.log('专家姓名:', expertName);
    console.log('评选日期:', dateRange);
    
    if (!expertCode) {
      return {
        success: false,
        message: '缺少专家代码'
      };
    }
    
    // 更新专家表，记录签署状态
    const updateResult = await db.collection('experts')
      .where({ expertCode: expertCode })
      .update({
        data: {
          pledgeSigned: true,
          pledgeSignTime: signTime || new Date(),
          pledgeDateRange: dateRange
        }
      });
    
    console.log('更新结果:', updateResult);
    
    if (updateResult.stats.updated === 0) {
      return {
        success: false,
        message: '专家信息不存在'
      };
    }
    
    console.log('✅ 承诺书签署成功');
    
    return {
      success: true,
      message: '承诺书签署成功'
    };
    
  } catch (error) {
    console.error('签署承诺书失败:', error);
    return {
      success: false,
      message: '签署失败: ' + error.message
    };
  }
}






