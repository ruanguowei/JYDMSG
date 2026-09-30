const { CATEGORY_ORDER, PRELIMINARY_LIMIT } = require('./evaluationRules');
function allocateQuotas(counts, limit = PRELIMINARY_LIMIT) {
  const n = CATEGORY_ORDER.reduce((sum, key) => sum + (counts[key] || 0), 0);
  if (!n) return Object.fromEntries(CATEGORY_ORDER.map(key => [key, 0]));
  const total = Math.min(limit, n);
  const rows = CATEGORY_ORDER.map((key, order) => {
    const count = counts[key] || 0;
    return { key, order, count, quota: Math.floor(total * count / n), remainder: total * count % n };
  });
  const remaining = total - rows.reduce((sum, row) => sum + row.quota, 0);
  rows.sort((a, b) => b.remainder - a.remainder || b.count - a.count || a.order - b.order);
  for (let i = 0; i < remaining; i++) rows[i].quota++;
  return Object.fromEntries(rows.map(row => [row.key, row.quota]));
}
module.exports = { allocateQuotas };
