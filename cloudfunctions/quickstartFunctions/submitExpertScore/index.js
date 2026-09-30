const cloud = require('wx-server-sdk');
const { calculateTotalRubric } = require('../common/rubric');
const { assertOrientation } = require('../common/reviewOrientation');
const { collectionName, resolveEdition } = require('../common/edition');
const { eligible, prepareWork } = require('../common/evaluationRules');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
// Several experts can update the same work at once. Each retry must begin a new
// transaction and reread the latest evaluations, so no expert's score is lost.
async function scoringTransaction(db, callback) {
  for (let attempt = 0; ; attempt++) {
    try { return await db.runTransaction(callback); }
    catch (error) {
      const conflict = /TransactionConflict|DATABASE_TRANSACTION_CONFLICT|transaction.*conflict/i.test(String(error.code || '') + ' ' + String(error.message || ''));
      if (!conflict || attempt >= 7) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(640, 40 * 2 ** attempt) + Math.floor(Math.random() * 100)));
    }
  }
}
exports.main = async (event = {}) => {
  try {
    const db = cloud.database();
    const { expertCode, expertId, submissionId } = event;
    if (!expertCode || !expertId || !submissionId) throw new Error('缺少专家身份或作品编号');
    const experts = await db.collection('experts').where({ expertCode, status: 'active' }).get();
    const expert = (experts.data || []).find(e => e._id === expertId);
    if (!expert || !['preliminary', 'final'].includes(expert.expertType)) throw new Error('专家身份无效');
    const edition = await resolveEdition(db, { editionId: event.editionId || 'pottery-2026', mode: 'write' });
    if (expert.editionId && expert.editionId !== edition.editionId) throw new Error('专家所属届次不匹配');
    assertOrientation(expert, edition);
    const target = collectionName(edition, expert.expertType === 'final' ? 'finalScoring' : 'cleaned');
    const cleaned = collectionName(edition, 'cleaned');
    const disqualify = event.disqualify === true;
    const rubric = calculateTotalRubric(disqualify ? 0 : event.baseScore, disqualify ? {} : event.deductions);
    if (!rubric.ok) throw new Error(rubric.errors[0]);
    const now = new Date();
    const result = await scoringTransaction(db, async transaction => {
      const ref = transaction.collection(target).doc(submissionId);
      const work = (await ref.get()).data;
      if (!work || !eligible(work)) throw new Error('作品已取消资格或不存在，不能继续评审');
      const sourceId = work.sourceWorkId || work._id;
      let source = work;
      if (target !== cleaned) source = (await transaction.collection(cleaned).doc(sourceId).get()).data;
      if (!source || !eligible(source)) throw new Error('原作品已取消资格，不能继续评审');
      const prepared = prepareWork(source);
      if (prepared.participantGroup === 'international' || (expert.expertType === 'preliminary' && prepared.participantGroup !== 'domestic')) throw new Error('该作品不属于本阶段评审范围');
      const evaluation = {
        expertId: expert._id, expertCode: expert.expertCode, expertName: expert.expertName || expert.name || '',
        rubricVersion: rubric.rubricVersion, baseScore: rubric.baseScore,
        totalScore: rubric.rawTotalScore, rawTotalScore: rubric.rawTotalScore, finalScore: rubric.finalScore,
        deductions: rubric.deductions, deductionScore: rubric.deductionScore, evaluationTime: now, disqualify
      };
      const evaluations = (work.evaluations || []).filter(e => e.expertCode !== expertCode && e.expertId !== expertId);
      evaluations.push(evaluation);
      const data = { evaluations };
      if (disqualify) Object.assign(data, { qualification: false, disqualifyReason: '内容违规或侵权抄袭', disqualifyTime: now, disqualifyExpertCode: expertCode });
      await ref.update({ data });
      if (disqualify && target !== cleaned) await transaction.collection(cleaned).doc(sourceId).update({ data: { qualification: false, disqualifyReason: '内容违规或侵权抄袭', disqualifyTime: now, disqualifyExpertCode: expertCode } });
      return { totalEvaluations: evaluations.length, lastEvaluationTime: now, disqualify, expertType: expert.expertType };
    });
    return { success: true, message: disqualify ? '作品已取消资格' : '评分提交成功', data: result };
  } catch (error) {
    return { success: false, message: error.message || '评分提交失败' };
  }
};
