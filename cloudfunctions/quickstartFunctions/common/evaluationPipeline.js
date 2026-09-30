const { CATEGORY_ORDER, CATEGORY_NAMES, EXHIBITION_QUOTAS, PRELIMINARY_LIMIT, prepareWork, eligible } = require('./evaluationRules');
const { allocateQuotas } = require('./evaluationQuota');
const { rankWorks } = require('./evaluationRanking');
const { countSchools, requiredSchools, selectWithSchoolMinimum } = require('./evaluationSelection');
const workId = work => work.sourceWorkId || work._id;
const categoryCounts = works => Object.fromEntries(CATEGORY_ORDER.map(key => [key, works.filter(w => w.categoryKey === key).length]));
function exhibitionQuotas(hmt) {
  const counts = categoryCounts(hmt);
  const quotas = Object.fromEntries(CATEGORY_ORDER.map(key => [key, EXHIBITION_QUOTAS[key] - counts[key]]));
  for (const key of CATEGORY_ORDER) {
    if (quotas[key] < 0) throw new Error(`${CATEGORY_NAMES[key]}港澳台有效作品${counts[key]}件，超过该类别展出名额${EXHIBITION_QUOTAS[key]}件`);
  }
  return quotas;
}
function schoolSummary(schoolCounts) {
  return { schoolCounts, schoolCount: schoolCounts.length, coveredSchoolCount: schoolCounts.filter(row => row.count >= 1).length, finalFeasibilityChecked: true };
}
function currentWorks(rows, cleaned) {
  const sources = new Map(cleaned.map(w => [w._id, w]));
  return rows.filter(w => eligible(w) && sources.has(workId(w)) && eligible(sources.get(workId(w))))
    .map(w => {
      const source = sources.get(workId(w));
      // School/category identity is taken from the cleaned source, not a stale stage copy.
      return prepareWork({ ...w, school: source.school, category: source.category, schoolProvinces: source.schoolProvinces, sourceWorkId: workId(w) });
    });
}
function preliminaryPlan(cleaned, tieResolution) {
  const prepared = cleaned.map(prepareWork);
  const domestic = prepared.filter(w => w.participantGroup === 'domestic');
  const schools = requiredSchools(prepared);
  const hmt = prepared.filter(w => w.participantGroup === 'hmt' && eligible(w));
  // Freeze category distribution against the prepared collection, not the mutable qualification flag.
  const counts = categoryCounts(domestic);
  const direct = domestic.length <= PRELIMINARY_LIMIT;
  const quotas = direct ? categoryCounts(domestic.filter(eligible)) : allocateQuotas(counts);
  const ranked = rankWorks(domestic);
  const finalQuotas = exhibitionQuotas(hmt);
  const selection = selectWithSchoolMinimum(ranked, quotas, schools, {
    coveredWorks: hmt, exhibitionQuotas: finalQuotas, allowUnscored: direct, stage: '初评', requireTieConfirmation: !direct, tieResolution
  });
  const selected = selection.selected.map(w => ({ ...w, sourceWorkId: w._id, initialTotalScore: w.totalScore, initialThemeFitTotal: w.themeFitTotal, initialCreativityTotal: w.creativityTotal, initialCraftsmanshipTotal: w.craftsmanshipTotal }));
  return { rows: selected, summary: { totalCount: selected.length, regularCount: selected.length, quotas, exhibitionQuotas: finalQuotas, directFinal: direct, ...schoolSummary(selection.schoolCounts) } };
}
function finalScoringPlan(cleaned, preliminary, existing = []) {
  if (existing.some(w => (w.evaluations || []).length)) throw new Error('终评已经有评分，不能重新生成评分表覆盖现有评分');
  const prepared = cleaned.map(prepareWork);
  const domestic = prepared.filter(w => w.participantGroup === 'domestic');
  const selected = domestic.length <= PRELIMINARY_LIMIT ? domestic.filter(eligible) : currentWorks(preliminary, cleaned).filter(w => w.participantGroup === 'domestic');
  if (domestic.length > PRELIMINARY_LIMIT && !selected.length) throw new Error('请先生成有效的初评结果');
  const hmt = prepared.filter(w => w.participantGroup === 'hmt' && eligible(w));
  // Check even an old preliminary table before creating final tasks. This is only
  // a feasibility calculation; the chosen subset does not lock in final winners.
  selectWithSchoolMinimum(rankWorks(selected), exhibitionQuotas(hmt), requiredSchools(prepared), {
    coveredWorks: hmt, allowUnscored: true, stage: '开始终评'
  });
  const unique = new Map([...selected, ...hmt].map(w => [workId(w), w]));
  const rows = [...unique.values()].map(w => {
    const row = { ...w, _id: workId(w), sourceWorkId: workId(w), directExhibition: w.participantGroup === 'hmt', awardEligible: true, evaluations: [] };
    for (const field of ['finalEvaluation', 'totalScore', 'themeFitTotal', 'creativityTotal', 'craftsmanshipTotal', 'aestheticsTotal', 'categoryRank', 'awardRank', 'evaluationCount', 'countedEvaluationCount']) delete row[field];
    return row;
  });
  return { rows, summary: { totalCount: rows.length, regularCount: selected.length, hkMacauTaiwanCount: hmt.length, ...schoolSummary([...countSchools(rows)].map(([school, count]) => ({ school, count }))) } };
}
function finalResultsPlan(cleaned, finalScoring, tieResolution) {
  const ranked = rankWorks(currentWorks(finalScoring, cleaned));
  const hmt = ranked.filter(w => w.participantGroup === 'hmt');
  const expectedHmt = cleaned.map(prepareWork).filter(w => w.participantGroup === 'hmt' && eligible(w));
  const missingHmt = expectedHmt.filter(w => !hmt.some(row => workId(row) === w._id));
  if (missingHmt.length) throw new Error(`有${missingHmt.length}件港澳台作品尚未加入终评评分表，请先核对终评任务`);
  const domestic = ranked.filter(w => w.participantGroup === 'domestic');
  const quotas = exhibitionQuotas(hmt);
  const schools = requiredSchools(cleaned.map(prepareWork));
  const selection = selectWithSchoolMinimum(domestic, quotas, schools, { coveredWorks: hmt, requireTieConfirmation: true, tieResolution });
  // Award rankings contain only exhibitors. HMT scores have no effect on their exhibition places.
  const rows = rankWorks([...selection.selected, ...hmt]).map(w => ({ ...w, awardRank: w.categoryRank, selectedForExhibition: true, directExhibition: w.participantGroup === 'hmt', awardEligible: true }));
  return { rows, summary: { totalCount: rows.length, regularCount: selection.selected.length, hkMacauTaiwanCount: hmt.length, quotas, ...schoolSummary(selection.schoolCounts), unscoredAwardCount: hmt.filter(w => w.totalScore == null).length } };
}
module.exports = { workId, currentWorks, preliminaryPlan, finalScoringPlan, finalResultsPlan };
