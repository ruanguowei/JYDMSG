const cloud = require('wx-server-sdk');
const { resolveEdition, collectionName, publicEdition } = require('../common/edition');
const { readAll } = require('../common/evaluationStorage');
const { prepareWork, eligible, PRELIMINARY_LIMIT, EXHIBITION_QUOTAS } = require('../common/evaluationRules');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event = {}) => {
  try {
    const db = cloud.database();
    const edition = await resolveEdition(db, { editionId: event.editionId, useCurrent: !event.editionId, mode: 'read' });
    const cleaned = (await readAll(db, collectionName(edition, 'cleaned'))).map(prepareWork);
    const domestic = cleaned.filter(w => w.participantGroup === 'domestic');
    const finalRows = await readAll(db, collectionName(edition, 'finalScoring'));
    const direct = domestic.length <= PRELIMINARY_LIMIT;
    const phase = direct || finalRows.length > 0 ? 'final' : 'initial';
    return { success: true, data: {
      phase, phaseDesc: direct ? '全部进入终评' : phase === 'final' ? '终评阶段' : '初评阶段',
      targetField: 'evaluations', needInitialEvaluation: !direct && !finalRows.length,
      needFinalEvaluation: phase === 'final', totalCount: domestic.length,
      activeCount: domestic.filter(eligible).length, finalReady: finalRows.length > 0,
      config: { initialTotal: PRELIMINARY_LIMIT, finalTargets: EXHIBITION_QUOTAS, finalTotal: 320, totalFinal: 350 },
      edition: publicEdition(edition)
    } };
  } catch (error) { return { success: false, message: error.message }; }
};
