const { readAll } = require('./evaluationStorage');
const { collectionName, resolveEdition } = require('./edition');
const { prepareWork, eligible, CATEGORY_NAMES } = require('./evaluationRules');
const { rankWorks } = require('./evaluationRanking');
const { currentWorks, workId } = require('./evaluationPipeline');
function cell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function makeCsv(rows) {
  const headers = ['类别排名', '评奖排名', '作品编号', '作品名称', '作者姓名', '电话', '所在学校', '学校省份', '作品类别', '作品类型', '评分状态', '已评分人数', '计入均分人数', '终评或初评均分', '入选展出', '港澳台直接展出', '获奖等级'];
  const score = value => value == null ? '' : value.toFixed(2);
  return '\uFEFF' + [headers, ...rows.map(w => [
    w.categoryRank, w.awardRank, w.workCode || w.submissionNumber || w._id, w.artworkName || '', w.name || '', w.phone || '', w.school || '', w.schoolProvinces || '', CATEGORY_NAMES[w.categoryKey], w.workType === 'video' ? '视频作品' : '普通作品',
    w.totalScore == null ? '未评分' : '已评分', w.evaluationCount, w.countedEvaluationCount, score(w.totalScore),
    w.selectedForExhibition ? '是' : '否', w.directExhibition ? '是' : '否', ['卓越创作奖', '新锐突破奖', '优秀潜力奖'].includes(w.status) ? w.status : ''
  ])].map(row => row.map(cell).join(',')).join('\r\n');
}
async function exportEvaluation(cloud, event, phase) {
  const db = cloud.database();
  const edition = await resolveEdition(db, { editionId: event.editionId, useCurrent: !event.editionId, mode: 'read' });
  const cleaned = await readAll(db, collectionName(edition, 'cleaned'));
  let rows;
  if (phase === 'preliminary') rows = rankWorks(cleaned.map(prepareWork).filter(w => eligible(w) && w.participantGroup === 'domestic'));
  else {
    const results = await readAll(db, collectionName(edition, 'finalResults'));
    const scoring = await readAll(db, collectionName(edition, 'finalScoring'));
    const current = currentWorks(scoring, cleaned);
    const selected = new Map(results.map(w => [workId(w), w]));
    const resultOnly = event.sourceKey === 'finalResults' || event.sourceTable === 'pottery_submissions_final' || event.sourceTable === collectionName(edition, 'finalResults');
    rows = rankWorks(current.filter(w => !resultOnly || selected.has(workId(w)))).map(w => {
      const result = selected.get(workId(w));
      return { ...w, selectedForExhibition: !!result, directExhibition: w.participantGroup === 'hmt', status: result ? result.status : '' };
    });
    const awardRanks = new Map(rankWorks(rows.filter(w => w.selectedForExhibition)).map(w => [workId(w), w.categoryRank]));
    rows = rows.map(w => ({ ...w, awardRank: awardRanks.get(workId(w)) ?? null }));
  }
  if (!rows.length) throw new Error('暂无可导出的评审作品');
  const fileName = `${phase === 'preliminary' ? '初评排名' : '终评排名'}_${edition.year}_${Date.now()}.csv`;
  const uploaded = await cloud.uploadFile({ cloudPath: `admin_exports/${edition.editionId}/${fileName}`, fileContent: Buffer.from(makeCsv(rows), 'utf8') });
  const urls = await cloud.getTempFileURL({ fileList: [uploaded.fileID] });
  const url = urls.fileList && urls.fileList[0] && urls.fileList[0].tempFileURL;
  return { success: true, message: '排名导出完成，奖项由人工确定', downloadUrl: uploaded.fileID, fileName, recordCount: rows.length, data: { fileID: uploaded.fileID, fileId: uploaded.fileID, fileName, fileUrl: url || '', downloadUrl: url || '', totalCount: rows.length, count: rows.length } };
}
module.exports = { makeCsv, exportEvaluation };
