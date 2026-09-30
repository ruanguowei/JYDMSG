const cloud = require('wx-server-sdk');
const { assertOrientation } = require('../common/reviewOrientation');
const { collectionName, publicEdition, resolveEdition } = require('../common/edition');
const { prepareWork, eligible, CATEGORY_NAMES, CATEGORY_ORDER } = require('../common/evaluationRules');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
// Only metadata is scanned for exact per-expert counts. Images and descriptions are
// fetched for the current five works only; no process-wide cache can stale a veto.
async function readMetadata(db, name, where) {
  const rows = [];
  const fields = { _id: true, sourceWorkId: true, category: true, schoolProvinces: true,
    qualification: true, workType: true, submissionTime: true, submitTime: true,
    'evaluations.expertCode': true, 'evaluations.expertId': true, 'evaluations.disqualify': true };
  for (let skip = 0;; skip += 100) {
    const collection = db.collection(name);
    const result = await (where ? collection.where(where) : collection).field(fields).orderBy('_id', 'asc').skip(skip).limit(100).get();
    const page = result.data || []; rows.push(...page);
    if (page.length < 100) return rows;
  }
}
// Batch requests do not recalculate global counts. Filter already-scored rows in
// the database, then preserve the historical submissionTime/submitTime ordering.
async function pendingBatch(db, edition, expert, category) {
  const command = db.command;
  const table = collectionName(edition, expert.expertType === 'final' ? 'finalScoring' : 'cleaned');
  const cleanedTable = collectionName(edition, 'cleaned');
  const rows = await readMetadata(db, table, {
    categoryKey: category,
    qualification: command.neq(false),
    'evaluations.disqualify': command.nin([true]),
    'evaluations.expertCode': command.nin([expert.expertCode]),
    'evaluations.expertId': command.nin([expert._id])
  });
  const allowed = work => {
    if (!work || !eligible(work)) return false;
    const prepared = prepareWork(work);
    return prepared.categoryKey === category && prepared.participantGroup !== 'international'
      && (expert.expertType === 'final' || prepared.participantGroup === 'domestic');
  };
  const time = work => {
    const value = new Date(work.submissionTime || work.submitTime || 0).getTime();
    return Number.isFinite(value) ? value : 0;
  };
  const candidates = rows.filter(allowed).sort((a, b) =>
    Number(a.workType === 'video') - Number(b.workType === 'video') || time(b) - time(a) || a._id.localeCompare(b._id));
  const selected = [];
  for (let offset = 0; offset < candidates.length && selected.length < 5; offset += 5) {
    const chunk = candidates.slice(offset, offset + 5);
    // One indexed ID query per candidate group; never scan the source table.
    let sources;
    if (expert.expertType === 'final') {
      const ids = [...new Set(chunk.map(work => work.sourceWorkId || work._id))];
      const sourceRows = await db.collection(cleanedTable).where({ _id: command.in(ids) })
        .field({ _id: true, qualification: true, 'evaluations.disqualify': true }).get();
      sources = new Map((sourceRows.data || []).map(work => [work._id, work]));
    }
    const valid = chunk.filter(work => !sources || (sources.has(work.sourceWorkId || work._id)
      && eligible(sources.get(work.sourceWorkId || work._id))));
    if (!valid.length) continue;
    const details = await db.collection(table).where({ _id: command.in(valid.map(work => work._id)) }).get();
    const byId = new Map((details.data || []).map(work => [work._id, work]));
    for (const candidate of valid) {
      const work = byId.get(candidate._id);
      if (!allowed(work) || (work.evaluations || []).some(e => e.expertCode === expert.expertCode || e.expertId === expert._id)) continue;
      selected.push({ id: work._id, title: work.artworkName || work.title || '未命名作品',
        category, categoryName: CATEGORY_NAMES[category],
        imageUrl: work.perspectiveImage || (work.fourViewImages || [])[0] || (work.detailImages || [])[0] || '',
        workType: work.workType || 'regular', videoNumber: work.videoNumber || '', orderNumber: selected.length + 1 });
      if (selected.length === 5) break;
    }
  }
  return selected;
}
exports.main = async (event = {}) => {
  try {
    const category = event.category || '';
    if (category && !CATEGORY_ORDER.includes(category)) throw new Error('无效的评审类别');
    const db = cloud.database();
    const result = await db.collection('experts').where({ expertCode: event.expertCode, status: 'active' }).get();
    const expert = result.data && result.data[0];
    if (!expert || !['preliminary', 'final'].includes(expert.expertType)) throw new Error('专家身份无效');
    const edition = await resolveEdition(db, { editionId: event.editionId || 'pottery-2026', mode: 'read' });
    if (expert.editionId && expert.editionId !== edition.editionId) throw new Error('专家所属届次不匹配');
    assertOrientation(expert, edition);
    if (event.batchOnly === true && category && edition.editionId === 'pottery-2026') {
      const data = await pendingBatch(db, edition, expert, category);
      return { success: true, data, category,
        expertInfo: { expertType: expert.expertType, role: expert.expertType === 'final' ? '终评评委' : '初评评委', edition: publicEdition(edition) } };
    }
    const cleaned = await readMetadata(db, collectionName(edition, 'cleaned'));
    const sources = new Map(cleaned.map(w => [w._id, w]));
    const rows = expert.expertType === 'final' ? await readMetadata(db, collectionName(edition, 'finalScoring')) : cleaned;
    const works = rows.filter(w => eligible(w) && sources.has(w.sourceWorkId || w._id) && eligible(sources.get(w.sourceWorkId || w._id))).map(prepareWork)
      .filter(w => w.participantGroup !== 'international' && (expert.expertType === 'final' || w.participantGroup === 'domestic'));
    const isEvaluated = w => (w.evaluations || []).some(e => e.expertCode === expert.expertCode || e.expertId === expert._id);
    const categories = CATEGORY_ORDER.map(key => {
      const group = works.filter(w => w.categoryKey === key);
      const evaluated = group.filter(isEvaluated).length;
      return { key, name: CATEGORY_NAMES[key], total: group.length, evaluated, unevaluated: group.length - evaluated };
    });
    const selected = category ? works.filter(w => w.categoryKey === category) : works;
    const time = w => { const ms = new Date(w.submissionTime || w.submitTime || 0).getTime(); return Number.isFinite(ms) ? ms : 0; };
    const pending = selected.filter(w => !isEvaluated(w)).sort((a, b) =>
      Number(a.workType === 'video') - Number(b.workType === 'video') || time(b) - time(a) || a._id.localeCompare(b._id));
    const table = collectionName(edition, expert.expertType === 'final' ? 'finalScoring' : 'cleaned');
    const batch = event.summaryOnly ? [] : pending.slice(0, 5);
    const details = await Promise.all(batch.map(w => db.collection(table).doc(w._id).get()));
    const data = details.map(r => r.data).filter(w => w && eligible(w)).map((w, i) => {
      const { categoryKey } = prepareWork(w);
      return { id: w._id, title: w.artworkName || w.title || '未命名作品',
        category: categoryKey, categoryName: CATEGORY_NAMES[categoryKey],
        imageUrl: w.perspectiveImage || (w.fourViewImages || [])[0] || (w.detailImages || [])[0] || '',
        workType: w.workType || 'regular', videoNumber: w.videoNumber || '', orderNumber: i + 1 };
    }).filter(w => !category || w.category === category);
    return { success: true, data, categories, category,
      expertInfo: { expertType: expert.expertType, role: expert.expertType === 'final' ? '终评评委' : '初评评委', edition: publicEdition(edition) },
      statistics: { total: selected.length, evaluated: selected.length - pending.length, unevaluated: pending.length, returned: data.length } };
  } catch (error) { return { success: false, code: error.code, message: error.message }; }
};
