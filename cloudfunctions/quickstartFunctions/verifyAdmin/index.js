// cloudfunctions/quickstartFunctions/verifyAdmin/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { account, password } = event
    
    // 验证参数
    if (!account || !password) {
      return {
        success: false,
        message: '请输入账号和密码'
      }
    }
    
    console.log('=== 管理员验证 ===');
    console.log('账号:', account);
    console.log('密码:', password);
    
    // 查询admin数据库
    const adminResult = await db.collection('admin')
      .where({
        account: account,
        password: password
      })
      .get()
    
    console.log('查询结果:', adminResult.data);
    
    if (adminResult.data.length > 0) {
      console.log('✅ 管理员验证成功');
      return {
        success: true,
        message: '管理员验证成功',
        adminInfo: {
          account: adminResult.data[0].account,
          id: adminResult.data[0]._id
        }
      }
    } else {
      console.log('❌ 管理员验证失败');
      return {
        success: false,
        message: '账号或密码错误'
      }
    }
    
  } catch (error) {
    console.error('管理员验证异常:', error)
    return {
      success: false,
      message: '验证失败，请重试'
    }
  }
}

