// cloudfunctions/quickstartFunctions/getEvaluationPhase/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 评选阶段常量配置
 */
const EVALUATION_CONFIG = {
  // 评选启动阈值
  cancelThreshold: 320,        // 少于320件取消评选
  directFinalThreshold: 640,   // 少于640件直接终评
  
  // 初评目标数量（从所有作品中遴选480件进入终评）
  initialTargets: {
    technique: 150,   // 技艺类
    culture: 150,     // 文脉类
    algorithm: 90,    // 算法类
    industry: 90      // 产业类
  },
  initialTotal: 480,  // 初评总数
  
  // 终评目标数量（从480件中遴选300件入围）
  finalTargets: {
    technique: 90,    // 技艺类
    culture: 90,      // 文脉类
    algorithm: 60,    // 算法类
    industry: 60      // 产业类
  },
  finalTotal: 300,    // 终评入围数
  
  // 总入围数量
  totalFinal: 320,              // 总入围320件
  hkMacauTaiwanQuota: 20,       // 港澳台直接入围约20件
  visionQuota: 30               // 视界类邀约作品30件（不参与评选）
}

/**
 * 获取当前评选阶段
 * 根据作品数量判断：
 * - < 320件：取消评选，所有作品直接入围
 * - 320-639件：直接终评
 * - ≥ 640件：初评+终评
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 获取评选阶段 ===');
    
    // 统计有参赛资格的作品数量（只排除视界类，港澳台作品也要参与评分）- 从清洗表统计
    const submissionsResult = await db.collection('pottery_submissions_clean')
      .where({
        qualification: db.command.neq(false), // 有参赛资格
        workType: 'regular', // 只统计普通作品（排除视频等特殊类型）
        category: db.command.neq('vision') // 只排除视界类（视界类不参与评分）
        // 港澳台作品虽然直接入围，但也要参与评分（作为评奖依据）
      })
      .count()
    
    const totalCount = submissionsResult.total || 0;
    console.log('参赛作品总数:', totalCount);
    
    // 判断评选阶段
    let phase = 'none'; // 取消评选
    let phaseDesc = '取消评选';
    let targetField = null; // 不需要评分
    let needInitialEvaluation = false; // 是否需要初评
    let needFinalEvaluation = false; // 是否需要终评
    
    if (totalCount < 320) {
      // 作品数量 < 320，取消评选，所有作品直接入围
      phase = 'none';
      phaseDesc = '取消评选（作品少于320件，所有作品直接入围展览）';
      targetField = null;
      needInitialEvaluation = false;
      needFinalEvaluation = false;
    } else if (totalCount >= 320 && totalCount < 640) {
      // 作品数量 320-639，直接终评
      phase = 'final';
      phaseDesc = '直接终评';
      targetField = 'finalEvaluation';
      needInitialEvaluation = false;
      needFinalEvaluation = true;
    } else {
      // 作品数量 ≥ 640，需要初评+终评
      // 这里需要判断当前是初评阶段还是终评阶段
      // 可以通过检查是否已经有初评结果来判断
      
      // 检查是否所有作品都已完成初评 - 从清洗表检查
      const evaluatedResult = await db.collection('pottery_submissions_clean')
        .where({
          qualification: db.command.neq(false),
          workType: 'regular',
          category: db.command.neq('vision'),
          evaluations: db.command.exists(true) // 有初评记录
        })
        .count()
      
      const evaluatedCount = evaluatedResult.total || 0;
      const evaluationRate = totalCount > 0 ? (evaluatedCount / totalCount) : 0;
      
      console.log('已初评作品数:', evaluatedCount);
      console.log('初评完成率:', (evaluationRate * 100).toFixed(2) + '%');
      
      // 如果初评完成率 >= 95%，则进入终评阶段
      if (evaluationRate >= 0.95) {
        phase = 'final';
        phaseDesc = '终评阶段';
        targetField = 'finalEvaluation';
        needInitialEvaluation = false;
        needFinalEvaluation = true;
      } else {
        phase = 'initial';
        phaseDesc = '初评阶段';
        targetField = 'evaluations';
        needInitialEvaluation = true;
        needFinalEvaluation = false;
      }
    }
    
    console.log('评选阶段:', phase, '-', phaseDesc);
    console.log('目标字段:', targetField);
    console.log('评选配置:', EVALUATION_CONFIG);
    
    return {
      success: true,
      data: {
        phase: phase, // 'none' | 'initial' | 'final'
        phaseDesc: phaseDesc,
        targetField: targetField, // null | 'evaluations' | 'finalEvaluation'
        needInitialEvaluation: needInitialEvaluation,
        needFinalEvaluation: needFinalEvaluation,
        totalCount: totalCount,
        config: EVALUATION_CONFIG, // 返回完整的评选配置
        // 向下兼容的字段
        thresholds: {
          cancelThreshold: EVALUATION_CONFIG.cancelThreshold,
          directFinalThreshold: EVALUATION_CONFIG.directFinalThreshold
        }
      }
    }
    
  } catch (error) {
    console.error('获取评选阶段失败:', error)
    return {
      success: false,
      message: '获取评选阶段失败',
      error: error.message
    }
  }
}

