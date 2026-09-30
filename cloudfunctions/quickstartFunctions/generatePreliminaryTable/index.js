const cloud = require('wx-server-sdk');
const { resolveEdition, collectionName } = require('../common/edition');
const { readAll, replaceRows } = require('../common/evaluationStorage');
const { preliminaryPlan } = require('../common/evaluationPipeline');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event = {}) => {
  try {
    const db = cloud.database();
    const edition = await resolveEdition(db, { editionId: event.editionId || 'pottery-2026', mode: 'write' });
    const inputs = await Promise.all(['cleaned'].map(key => readAll(db, collectionName(edition, key))));
    const plan = preliminaryPlan(...inputs, event.tieResolution);
    if (!event.dryRun) {
      await replaceRows(db, collectionName(edition, 'preliminary'), plan.rows, edition.editionId);
    }
    return { success: true, message: event.dryRun ? '计算完成，未写入数据' : '结果生成完成', data: plan.summary };
  } catch (error) {
    return { success: false, message: error.message, code: error.code, details: error.details };
  }
};
