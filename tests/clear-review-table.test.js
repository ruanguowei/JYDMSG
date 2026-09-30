const test = require('node:test');
const assert = require('node:assert/strict');
const { TARGETS, resolveClearTarget, clearReviewTable } = require('../cloudfunctions/quickstartFunctions/common/clearReviewTable');
const { buildPreview } = require('../cloudfunctions/quickstartFunctions/common/adminOperation');
const edition = { editionId: 'pottery-2026', readOnly: false, collectionMap: { submissions: 'pottery_submissions_2026', ...Object.fromEntries(Object.values(TARGETS)) } };
function mockDb(table, rows, options = {}) {
  let removed = 0;
  return { collection(name) {
    assert.equal(name, table, '不得访问其他表');
    return {
      field: () => ({ orderBy: () => ({ skip: skip => ({ limit: limit => ({ get: async () => ({ data: rows.slice(skip, skip + limit) }) }) }) }) }),
      doc: id => ({ remove: async () => {
        if (options.fail) throw Error('模拟删除失败');
        const index = rows.findIndex(row => row._id === id);
        if (index >= 0) { rows.splice(index, 1); removed++; }
        return { stats: { removed: index >= 0 ? 1 : 0 } };
      } }),
      count: async () => ({ total: rows.length + (options.concurrentInsert ? 1 : 0) })
    };
  } };
}
test('四种操作仅允许指定2026评审表，预检准确显示目标', () => {
  for (const [operation, [,table]] of Object.entries(TARGETS)) {
    assert.equal(resolveClearTarget(operation, edition), table);
    const preview = buildPreview({ operationName: operation, edition, counts: { [table]: 12 } });
    assert.deepEqual(preview.targetCollections, [table]); assert.equal(preview.targetRecordCount, 12);
  }
  for (const name of ['pottery_submissions_2026', 'clearAllData', 'toString']) assert.throws(() => resolveClearTarget(name, edition));
  assert.throws(() => resolveClearTarget('clearCleanTable', { ...edition, editionId: 'pottery-2025' }));
  assert.throws(() => resolveClearTarget('clearCleanTable', { ...edition, readOnly: true }));
  assert.throws(() => resolveClearTarget('clearCleanTable', { ...edition, collectionMap: { ...edition.collectionMap, cleaned: 'pottery_submissions_2026' } }));
});
test('跨分页删除205条记录不漏删，仅触碰选定表；空表可完成', async () => {
  for (const count of [0, 100, 205]) {
    const rows = Array.from({ length: count }, (_, i) => ({ _id: String(i) }));
    const result = await clearReviewTable(mockDb(edition.collectionMap.cleaned, rows), 'clearCleanTable', edition);
    assert.equal(result.data.deletedCount, count); assert.equal(rows.length, 0);
  }
});
test('删除失败或并发新增不会谎报清空成功', async () => {
  await assert.rejects(clearReviewTable(mockDb(edition.collectionMap.cleaned, [{ _id: 'a' }], { fail: true }), 'clearCleanTable', edition), /模拟删除失败/);
  await assert.rejects(clearReviewTable(mockDb(edition.collectionMap.cleaned, [], { concurrentInsert: true }), 'clearCleanTable', edition), /仍有1条/);
});
