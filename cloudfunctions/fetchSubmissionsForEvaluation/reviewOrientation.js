const crypto = require('crypto');
const { collectionName } = require('./edition');
const { eligible, prepareWork } = require('./evaluationRules');
const VERSION = 'orientation-total-v1';
const stageKey = (edition, expert) => `${edition.editionId}_${expert.expertType}`;
const pledgeStamp = expert => JSON.stringify(expert.pledgeSignTime || null);
function stateFor(expert, edition) {
  const state = (expert.reviewOrientations || {})[stageKey(edition, expert)];
  return state && state.version === VERSION && state.pledgeStamp === pledgeStamp(expert) ? state : null;
}
function assertOrientation(expert, edition) {
  if (!expert.pledgeSigned || !(stateFor(expert, edition) || {}).completedAt) {
    const error = new Error('请先完成评分前预览'); error.code = 'ORIENTATION_REQUIRED'; throw error;
  }
}
async function metadata(db, name) {
  const rows = [];
  for (let skip = 0;; skip += 100) {
    const page = (await db.collection(name).field({ _id: true, sourceWorkId: true, category: true,
      schoolProvinces: true, perspectiveImage: true, qualification: true, 'evaluations.disqualify': true })
      .orderBy('_id', 'asc').skip(skip).limit(100).get()).data || [];
    rows.push(...page); if (page.length < 100) return rows;
  }
}
async function candidates(db, edition, expert) {
  const cleaned = await metadata(db, collectionName(edition, 'cleaned'));
  const sources = new Map(cleaned.map(row => [row._id, row]));
  const works = expert.expertType === 'final' ? await metadata(db, collectionName(edition, 'finalScoring')) : cleaned;
  return works.filter(w => {
    const source = sources.get(w.sourceWorkId || w._id);
    if (!source || !eligible(source) || !eligible(w)) return false;
    const group = prepareWork(source).participantGroup;
    return group !== 'international' && (expert.expertType === 'final' || group === 'domestic');
  }).map(w => ({ id: w._id, image: w.perspectiveImage || (sources.get(w.sourceWorkId || w._id) || {}).perspectiveImage || '' }))
    .filter(w => /^(cloud|https?):\/\//.test(w.image));
}
async function handleOrientation(db, cloud, expert, edition, event) {
  if (!expert.pledgeSigned) throw new Error('请先签署承诺书');
  let state = stateFor(expert, edition);
  const action = event.action || 'get';
  if (action === 'status') return { completed: !!(state && state.completedAt) };
  if (!['get', 'viewed', 'complete'].includes(action)) throw new Error('无效预览操作');
  if (state && state.completedAt) return { completed: true };
  // Scan only lightweight metadata; only six thumbnail URLs are returned per batch.
  const available = await candidates(db, edition, expert);
  if (!available.length) throw new Error('暂无带主视图的可评作品，请等待管理员准备评审数据');
  if (!state || state.ids.some(id => !available.some(w => w.id === id))) {
    if (action !== 'get') throw new Error('预览作品发生变化，请重新加载');
    const shuffled = available.slice();
    for (let i = shuffled.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const proposed = { version: VERSION, pledgeStamp: pledgeStamp(expert), sessionId: crypto.randomBytes(16).toString('hex'),
      ids: shuffled.slice(0, 30).map(w => w.id), viewedIds: [], createdAt: Date.now() };
    state = await db.runTransaction(async tx => {
      const ref = tx.collection('experts').doc(expert._id);
      const latest = (await ref.get()).data;
      if (!latest || !latest.pledgeSigned || latest.status !== 'active' || pledgeStamp(latest) !== pledgeStamp(expert) || latest.expertType !== expert.expertType) throw new Error('专家状态已变化，请重新进入预览');
      const existing = stateFor(latest, edition);
      if (existing && (existing.completedAt || existing.ids.every(id => available.some(w => w.id === id)))) return existing;
      await ref.update({ data: { [`reviewOrientations.${stageKey(edition, expert)}`]: proposed } });
      return proposed;
    });
  }
  if (state.completedAt) return { completed: true };
  if (action !== 'get') {
    if (event.sessionId !== state.sessionId) throw new Error('预览会话已更新，请重新加载');
    const field = `reviewOrientations.${stageKey(edition, expert)}`;
    // Merge acknowledgements in a transaction; late requests cannot undo progress.
    state = await db.runTransaction(async tx => {
      const ref = tx.collection('experts').doc(expert._id);
      const currentExpert = (await ref.get()).data;
      const current = stateFor(currentExpert, edition);
      if (!current || current.sessionId !== event.sessionId || !currentExpert.pledgeSigned || currentExpert.status !== 'active' || currentExpert.expertType !== expert.expertType) throw new Error('预览会话失效');
      if (action === 'viewed') {
        const ids = Array.isArray(event.viewedIds) ? event.viewedIds : [];
        if (!ids.length || ids.length > 6 || ids.some(id => !current.ids.includes(id))) throw new Error('预览记录不匹配');
        current.viewedIds = [...new Set([...current.viewedIds, ...ids])];
      } else {
        if (!current.ids.length || current.ids.some(id => !current.viewedIds.includes(id))) throw new Error('请先看完全部预览图片');
        current.completedAt = Date.now();
      }
      await ref.update({ data: { [field]: current } }); return current;
    });
  }
  const index = Math.max(0, Math.min(Math.ceil(state.ids.length / 6) - 1, Number.isInteger(event.batchIndex) ? event.batchIndex : 0));
  const ids = state.ids.slice(index * 6, index * 6 + 6);
  const images = ids.map(id => available.find(w => w.id === id));
  const cloudIds = images.map(w => w.image).filter(url => url.startsWith('cloud://'));
  const files = cloudIds.length ? (await cloud.getTempFileURL({ fileList: cloudIds })).fileList || [] : [];
  const batch = images.map((w, i) => {
    const url = w.image.startsWith('cloud://') ? ((files.find(f => f.fileID === w.image) || {}).tempFileURL || '') : w.image;
    const host = (url.split('/')[2] || '').split(':')[0].toLowerCase();
    const supported = /(^|\.)(tcb\.qcloud\.la|myqcloud\.com|tencentcos\.cn)$/.test(host);
    const thumbnail = supported ? url.split('#')[0] + (url.includes('?') ? '&' : '?') + 'imageMogr2/thumbnail/320x/format/jpg/quality/65' : '';
    return { id: w.id, ordinal: index * 6 + i + 1, thumbnail, viewed: state.viewedIds.includes(w.id) };
  });
  return { sessionId: state.sessionId, completed: !!state.completedAt, total: state.ids.length,
    viewedCount: state.viewedIds.length, batchIndex: index, batchCount: Math.ceil(state.ids.length / 6), batch };
}
module.exports = { handleOrientation, assertOrientation, stateFor };
