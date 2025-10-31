// cloudfunctions/quickstartFunctions/diagnoseExpertLogin/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 诊断专家登录问题
 * 功能：
 * 1. 列出所有专家账号及其状态
 * 2. 检查数据完整性
 * 3. 修复常见问题（去除空格等）
 */
exports.main = async (event, context) => {
  const { 
    action = 'check',  // 'check' 检查 | 'fix' 修复 | 'test' 测试登录
    expertCode,        // 测试登录用
    expertName         // 测试登录用
  } = event;
  
  try {
    console.log('=== 专家登录诊断 ===');
    console.log('操作类型:', action);
    console.log('当前云环境:', cloud.DYNAMIC_CURRENT_ENV);
    
    if (action === 'check') {
      // 检查所有专家账号
      const experts = await db.collection('experts')
        .get();
      
      console.log('专家总数:', experts.data.length);
      
      const report = [];
      let canLoginCount = 0;
      let issueCount = 0;
      
      experts.data.forEach(expert => {
        const issues = [];
        
        // 检查必需字段
        if (!expert.expertName || expert.expertName.trim() === '') {
          issues.push('expertName为空');
        }
        
        if (!expert.expertCode || expert.expertCode.trim() === '') {
          issues.push('expertCode为空');
        }
        
        if (!expert.status || expert.status !== 'active') {
          issues.push('status不是active');
        }
        
        // 检查空格问题
        if (expert.expertName && expert.expertName !== expert.expertName.trim()) {
          issues.push('expertName有多余空格');
        }
        
        if (expert.expertCode && expert.expertCode !== expert.expertCode.trim()) {
          issues.push('expertCode有多余空格');
        }
        
        // 检查不可见字符
        if (expert.expertName) {
          const cleaned = expert.expertName.replace(/[\s\u3000\u00a0]/g, '');
          if (cleaned !== expert.expertName.trim()) {
            issues.push('expertName包含特殊空格字符');
          }
        }
        
        const canLogin = issues.length === 0;
        if (canLogin) {
          canLoginCount++;
        } else {
          issueCount++;
        }
        
        report.push({
          _id: expert._id,
          expertName: expert.expertName,
          expertCode: expert.expertCode,
          expertType: expert.expertType || '未设置',
          status: expert.status,
          canLogin: canLogin,
          issues: issues,
          // 显示字段的实际长度和内容
          nameLength: expert.expertName ? expert.expertName.length : 0,
          codeLength: expert.expertCode ? expert.expertCode.length : 0
        });
      });
      
      // 按问题排序
      report.sort((a, b) => {
        if (a.canLogin === b.canLogin) return 0;
        return a.canLogin ? 1 : -1;  // 有问题的排前面
      });
      
      console.log('');
      console.log('=== 诊断报告 ===');
      console.log('总计:', experts.data.length, '个专家账号');
      console.log('✅ 可登录:', canLoginCount);
      console.log('❌ 有问题:', issueCount);
      console.log('');
      
      report.forEach(item => {
        if (!item.canLogin) {
          console.log('❌', item.expertName, '-', item.expertCode);
          console.log('   问题:', item.issues.join(', '));
        } else {
          console.log('✅', item.expertName, '-', item.expertCode);
        }
      });
      
      return {
        success: true,
        message: `诊断完成：${canLoginCount}个可登录，${issueCount}个有问题`,
        data: {
          total: experts.data.length,
          canLogin: canLoginCount,
          hasIssues: issueCount,
          experts: report
        }
      };
      
    } else if (action === 'fix') {
      // 修复所有专家账号的常见问题
      const experts = await db.collection('experts').get();
      
      let fixedCount = 0;
      const fixLog = [];
      
      for (const expert of experts.data) {
        let needUpdate = false;
        const updateData = {};
        const fixes = [];
        
        // 修复 expertName 的空格和特殊字符
        if (expert.expertName) {
          const cleaned = expert.expertName.replace(/[\s\u3000\u00a0]+/g, '').trim();
          if (cleaned !== expert.expertName) {
            updateData.expertName = cleaned;
            fixes.push(`姓名: "${expert.expertName}" → "${cleaned}"`);
            needUpdate = true;
          }
        }
        
        // 修复 expertCode 的空格
        if (expert.expertCode) {
          const cleaned = expert.expertCode.trim();
          if (cleaned !== expert.expertCode) {
            updateData.expertCode = cleaned;
            fixes.push(`验证码: "${expert.expertCode}" → "${cleaned}"`);
            needUpdate = true;
          }
        }
        
        // 确保 status 字段存在且为 active
        if (!expert.status || expert.status.trim() === '') {
          updateData.status = 'active';
          fixes.push('设置status为active');
          needUpdate = true;
        } else if (expert.status.trim() !== 'active') {
          // 如果status不是active，询问是否修复（这里自动修复）
          updateData.status = 'active';
          fixes.push(`status: "${expert.status}" → "active"`);
          needUpdate = true;
        }
        
        if (needUpdate) {
          await db.collection('experts')
            .doc(expert._id)
            .update({
              data: updateData
            });
          
          fixedCount++;
          fixLog.push({
            expertName: updateData.expertName || expert.expertName,
            expertCode: updateData.expertCode || expert.expertCode,
            fixes: fixes
          });
          
          console.log('修复:', expert.expertName, '-', fixes.join(', '));
        }
      }
      
      console.log('');
      console.log('=== 修复完成 ===');
      console.log('已修复:', fixedCount, '个专家账号');
      
      return {
        success: true,
        message: `已修复 ${fixedCount} 个专家账号`,
        data: {
          fixedCount: fixedCount,
          fixes: fixLog
        }
      };
      
    } else if (action === 'test') {
      // 测试登录
      if (!expertCode || !expertName) {
        return {
          success: false,
          message: '请提供 expertCode 和 expertName'
        };
      }
      
      console.log('测试登录:', expertName, '-', expertCode);
      
      // 查询1：严格匹配
      const strictResult = await db.collection('experts').where({
        expertCode: expertCode,
        expertName: expertName,
        status: 'active'
      }).get();
      
      // 查询2：只匹配code
      const codeOnlyResult = await db.collection('experts').where({
        expertCode: expertCode
      }).get();
      
      // 查询3：只匹配name
      const nameOnlyResult = await db.collection('experts').where({
        expertName: expertName
      }).get();
      
      console.log('严格匹配结果:', strictResult.data.length);
      console.log('只匹配验证码:', codeOnlyResult.data.length);
      console.log('只匹配姓名:', nameOnlyResult.data.length);
      
      return {
        success: true,
        message: '测试完成',
        data: {
          canLogin: strictResult.data.length > 0,
          strictMatch: strictResult.data.length,
          codeMatch: codeOnlyResult.data.length,
          nameMatch: nameOnlyResult.data.length,
          strictResult: strictResult.data[0] || null,
          codeOnlyResult: codeOnlyResult.data[0] || null,
          nameOnlyResult: nameOnlyResult.data[0] || null,
          suggestion: strictResult.data.length > 0 
            ? '✅ 可以登录' 
            : codeOnlyResult.data.length > 0 
              ? '⚠️ 验证码正确但姓名不匹配，请检查姓名是否完全一致' 
              : nameOnlyResult.data.length > 0
                ? '⚠️ 姓名正确但验证码不匹配，请检查验证码'
                : '❌ 未找到该专家账号'
        }
      };
    }
    
    return {
      success: false,
      message: '未知操作类型'
    };
    
  } catch (error) {
    console.error('诊断失败:', error);
    return {
      success: false,
      message: '诊断失败: ' + error.message,
      error: error.message
    };
  }
}





