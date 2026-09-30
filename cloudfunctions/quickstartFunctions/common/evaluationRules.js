const CATEGORY_ORDER = ['technique', 'culture', 'algorithm', 'industry'];
const CATEGORY_NAMES = { technique: '传统类', culture: '当代类', algorithm: '数字类', industry: '产业类', vision: '国际类' };
const EXHIBITION_QUOTAS = { technique: 100, culture: 100, algorithm: 60, industry: 60 };
const PRELIMINARY_LIMIT = 520;
const SCHOOL_MINIMUM = 1;
const ALIASES = {
  technique: ['technique', '传统', '传统类', '传统·匠心传承', '技艺', '技艺类'],
  culture: ['culture', '当代', '当代类', '当代·当代表达', '文脉', '文脉类'],
  algorithm: ['algorithm', '数字', '数字类', '数字·数字传媒', '算法', '算法类'],
  industry: ['industry', '产业', '产业类', '产业·产业制造', '产业·产业融合'],
  vision: ['vision', '国际', '国际类', '国际·全球视野', '视界', '视界类']
};
function normalizeCategory(value) {
  const raw = String(value || '').replace(/[\s\u3000]/g, '').toLowerCase();
  const key = Object.keys(ALIASES).find(k => ALIASES[k].includes(raw)) || '';
  return { key, name: CATEGORY_NAMES[key] || '未知分类' };
}
function normalizeProvince(value) {
  return String(value || '').trim().replace(/特别行政区$|壮族自治区$|回族自治区$|维吾尔自治区$|自治区$|省$|市$/g, '');
}
function normalizeSchool(value) {
  // Normalize format only; do not guess aliases or merge different campuses.
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() : '';
}
function isHmt(work) { return ['香港', '澳门', '台湾'].includes(normalizeProvince(work.schoolProvinces)); }
function eligible(work) {
  return work.qualification !== false && !(work.evaluations || []).some(e => e.disqualify === true);
}
function prepareWork(work) {
  const categoryKey = normalizeCategory(work.category).key;
  if (!categoryKey) throw new Error(`作品 ${work.submissionNumber || work._id} 类别无法识别：${work.category || '未填写'}`);
  return { ...work, categoryKey, schoolKey: normalizeSchool(work.school), provinceKey: normalizeProvince(work.schoolProvinces), participantGroup: categoryKey === 'vision' ? 'international' : isHmt(work) ? 'hmt' : 'domestic' };
}
module.exports = { CATEGORY_ORDER, CATEGORY_NAMES, EXHIBITION_QUOTAS, PRELIMINARY_LIMIT, SCHOOL_MINIMUM, normalizeCategory, normalizeProvince, normalizeSchool, isHmt, eligible, prepareWork };
