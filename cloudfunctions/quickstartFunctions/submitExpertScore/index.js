// cloudfunctions/quickstartFunctions/submitExpertScore/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 使用管理员权限进行数据库操作
const _ = db.command

// 引入获取评选阶段的函数
const getEvaluationPhase = require('../getEvaluationPhase/index')

// 获取最后评分时间的辅助函数
function getLastEvaluationTime(evaluations) {
  if (!evaluations || evaluations.length === 0) {
    return null;
  }
  
  // 按评分时间排序，获取最新的
  const sortedEvaluations = evaluations.sort((a, b) => b.evaluationTime - a.evaluationTime);
  return sortedEvaluations[0].evaluationTime;
}

exports.main = async (event, context) => {
  console.log('=== 专家评分提交 ===');
  
  const { submissionId, scores, totalScore, finalScore, deductions, expertId, expertName, expertCode, disqualify, disqualifyReason } = event
  
  console.log('作品ID:', submissionId, '专家:', expertName, '专家Code:', expertCode, '总分:', totalScore, '取消资格:', disqualify, '取消原因:', disqualifyReason);
  
  try {
    // 获取专家信息，判断评委类型
    const expertResult = await db.collection('experts')
      .where({ expertCode: expertCode })
      .get();
    
    if (expertResult.data.length === 0) {
      console.error('❌ 专家信息不存在');
      return {
        success: false,
        message: '专家信息不存在'
      };
    }
    
    const expertInfo = expertResult.data[0];
    const expertType = expertInfo.expertType || '';
    console.log('专家类型 (expertType):', expertType);
    
    // 所有评委都使用 evaluations 字段
    const targetField = 'evaluations';
    
    console.log('评分将写入字段:', targetField);
    
    // 验证评分数据
    if (!submissionId || !scores || !expertId || !expertCode) {
      console.log('参数验证失败:', { 
        submissionId: !!submissionId, 
        scores: !!scores, 
        expertId: !!expertId,
        expertCode: !!expertCode 
      });
      return {
        success: false,
        message: '参数不完整，缺少必要参数'
      }
    }
    
    // 验证评分范围
    const { themeFit, creativity, craftsmanship, aesthetics } = scores
    if (themeFit < 0 || themeFit > 3 || 
        creativity < 0 || creativity > 3 ||
        craftsmanship < 0 || craftsmanship > 2 ||
        aesthetics < 0 || aesthetics > 2) {
      return {
        success: false,
        message: '评分超出有效范围'
      }
    }
    
    // 不在此处进行时间窗口校验。时间控制在入口页面进行。
    
    // 获取作品信息 - 根据评委类型从不同表读取
    let submissionResult;
    
    if (expertType === 'final') {
      // 终评评委：从终评评分表读取
      submissionResult = await db.collection('pottery_submissions_for_final')
        .doc(submissionId)
        .get();
      console.log('终评评委：从终评评分表读取作品');
    } else {
      // 初评评委：从清洗表读取
      submissionResult = await db.collection('pottery_submissions_clean')
        .doc(submissionId)
        .get();
      console.log('初评评委：从清洗表读取作品');
    }
    
    if (!submissionResult.data) {
      console.error('❌ 作品不存在:', submissionId);
      return {
        success: false,
        message: '作品不存在'
      }
    }
    
    console.log('✅ 作品查询成功');
    
    const submission = submissionResult.data
    
    // 创建评分记录
    const evaluationRecord = {
      expertId: expertId,
      expertCode: expertCode, // 添加专家Code字段
      expertName: expertName,
      themeFit: themeFit,
      creativity: creativity,
      craftsmanship: craftsmanship,
      aesthetics: aesthetics,
      totalScore: totalScore,
      finalScore: finalScore || totalScore,
      deductions: deductions || {}, // 扣分项为空对象，支持动态添加
      evaluationTime: new Date(),
      ip: context.CLIENTIP || 'unknown'
    }
    
    // 调试信息：输出将要存储的评分记录
    console.log('=== 评分记录详情 ===');
    console.log('expertId:', evaluationRecord.expertId);
    console.log('expertCode:', evaluationRecord.expertCode);
    console.log('expertName:', evaluationRecord.expertName);
    console.log('totalScore:', evaluationRecord.totalScore);
    console.log('==================');
    
    // 更新作品评分记录（统一使用 evaluations 字段）
    let evaluations = submission.evaluations || [];
    
    // 检查是否已有该专家的评分记录（只使用expertCode）
    const existingIndex = evaluations.findIndex(eval => 
      eval.expertCode === expertCode
    )
    
    if (existingIndex >= 0) {
      // 更新现有评分
      evaluations[existingIndex] = evaluationRecord
      console.log('✏️ 更新现有评分记录');
    } else {
      // 添加新评分
      evaluations.push(evaluationRecord)
      console.log('➕ 添加新评分记录');
    }
    
    // 准备更新数据（统一使用 evaluations 字段）
    const updateData = {
      evaluations: evaluations
    };
    
    // 如果标记为取消资格，更新作品的qualification字段
    if (disqualify) {
      updateData.qualification = false;
      updateData.disqualifyReason = disqualifyReason || '内容违规或侵权抄袭';
      updateData.disqualifyTime = new Date();
      updateData.disqualifyExpert = expertName;
      updateData.disqualifyExpertCode = expertCode;
      console.log('⚠️ 作品将被取消资格，原因:', updateData.disqualifyReason);
    }
    
    // 更新数据库 - 根据评委类型写入不同表
    try {
      let updateResult;
      
      if (expertType === 'final') {
        // 终评评委：写入终评评分表
        updateResult = await db.collection('pottery_submissions_for_final')
          .doc(submissionId)
          .update({
            data: updateData
          });
        console.log('终评评委：评分写入终评评分表');
      } else {
        // 初评评委：写入清洗表
        updateResult = await db.collection('pottery_submissions_clean')
          .doc(submissionId)
          .update({
            data: updateData
          });
        console.log('初评评委：评分写入清洗表');
      }
      
      const updatedCount = updateResult.stats.updated;
      console.log('✅ 数据库更新成功，更新记录数:', updatedCount);
      
      if (updatedCount === 0) {
        console.warn('⚠️ 数据库更新返回0条记录');
        return {
          success: false,
          message: '数据库更新失败，未找到要更新的记录'
        };
      }
      
    } catch (updateError) {
      console.error('❌ 数据库更新失败:', updateError.message);
      throw updateError;
    }
    
    // 记录评分日志（可选）
    try {
      await db.collection('evaluationLogs').add({
        data: {
          submissionId: submissionId,
          expertId: expertId,
          expertCode: expertCode, // 添加专家Code字段到日志
          expertName: expertName,
          scores: scores,
          totalScore: totalScore,
          finalScore: finalScore || totalScore,
          deductions: deductions || {}, // 扣分项为空对象，支持动态添加
          evaluationTime: new Date(),
          ip: context.CLIENTIP || 'unknown',
          disqualify: disqualify || false // 记录是否取消资格
        }
      })
    } catch (logError) {
      // 日志记录失败不影响主要功能
    }
    
    console.log('🎉 评分提交完成');
    
    // 计算最后评分时间
    const lastEvaluationTime = getLastEvaluationTime(evaluations);
    
    return {
      success: true,
      message: disqualify ? '作品已取消资格' : '评分提交成功',
      data: {
        lastEvaluationTime: lastEvaluationTime,
        totalEvaluations: evaluations.length,
        disqualify: disqualify || false,
        expertType: expertType
      }
    }
    
  } catch (error) {
    console.error('❌ 评分提交异常:', error.message);
    return {
      success: false,
      message: '提交评分失败，请重试'
    }
  }
}