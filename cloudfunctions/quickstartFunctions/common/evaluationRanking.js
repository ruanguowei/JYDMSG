const { CATEGORY_ORDER, eligible } = require('./evaluationRules');
const SCORE_FIELDS = ['themeFit', 'creativity', 'craftsmanship', 'aesthetics'];
// Missing records are ignored. A genuine zero is a valid score.
function aggregateEvaluations(evaluations = []) {
  const unique = new Map();
  for (const e of evaluations) {
    if (!e || e.disqualify) continue;
    const value = e.finalScore ?? e.totalScore;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const id = e.expertCode || e.expertId;
    if (!id) continue;
    const old = unique.get(id);
    if (!old || new Date(e.evaluationTime || 0).getTime() >= new Date(old.evaluationTime || 0).getTime()) unique.set(id, e);
  }
  const records = [...unique.values()].sort((a, b) =>
    (a.finalScore ?? a.totalScore) - (b.finalScore ?? b.totalScore) ||
    String(a.expertCode || a.expertId).localeCompare(String(b.expertCode || b.expertId)));
  const retained = records.length >= 3 ? records.slice(1, -1) : records;
  const average = get => retained.length ? retained.reduce((sum, e) => sum + get(e), 0) / retained.length : null;
  const result = { totalScore: average(e => e.finalScore ?? e.totalScore), evaluationCount: records.length, countedEvaluationCount: retained.length };
  for (const field of SCORE_FIELDS) result[field + 'Total'] = average(e => e[field] ?? (e.scores && e.scores[field]) ?? 0);
  return result;
}
function compareWorks(a, b) {
  for (const key of ['totalScore']) {
    if (a[key] == null && b[key] != null) return 1;
    if (b[key] == null && a[key] != null) return -1;
    const diff = (b[key] ?? 0) - (a[key] ?? 0);
    if (Math.abs(diff) > 1e-10) return diff;
  }
  return 0;
}
function rankWorks(works) {
  const result = [];
  for (const category of CATEGORY_ORDER) {
    const rows = works.filter(w => w.categoryKey === category && eligible(w))
      .map(w => ({ ...w, ...aggregateEvaluations(w.evaluations) }))
      .sort((a, b) => String(a._id).localeCompare(String(b._id))).sort(compareWorks);
    let rank = 0;
    rows.forEach((row, i) => {
      if (!i || compareWorks(rows[i - 1], row)) rank = i + 1;
      row.categoryRank = row.totalScore == null ? null : rank;
      result.push(row);
    });
  }
  return result;
}
module.exports = { SCORE_FIELDS, aggregateEvaluations, compareWorks, rankWorks };
