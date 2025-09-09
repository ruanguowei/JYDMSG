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

// 云函数入口函数
exports.main = async (event, context) => {
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
    default:
      return {
        success: false,
        errMsg: '未知的云函数类型',
      };
  }
};
        
