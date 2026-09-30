const RUBRIC_VERSION = 'pottery-2026-numeric-v2';
const TOTAL_RUBRIC_VERSION = 'pottery-2026-total-v3';
const FIELDS = ['themeFit', 'creativity', 'craftsmanship', 'aesthetics'];
const SCORE_OPTIONS = {
  themeFit: [3, 2, 1, 0.5, 0], creativity: [3, 2, 1, 0.5, 0],
  craftsmanship: [2, 1.5, 1, 0.5, 0], aesthetics: [2, 1.5, 1, 0.5, 0]
};
// Used only to read older local clients; new clients submit numeric scores.
const GRADE_SCORE_MAP = {
  themeFit: { A: 3, B: 2, C: 1, D: 0 }, creativity: { A: 3, B: 2, C: 1, D: 0 },
  craftsmanship: { A: 2, B: 1.5, C: 1, D: 0 }, aesthetics: { A: 2, B: 1.5, C: 1, D: 0 }
};
function normalizeDeductions(raw = {}) {
  return { aiNotLabeled: raw.aiNotLabeled === true, missingCreativeStatement: raw.missingCreativeStatement === true };
}
function calculateRubric(input = {}, rawDeductions = {}) {
  const errors = [], scores = {};
  input = input || {}; rawDeductions = rawDeductions || {};
  for (const field of FIELDS) {
    const raw = input[field];
    const value = typeof raw === 'string' ? GRADE_SCORE_MAP[field][raw] : raw;
    if (!SCORE_OPTIONS[field].includes(value)) errors.push(`${field} 请选择规定分值`);
    else scores[field] = value;
  }
  const deductions = normalizeDeductions(rawDeductions);
  const rawTotalScore = FIELDS.reduce((sum, field) => sum + (scores[field] || 0), 0);
  const deductionScore = (deductions.aiNotLabeled ? 2 : 0) + (deductions.missingCreativeStatement ? 1 : 0);
  return { ok: !errors.length, errors, rubricVersion: RUBRIC_VERSION, scores, rawTotalScore, deductions, deductionScore, finalScore: Math.max(0, rawTotalScore - deductionScore) };
}
function calculateTotalRubric(baseScore, rawDeductions = {}) {
  const valid = typeof baseScore === 'number' && Number.isFinite(baseScore) && baseScore >= 0 && baseScore <= 10 && Math.abs(baseScore * 10 - Math.round(baseScore * 10)) < 1e-8;
  const deductions = normalizeDeductions(rawDeductions || {});
  const deductionScore = (deductions.aiNotLabeled ? 2 : 0) + (deductions.missingCreativeStatement ? 1 : 0);
  const rawTotalScore = valid ? Math.round(baseScore * 10) / 10 : 0;
  return { ok: valid, errors: valid ? [] : ['请选择0—10分的基础分，精确到0.1分'], rubricVersion: TOTAL_RUBRIC_VERSION,
    baseScore: rawTotalScore, rawTotalScore, deductions, deductionScore, finalScore: Math.max(0, Math.round((rawTotalScore - deductionScore) * 10) / 10) };
}
module.exports = { RUBRIC_VERSION, TOTAL_RUBRIC_VERSION, FIELDS, SCORE_OPTIONS, GRADE_SCORE_MAP, normalizeDeductions, calculateRubric, calculateTotalRubric };
