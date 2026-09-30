function lazyModule(modulePath) {
  return {
    get main() {
      return require(modulePath).main;
    }
  };
}

function rejectUnsafeDirectOperation(type) {
  return {
    success: false,
    errMsg: `危险操作 ${type} 已接入安全流水线，请通过 manageAdminOperation 先完成预检、备份、口令和二次确认。`
  };
}

function buildSafeEventSummary(event) {
  return {
    type: event && event.type,
    action: event && event.action,
    editionId: event && event.editionId,
    operationName: event && event.operationName
  };
}

const fetchHomeData = lazyModule('./fetchHomeData/index');
const createAppointment = lazyModule('./createAppointment/index');
const deleteAppointment = lazyModule('./deleteAppointment/index');
const fetchPotteryExhibition = lazyModule('./fetchPotteryExhibition/index');
const getCurrentEdition = lazyModule('./getCurrentEdition/index');
const fetchMuseumContent = lazyModule('./fetchMuseumContent/index');
const manageMuseumContent = lazyModule('./manageMuseumContent/index');
const manageAdminOperation = lazyModule('./manageAdminOperation/index');
const manageCertificates = lazyModule('./manageCertificates/index');
const confirmSubmissionVideo = lazyModule('./confirmSubmissionVideo/index');
const createPotterySubmission = lazyModule('./createPotterySubmission/index');
const updatePotterySubmission = lazyModule('./updatePotterySubmission/index');
const uploadTestPotteryData = lazyModule('./uploadTestPotteryData/index');
const fetchAllSubmissions = lazyModule('./fetchAllSubmissions/index');
const fetchAllDeliveries = lazyModule('./fetchAllDeliveries/index');
const deleteSubmission = lazyModule('./deleteSubmission/index');
const createArtworkDelivery = lazyModule('./createArtworkDelivery/index');
const deleteArtworkDelivery = lazyModule('./deleteArtworkDelivery/index');
const updateArtworkDelivery = lazyModule('./updateArtworkDelivery/index');
const login = lazyModule('./login/index');

// 专家评选相关云函数
const expertLogin = lazyModule('./expertLogin/index');
const fetchSubmissionsForEvaluation = lazyModule('./fetchSubmissionsForEvaluation/index');
const fetchSubmissionDetail = lazyModule('./fetchSubmissionDetail/index');
const submitExpertScore = lazyModule('./submitExpertScore/index');
const fetchEvaluationResults = lazyModule('./fetchEvaluationResults/index');
const exportEvaluationResults = lazyModule('./exportEvaluationResults/index');
const exportPotterySubmissions = lazyModule('./exportPotterySubmissions/index');
const getEvaluationSettings = lazyModule('./getEvaluationSettings/index');
const getDeliveryTimeLimit = lazyModule('./getDeliveryTimeLimit/index');
const getEvaluationPhase = lazyModule('./getEvaluationPhase/index');

// 管理员相关云函数
const verifyAdmin = lazyModule('./verifyAdmin/index');
const generateRankingResults = lazyModule('./generateRankingResults/index');
const generateFinalRanking = lazyModule('./generateFinalRanking/index');
const getAdminStats = lazyModule('./getAdminStats/index');
const exportCleanedSubmissions = lazyModule('./exportCleanedSubmissions/index');
const exportPreliminaryResults = lazyModule('./exportPreliminaryResults/index');
const exportFinalResults = lazyModule('./exportFinalResults/index');

// 测试相关云函数
const generateTestData = lazyModule('./generateTestData/index');
const clearTestData = lazyModule('./clearTestData/index');
const clearAllData = lazyModule('./clearAllData/index');
const setupTestExperts = lazyModule('./setupTestExperts/index');
const autoEvaluateInitial = lazyModule('./autoEvaluateInitial/index');
const autoEvaluatePartial = lazyModule('./autoEvaluatePartial/index');
const autoEvaluateFinal = lazyModule('./autoEvaluateFinal/index');

// 数据清洗云函数
const cleanSubmissionsData = lazyModule('./cleanSubmissionsData/index');
const generatePreliminaryTable = lazyModule('./generatePreliminaryTable/index');
const startFinalEvaluation = lazyModule('./startFinalEvaluation/index');

// 查询统计云函数
const checkExpertProgress = lazyModule('./checkExpertProgress/index');

// 承诺书相关云函数
const signPledge = lazyModule('./signPledge/index');
const checkPledge = lazyModule('./checkPledge/index');

// 数据修复相关云函数
const fixDateFormat = lazyModule('./fixDateFormat/index');
const diagnoseExpertLogin = lazyModule('./diagnoseExpertLogin/index');
const swapEvaluations = lazyModule('./swapEvaluations/index');

// 画册相关云函数
const fetchCatalogData = lazyModule('./fetchCatalogData/index');
const clearCloudStorageFiles = lazyModule('./clearCloudStorageFiles/index');


// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('云函数被调用:', JSON.stringify(buildSafeEventSummary(event || {})));
    
    if (!event.type) {
      console.error('缺少type参数');
      return {
        success: false,
        errMsg: '缺少type参数'
      };
    }
    
    switch (event.type) {
    case 'reviewOrientation':
      return await require('./reviewOrientation/index').main(event, context);
    case 'fetchHomeData':
      return await fetchHomeData.main(event, context);
    case 'createAppointment':
      return await createAppointment.main(event, context);
    case 'deleteAppointment':
      return await deleteAppointment.main(event, context);
    case 'fetchPotteryExhibition':
      return await fetchPotteryExhibition.main(event, context);
    case 'getCurrentEdition':
      return await getCurrentEdition.main(event, context);
    case 'fetchMuseumContent':
      return await fetchMuseumContent.main(event, context);
    case 'manageMuseumContent':
      return await manageMuseumContent.main(event, context);
    case 'manageAdminOperation':
      return await manageAdminOperation.main(event, context);
    case 'manageCertificates':
      return await manageCertificates.main(event, context);
    case 'confirmSubmissionVideo':
      return await confirmSubmissionVideo.main(event, context);
    case 'createPotterySubmission':
      return await createPotterySubmission.main(event, context);
    case 'updatePotterySubmission':
      return await updatePotterySubmission.main(event, context);
    case 'uploadTestPotteryData':
      return await uploadTestPotteryData.main(event, context);
    case 'fetchAllSubmissions':
      return await fetchAllSubmissions.main(event, context);
    case 'fetchAllDeliveries':
      return await fetchAllDeliveries.main(event, context);
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
      return rejectUnsafeDirectOperation(event.type);
    case 'getVideoWorksList':
      const getVideoWorksList = require('./getVideoWorksList/index');
      return await getVideoWorksList.main(event, context);
    case 'createTestVideoWorks':
      const createTestVideoWorks = require('./createTestVideoWorks/index');
      return await createTestVideoWorks.main(event, context);
    case 'clearCleanTable':
      return rejectUnsafeDirectOperation(event.type);
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
      return rejectUnsafeDirectOperation(event.type);
    case 'generatePreliminaryTable':
      return rejectUnsafeDirectOperation(event.type);
    case 'startFinalEvaluation':
      return rejectUnsafeDirectOperation(event.type);
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
      return rejectUnsafeDirectOperation(event.type);
    case 'clearAllData':
      return rejectUnsafeDirectOperation(event.type);
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
      return rejectUnsafeDirectOperation(event.type);
    case 'diagnoseExpertLogin':
      return await diagnoseExpertLogin.main(event, context);
    case 'swapEvaluations':
      return rejectUnsafeDirectOperation(event.type);
    case 'convertImageLinks':
      return rejectUnsafeDirectOperation(event.type);
    // 画册相关路由
    case 'fetchCatalogData':
      return await fetchCatalogData.main(event, context);
    case 'clearCloudStorageFiles':
      return rejectUnsafeDirectOperation(event.type);
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

