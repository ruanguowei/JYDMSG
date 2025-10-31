// cloudfunctions/quickstartFunctions/checkExpertProgress/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 检查专家评分进度
 * 返回该专家已评分和未评分的作品数量
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
    
    console.log('=== 检查专家评分进度 ===');
    console.log('专家Code:', expertCode);
    
    // 获取专家信息
    const expertResult = await db.collection('experts')
      .where({ expertCode: expertCode })
      .get();
    
    if (expertResult.data.length === 0) {
      return {
        success: false,
        message: '专家信息不存在'
      };
    }
    
    const expertInfo = expertResult.data[0];
    const expertType = expertInfo.expertType || '';
    
    // 根据专家类型查询不同的表
    let tableName = '';
    let targetField = '';
    
    if (expertType === 'final') {
      tableName = 'pottery_submissions_preliminary';
      targetField = 'finalEvaluation';
    } else {
      tableName = 'pottery_submissions_clean';
      targetField = 'evaluations';
    }
    
    console.log('查询表:', tableName);
    console.log('评分字段:', targetField);
    
    // 查询所有作品
    const allWorksResult = await db.collection(tableName)
      .where({
        qualification: db.command.neq(false)
      })
      .get();
    
    const allWorks = allWorksResult.data;
    
    // 统计已评分和未评分
    let evaluated = 0;
    let unevaluated = 0;
    
    allWorks.forEach(item => {
      const evals = item[targetField] || [];
      const hasEvaluated = evals.some(eval => eval.expertCode === expertCode);
      
      if (hasEvaluated) {
        evaluated++;
      } else {
        unevaluated++;
      }
    });
    
    const total = allWorks.length;
    const progress = total > 0 ? (evaluated / total * 100).toFixed(1) : 0;
    const isComplete = unevaluated === 0;
    
    console.log('总作品数:', total);
    console.log('已评分:', evaluated);
    console.log('未评分:', unevaluated);
    console.log('完成率:', progress + '%');
    console.log('是否全部完成:', isComplete);
    
    return {
      success: true,
      data: {
        expertCode: expertCode,
        expertName: expertInfo.expertName,
        expertType: expertType,
        total: total,
        evaluated: evaluated,
        unevaluated: unevaluated,
        progress: progress,
        isComplete: isComplete
      }
    };
    
  } catch (error) {
    console.error('检查评分进度失败:', error);
    return {
      success: false,
      message: '检查进度失败: ' + error.message
    };
  }
}







