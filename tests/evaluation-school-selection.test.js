const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { CATEGORY_ORDER: keys, prepareWork, normalizeSchool } = require('../cloudfunctions/quickstartFunctions/common/evaluationRules');
const { rankWorks } = require('../cloudfunctions/quickstartFunctions/common/evaluationRanking');
const { selectWithSchoolMinimum } = require('../cloudfunctions/quickstartFunctions/common/evaluationSelection');
const { createOfflineCloud, loadOfflineFunction } = require('./helpers/offlineEvaluationCloud');
const quota = (a, b, c = 0, d = 0) => ({ technique: a, culture: b, algorithm: c, industry: d });
function work(id, school, category, score) {
  return prepareWork({ _id: String(id), school, category, schoolProvinces: '江西', evaluations: score == null ? [] : [{ expertCode: 'e', finalScore: score, themeFit: score % 3, creativity: score % 2, craftsmanship: 1 }] });
}
// Current rules compare total scores only; legacy dimension totals cannot break ties.
const totals = rows => ['totalScore'].map(key => rows.reduce((sum, row) => sum + row[key], 0));
const greater = (a, b) => { if (!b) return true; for (let i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > 1e-9) return a[i] > b[i]; } return false; };
function subsets(rows, quotas) {
  const matches = [];
  for (let mask = 0; mask < (1 << rows.length); mask++) {
    const selected = rows.filter((_, index) => mask & (1 << index));
    if (keys.every(key => selected.filter(w => w.categoryKey === key).length === quotas[key])) matches.push(selected);
  }
  return matches;
}
const covers = (rows, schools) => schools.every(school => rows.some(row => row.school === school));

test('每校最高分不能贪心锁定，跨类别调整后两校均入围', () => {
  const rows = rankWorks([work('a1', '甲', 'technique', 9), work('a2', '甲', 'culture', 8.5), work('b1', '乙', 'technique', 8.8)]);
  const result = selectWithSchoolMinimum(rows, quota(1, 1), ['甲', '乙']);
  assert.deepEqual(result.selected.map(w => w._id).sort(), ['a2', 'b1']);
});

test('初评联合终评可行性与独立穷举对照：四类、总分最优和无解', () => {
  let seed = 78531, feasible = 0, infeasible = 0;
  const rnd = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * n); };
  const q = quota(2, 2, 1, 1), f = quota(1, 1, 1, 1), schools = ['甲', '乙', '丙', '丁'];
  for (let sample = 0; sample < 100; sample++) {
    const rows = rankWorks(Array.from({ length: 10 }, (_, i) => work(i, schools[rnd(4)], keys[i % 4], rnd(21) / 2)));
    let best = null;
    for (const selected of subsets(rows, q)) {
      if (!subsets(selected, f).some(final => covers(final, schools))) continue;
      const value = totals(selected);
      if (greater(value, best)) best = value;
    }
    const solve = () => selectWithSchoolMinimum(rows, q, schools, { exhibitionQuotas: f });
    if (!best) { infeasible++; assert.throws(solve); }
    else {
      feasible++;
      const result = solve();
      const actual = totals(result.selected);
      actual.forEach((value, i) => assert.ok(Math.abs(value - best[i]) < 1e-9, `样本${sample}的第${i}个目标不符`));
      assert.ok(subsets(result.selected, f).some(final => covers(final, schools)));
    }
  }
  assert.ok(feasible > 0 && infeasible > 0, '样本必须同时包含有解和无解场景');
});

test('初评覆盖所有学校仍可能挤占终评类别，必须保留另一类别的作品', () => {
  const rows = rankWorks([work('a1', '甲', 'technique', 10), work('b1', '乙', 'technique', 9), work('c1', '丙', 'culture', 10), work('c2', '丙', 'culture', 9), work('a2', '甲', 'culture', 1)]);
  const result = selectWithSchoolMinimum(rows, quota(2, 2), ['甲', '乙', '丙'], { exhibitionQuotas: quota(1, 2) });
  assert.ok(result.selected.some(w => w._id === 'a2'));
  assert.ok(subsets(result.selected, quota(1, 2)).some(rows => covers(rows, ['甲', '乙', '丙'])));
});

test('港澳台已覆盖院校无需普通名额，且未评分不影响直接展出保底', () => {
  const rows = rankWorks([work('a', '甲', 'technique', 0), work('b', '乙', 'technique', 9)]);
  const hmt = { ...work('h', '甲', 'culture', null), schoolProvinces: '香港' };
  const result = selectWithSchoolMinimum(rows, quota(1, 0), ['甲', '乙'], { coveredWorks: [hmt] });
  assert.equal(result.selected[0]._id, 'b');
  assert.equal(result.schoolCounts.length, 2);
});

test('无法满足类别组合的院校数量时报告具体缺口', () => {
  const rows = rankWorks(['甲', '乙', '丙'].flatMap((s, i) => [work(i + 't', s, 'technique', 5), work(i + 'c', s, 'culture', 4)]));
  assert.throws(() => selectWithSchoolMinimum(rows, quota(1, 1), ['甲', '乙', '丙']), /3所院校.*缺1个/);
  assert.throws(() => selectWithSchoolMinimum(rows, quota(1, 1), ['甲'], { exhibitionQuotas: quota(2, 1) }), /初|缺1件/);
});

test('取消资格、无评分、缺少院校、重复来源均不能伪造保底', () => {
  const rows = rankWorks([work('a', '甲', 'technique', 8), work('b', '乙', 'technique', null)]);
  assert.throws(() => selectWithSchoolMinimum(rows, quota(1, 0), ['甲', '乙']), /乙没有可用/);
  assert.throws(() => selectWithSchoolMinimum([{ ...rows[0], qualification: false }, rows[1]], quota(1, 0), ['甲']), /仅0件/);
  assert.throws(() => selectWithSchoolMinimum([{ ...rows[0], school: '' }], quota(1, 0), ['甲']), /未填写院校/);
  assert.throws(() => selectWithSchoolMinimum([rows[0], { ...rows[0], _id: 'copy', sourceWorkId: 'a' }], quota(1, 0), ['甲']), /重复/);
  assert.equal(normalizeSchool('  ＡＢＣ　大学  '), 'abc 大学');
});

test('失败发生在覆盖结果表前，初评/开始终评/最终生成均保留旧表', async () => {
  const clean = [work('a', '甲', 'technique', 8)];
  for (const [fn, target] of [['generatePreliminaryTable', 'pottery_submissions_preliminary_2026'], ['startFinalEvaluation', 'pottery_submissions_for_final_2026'], ['generateFinalRanking', 'pottery_submissions_final_2026']]) {
    const original = [{ _id: 'sentinel', marker: '必须保留' }];
    const mock = createOfflineCloud({ pottery_submissions_clean_2026: clean, [target]: original }, [target]);
    const main = loadOfflineFunction(path.resolve(__dirname, `../cloudfunctions/quickstartFunctions/${fn}/index.js`), mock.cloud);
    const result = await main({ editionId: 'pottery-2026' });
    assert.equal(result.success, false);
    assert.deepEqual(mock.data[target], original);
    assert.equal(mock.writes.length, 0);
  }
});
