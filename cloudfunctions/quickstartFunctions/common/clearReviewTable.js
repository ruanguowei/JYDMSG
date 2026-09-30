const TARGETS = Object.freeze({
  clearCleanTable: ['cleaned', 'pottery_submissions_clean_2026'],
  clearPreliminaryTable: ['preliminary', 'pottery_submissions_preliminary_2026'],
  clearFinalScoringTable: ['finalScoring', 'pottery_submissions_for_final_2026'],
  clearFinalResultsTable: ['finalResults', 'pottery_submissions_final_2026']
});

function resolveClearTarget(operationName, edition) {
  if (!Object.prototype.hasOwnProperty.call(TARGETS, operationName)) throw new Error('不允许清空该表');
  if (!edition || edition.editionId !== 'pottery-2026' || edition.readOnly) throw new Error('仅允许清空2026届评审表');
  const [key, table] = TARGETS[operationName];
  const map = edition.collectionMap || {};
  if (map[key] !== table || table === map.submissions) throw new Error('评审表映射异常，禁止清空');
  return table;
}

// Only called by the authenticated, backed-up and confirmed admin execution pipeline.
async function clearReviewTable(db, operationName, edition) {
  const table = resolveClearTarget(operationName, edition);
  // Snapshot IDs first. Do not chase concurrent inserts in an unbounded deletion loop.
  const ids = [];
  for (let skip = 0;; skip += 100) {
    const result = await db.collection(table).field({ _id: true }).orderBy('_id', 'asc').skip(skip).limit(100).get();
    const page = result.data || [];
    ids.push(...page.map(row => row._id));
    if (page.length < 100) break;
  }
  let deletedCount = 0;
  for (const id of ids) {
    const result = await db.collection(table).doc(id).remove();
    deletedCount += Number(result.stats && result.stats.removed || 0);
  }
  const remaining = await db.collection(table).count();
  if (remaining.total) throw new Error(`已删除${deletedCount}条，表内仍有${remaining.total}条，请停止该阶段操作后重新预检`);
  return { success: true, message: `已清空评审表，共删除${deletedCount}条记录`, data: { table, deletedCount, totalCount: 0, remainingCount: remaining.total } };
}

module.exports = { TARGETS, resolveClearTarget, clearReviewTable };
