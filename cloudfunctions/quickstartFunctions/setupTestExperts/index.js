// cloudfunctions/quickstartFunctions/setupTestExperts/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 快速设置测试专家
 * 创建初评评委和终评评委用于测试
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 开始设置测试专家 ===');
    
    // 定义测试专家（使用 expertType 字段）
    const testExperts = [
      // 初评评委（3个测试用）
      {
        expertCode: 'INITIAL001',
        expertName: '初评专家1',
        expertTitle: '教授',
        expertPosition: '某大学副院长',
        expertType: 'preliminary',  // 初评评委
        status: 'active',
        _isTestData: true
      },
      {
        expertCode: 'INITIAL002',
        expertName: '初评专家2',
        expertTitle: '副教授',
        expertPosition: '某大学讲师',
        expertType: 'preliminary',
        status: 'active',
        _isTestData: true
      },
      {
        expertCode: 'INITIAL003',
        expertName: '初评专家3',
        expertTitle: '教授',
        expertPosition: '某学院院长',
        expertType: 'preliminary',
        status: 'active',
        _isTestData: true
      },
      
      // 终评评委（3个测试用）
      {
        expertCode: 'FINAL001',
        expertName: '终评专家1',
        expertTitle: '教授、博士生导师',
        expertPosition: '清华大学美术学院副教授',
        expertType: 'final',  // 终评评委
        status: 'active',
        _isTestData: true
      },
      {
        expertCode: 'FINAL002',
        expertName: '终评专家2',
        expertTitle: '研究员',
        expertPosition: '中国艺术研究院',
        expertType: 'final',
        status: 'active',
        _isTestData: true
      },
      {
        expertCode: 'FINAL003',
        expertName: '终评专家3',
        expertTitle: '教授',
        expertPosition: '中央美术学院',
        expertType: 'final',
        status: 'active',
        _isTestData: true
      },
      
      // 测试用：如果需要某个专家两者都参与，可以不设置expertType或留空
      {
        expertCode: 'BOTH001',
        expertName: '全程专家1',
        expertTitle: '资深教授',
        expertPosition: '国际陶艺学会代表',
        expertType: '',  // 空值表示两者都可以参与
        status: 'active',
        _isTestData: true
      }
    ];
    
    // 插入专家数据
    const promises = testExperts.map(expert => 
      db.collection('experts').add({ data: expert })
    );
    
    await Promise.all(promises);
    
    console.log('=== 测试专家设置完成 ===');
    
    return {
      success: true,
      message: `已成功创建 ${testExperts.length} 位测试专家`,
      data: {
        experts: testExperts.map(e => ({
          code: e.expertCode,
          name: e.expertName,
          type: e.expertType
        }))
      }
    };
    
  } catch (error) {
    console.error('设置测试专家失败:', error);
    return {
      success: false,
      message: '设置测试专家失败',
      error: error.message
    };
  }
}

