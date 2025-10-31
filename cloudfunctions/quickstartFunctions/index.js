const fetchHomeData = require('./fetchHomeData/index');
const createAppointment = require('./createAppointment/index');
const deleteAppointment = require('./deleteAppointment/index');
const fetchPotteryExhibition = require('./fetchPotteryExhibition/index');
const createPotterySubmission = require('./createPotterySubmission/index');
const updatePotterySubmission = require('./updatePotterySubmission/index');
const uploadTestPotteryData = require('./uploadTestPotteryData/index');
const fetchAllSubmissions = require('./fetchAllSubmissions/index');
const deleteSubmission = require('./deleteSubmission/index');
const createArtworkDelivery = require('./createArtworkDelivery/index');
const deleteArtworkDelivery = require('./deleteArtworkDelivery/index');
const updateArtworkDelivery = require('./updateArtworkDelivery/index');
const login = require('./login/index');

// 专家评选相关云函数
const expertLogin = require('./expertLogin/index');
const fetchSubmissionsForEvaluation = require('./fetchSubmissionsForEvaluation/index');
const fetchSubmissionDetail = require('./fetchSubmissionDetail/index');
const submitExpertScore = require('./submitExpertScore/index');
const fetchEvaluationResults = require('./fetchEvaluationResults/index');
const exportEvaluationResults = require('./exportEvaluationResults/index');
const exportPotterySubmissions = require('./exportPotterySubmissions/index');
const getEvaluationSettings = require('./getEvaluationSettings/index');
const getDeliveryTimeLimit = require('./getDeliveryTimeLimit/index');
const getEvaluationPhase = require('./getEvaluationPhase/index');

// 管理员相关云函数
const verifyAdmin = require('./verifyAdmin/index');
const generateRankingResults = require('./generateRankingResults/index');
const generateFinalRanking = require('./generateFinalRanking/index');
const getAdminStats = require('./getAdminStats/index');
const exportCleanedSubmissions = require('./exportCleanedSubmissions/index');
const exportPreliminaryResults = require('./exportPreliminaryResults/index');
const exportFinalResults = require('./exportFinalResults/index');

// 测试相关云函数
const generateTestData = require('./generateTestData/index');
const clearTestData = require('./clearTestData/index');
const clearAllData = require('./clearAllData/index');
const setupTestExperts = require('./setupTestExperts/index');
const autoEvaluateInitial = require('./autoEvaluateInitial/index');
const autoEvaluatePartial = require('./autoEvaluatePartial/index');
const autoEvaluateFinal = require('./autoEvaluateFinal/index');

// 数据清洗云函数
const cleanSubmissionsData = require('./cleanSubmissionsData/index');
const generatePreliminaryTable = require('./generatePreliminaryTable/index');
const startFinalEvaluation = require('./startFinalEvaluation/index');

// 查询统计云函数
const checkExpertProgress = require('./checkExpertProgress/index');

// 承诺书相关云函数
const signPledge = require('./signPledge/index');
const checkPledge = require('./checkPledge/index');

// 数据修复相关云函数
const fixDateFormat = require('./fixDateFormat/index');

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('云函数被调用，参数:', JSON.stringify(event));
    console.log('云函数类型:', event.type);
    
    if (!event.type) {
      console.error('缺少type参数');
      return {
        success: false,
        errMsg: '缺少type参数'
      };
    }
    
    switch (event.type) {
    case 'fetchHomeData':
      return await fetchHomeData.main(event, context);
    case 'createAppointment':
      return await createAppointment.main(event, context);
    case 'deleteAppointment':
      return await deleteAppointment.main(event, context);
    case 'fetchPotteryExhibition':
      return await fetchPotteryExhibition.main(event, context);
    case 'createPotterySubmission':
      return await createPotterySubmission.main(event, context);
    case 'updatePotterySubmission':
      return await updatePotterySubmission.main(event, context);
    case 'uploadTestPotteryData':
      return await uploadTestPotteryData.main(event, context);
    case 'fetchAllSubmissions':
      return await fetchAllSubmissions.main(event, context);
    case 'deleteSubmission':
      return await deleteSubmission.main(event, context);
    case 'createArtworkDelivery':
      return await createArtworkDelivery.main(event, context);
    case 'deleteArtworkDelivery':
      return await deleteArtworkDelivery.main(event, context);
    case 'updateArtworkDelivery':
      return await updateArtworkDelivery.main(event, context);
    case 'login':
      return await login.main(event, context);
    case 'getOpenId':
      // 直接返回openid，不需要额外的处理逻辑
      return {
        success: true,
        openid: context.OPENID
      };
    // 专家评选相关路由
    case 'expertLogin':
      return await expertLogin.main(event, context);
    case 'getEvaluationPhase':
      return await getEvaluationPhase.main(event, context);
    case 'fetchSubmissionsForEvaluation':
      return await fetchSubmissionsForEvaluation.main(event, context);
    case 'fetchSubmissionDetail':
      return await fetchSubmissionDetail.main(event, context);
    case 'submitExpertScore':
      return await submitExpertScore.main(event, context);
    case 'fetchEvaluationResults':
      return await fetchEvaluationResults.main(event, context);
    case 'exportEvaluationResults':
      return await exportEvaluationResults.main(event, context);
    case 'exportPotterySubmissions':
      return await exportPotterySubmissions.main(event, context);
    case 'getEvaluationSettings':
      return await getEvaluationSettings.main(event, context);
    case 'getDeliveryTimeLimit':
      return await getDeliveryTimeLimit.main(event, context);
    // 管理员相关路由
    case 'verifyAdmin':
      return await verifyAdmin.main(event, context);
    case 'generateRankingResults':
      return await generateRankingResults.main(event, context);
    case 'generateFinalRanking':
      return await generateFinalRanking.main(event, context);
    case 'getVideoWorksList':
      const getVideoWorksList = require('./getVideoWorksList/index');
      return await getVideoWorksList.main(event, context);
    case 'createTestVideoWorks':
      const createTestVideoWorks = require('./createTestVideoWorks/index');
      return await createTestVideoWorks.main(event, context);
    case 'clearCleanTable':
      const clearCleanTable = require('./clearCleanTable/index');
      return await clearCleanTable.main(event, context);
    case 'getAdminStats':
      return await getAdminStats.main(event, context);
    case 'exportCleanedSubmissions':
      return await exportCleanedSubmissions.main(event, context);
    case 'exportPreliminaryResults':
      return await exportPreliminaryResults.main(event, context);
    case 'exportFinalResults':
      return await exportFinalResults.main(event, context);
    // 数据清洗相关路由
    case 'cleanSubmissionsData':
      return await cleanSubmissionsData.main(event, context);
    case 'generatePreliminaryTable':
      return await generatePreliminaryTable.main(event, context);
    case 'startFinalEvaluation':
      return await startFinalEvaluation.main(event, context);
    // 查询统计相关路由
    case 'checkExpertProgress':
      return await checkExpertProgress.main(event, context);
    // 承诺书相关路由
    case 'signPledge':
      return await signPledge.main(event, context);
    case 'checkPledge':
      return await checkPledge.main(event, context);
    // 测试相关路由
    case 'generateTestData':
      return await generateTestData.main(event, context);
    case 'clearTestData':
      return await clearTestData.main(event, context);
    case 'clearAllData':
      return await clearAllData.main(event, context);
    case 'setupTestExperts':
      return await setupTestExperts.main(event, context);
    case 'autoEvaluateInitial':
      return await autoEvaluateInitial.main(event, context);
    case 'autoEvaluatePartial':
      return await autoEvaluatePartial.main(event, context);
    case 'autoEvaluateFinal':
      return await autoEvaluateFinal.main(event, context);
    case 'autoEvaluateFinalAll':
      const autoEvaluateFinalAll = require('./autoEvaluateFinalAll/index');
      return await autoEvaluateFinalAll.main(event, context);
    // 数据修复相关路由
    case 'fixDateFormat':
      return await fixDateFormat.main(event, context);
    default:
      console.error('未知的云函数类型:', event.type);
      return {
        success: false,
        errMsg: '未知的云函数类型: ' + event.type,
      };
    }
  } catch (error) {
    console.error('云函数执行异常:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return {
      success: false,
      errMsg: '云函数执行异常: ' + error.message
    };
  }
};

