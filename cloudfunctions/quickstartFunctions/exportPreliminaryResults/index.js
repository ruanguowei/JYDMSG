const cloud = require('wx-server-sdk');
const { exportEvaluation } = require('../common/evaluationExport');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event = {}) => {
  try { return await exportEvaluation(cloud, event, 'preliminary'); }
  catch (error) { return { success: false, message: error.message }; }
};
