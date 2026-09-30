const cloud = require('wx-server-sdk');
const { resolveEdition, collectionName } = require('../common/edition');
const { readAll, replaceRows } = require('../common/evaluationStorage');
const { finalResultsPlan } = require('../common/evaluationPipeline');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event = {}) => {
  try {
    const db = cloud.database();
    const edition = await resolveEdition(db, { editionId: event.editionId || 'pottery-2026', mode: 'write' });
    const inputs = await Promise.all(['cleaned', 'finalScoring'].map(key => readAll(db, collectionName(edition, key))));
    const plan = finalResultsPlan(...inputs, event.tieResolution);
    if (!event.dryRun) {
      const existing = new Map((await readAll(db, collectionName(edition, 'finalResults'))).map(row => [row._id, row]));
      for (const row of plan.rows) {
        const old = existing.get(row._id);
        // Recomputing rankings must not erase manually assigned awards/certificates.
        if (old) for (const key of ['status', 'awardCertificate', 'shortlistedCertificate']) {
          if (old[key] !== undefined) row[key] = old[key];
        }
      }
      await replaceRows(db, collectionName(edition, 'finalResults'), plan.rows, edition.editionId);
    }
    return { success: true, message: event.dryRun ? '计算完成，未写入数据' : '结果生成完成', data: plan.summary };
  } catch (error) {
    return { success: false, message: error.message, code: error.code, details: error.details };
  }
};
