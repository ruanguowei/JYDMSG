async function readAll(db, name) {
  const rows = [];
  for (let skip = 0;; skip += 100) {
    const result = await db.collection(name).orderBy('_id', 'asc').skip(skip).limit(100).get();
    const page = result.data || []; rows.push(...page);
    if (page.length < 100) return rows;
  }
}
// Call only after the entire plan has validated. Keep stable IDs across stages.
async function replaceRows(db, name, rows, editionId) {
  const oldRows = await readAll(db, name);
  const ids = new Set(rows.map(w => w._id));
  if (ids.size !== rows.length || rows.some(w => !w._id)) throw new Error('作品编号缺失或重复，未写入');
  for (const row of rows) {
    const data = { ...row, editionId, _generatedAt: new Date() }; delete data._id;
    await db.collection(name).doc(row._id).set({ data });
  }
  for (const row of oldRows) if (!ids.has(row._id)) await db.collection(name).doc(row._id).remove();
}
module.exports = { readAll, replaceRows };
