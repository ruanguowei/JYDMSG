const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const base = '../cloudfunctions/quickstartFunctions/common/';
const rules = require(base + 'evaluationRules');
const { allocateQuotas } = require(base + 'evaluationQuota');
const { aggregateEvaluations, rankWorks, compareWorks } = require(base + 'evaluationRanking');
const { selectWithSchoolMinimum } = require(base + 'evaluationSelection');
const { preliminaryPlan, finalScoringPlan, finalResultsPlan } = require(base + 'evaluationPipeline');
const { calculateRubric } = require(base + 'evaluationRubric');
const { makeCsv } = require(base + 'evaluationExport');
function evaluation(score, expert = 'e1') {
  return { expertCode: expert, expertId: expert, finalScore: score, totalScore: 10, themeFit: 3, creativity: 2, craftsmanship: 1.5, aesthetics: 1.5 };
}
function work(id, category = 'technique', province = '江西', score = 8) {
  return rules.prepareWork({ _id: String(id), category, school: `${province}测试院校`, schoolProvinces: province, qualification: true, evaluations: score == null ? [] : [evaluation(score)] });
}
function balancedWorks(n = 400) {
  return Array.from({ length: n }, (_, i) => work(String(i), rules.CATEGORY_ORDER[i % 4]));
}
test('评分只允许具体档位，包含1.5和文档差档端点，扣分独立并保留0', () => {
  const scores = { themeFit: 3, creativity: 2, craftsmanship: 1.5, aesthetics: 0.5 };
  const result = calculateRubric(scores, { aiNotLabeled: true, missingCreativeStatement: true });
  assert.equal(result.rawTotalScore, 7); assert.equal(result.finalScore, 4);
  assert.equal(calculateRubric({ ...scores, themeFit: 2.5 }).ok, false);
  assert.equal(calculateRubric({ ...scores, themeFit: null }).ok, false);
  assert.equal(calculateRubric({ themeFit: 0, creativity: 0, craftsmanship: 0, aesthetics: 0 }, { aiNotLabeled: true }).finalScore, 0);
});
test('忽略缺评，1/2人直接平均，3人以上去一次最高最低，零人返回未评分', () => {
  assert.equal(aggregateEvaluations([]).totalScore, null);
  assert.equal(aggregateEvaluations([evaluation(0)]).totalScore, 0);
  assert.equal(aggregateEvaluations([evaluation(0), evaluation(8, 'e2')]).totalScore, 4);
  const result = aggregateEvaluations([evaluation(0), evaluation(6, 'e2'), evaluation(8, 'e3'), evaluation(10, 'e4')]);
  assert.equal(result.totalScore, 7); assert.equal(result.countedEvaluationCount, 2);
  assert.equal(result.themeFitTotal, 3);
});
test('同分采用保留专家的维度，完全同分保持并列，不按ID增加评分条件', () => {
  const records = [evaluation(1, 'low'), { ...evaluation(5, 'mid'), themeFit: 1 }, evaluation(9, 'high')];
  assert.equal(aggregateEvaluations(records).themeFitTotal, 1);
  const rows = rankWorks([work('b'), work('a')]);
  assert.equal(compareWorks(rows[0], rows[1]), 0);
  assert.equal(rows[0].categoryRank, rows[1].categoryRank);
});
test('最大余数法总数520，余数相同按数量和固定类别顺序', () => {
  assert.deepEqual(allocateQuotas({ technique: 400, culture: 300, algorithm: 200, industry: 100 }), { technique: 208, culture: 156, algorithm: 104, industry: 52 });
  assert.deepEqual(allocateQuotas({ technique: 1, culture: 1, algorithm: 1, industry: 1 }, 3), { technique: 1, culture: 1, algorithm: 1, industry: 0 });
  for (let i = 1; i < 50; i++) assert.equal(Object.values(allocateQuotas({ technique: 251 + i, culture: 133, algorithm: 311, industry: 88 })).reduce((a, b) => a + b), 520);
});
test('519/520全部进入终评，521分类取520，单件低分院校仍被保留', () => {
  for (const n of [519, 520, 521]) {
    const rows = balancedWorks(n);
    rows[n - 1] = { ...rows[n - 1], school: '单件院校', evaluations: [evaluation(0)] };
    const plan = preliminaryPlan(rows);
    assert.equal(plan.rows.length, Math.min(n, 520));
    assert.equal(plan.rows.some(w => w.school === '单件院校'), true);
  }
});
test('港澳台和国际不计初评配额，港澳台按实际记录加入终评', () => {
  const cleaned = [...balancedWorks(), work('h', 'culture', '香港特别行政区'), work('i', 'vision', '国外')];
  const p = preliminaryPlan(cleaned); assert.equal(p.rows.length, 400);
  const f = finalScoringPlan(cleaned, p.rows);
  assert.equal(f.rows.length, 401); assert.equal(f.summary.hkMacauTaiwanCount, 1);
  assert.equal(f.rows.find(w => w._id === 'h').directExhibition, true);
  assert.ok(f.rows.every(w => w.evaluations.length === 0));
});
test('取消资格不可进入下阶段，已生成副本也由原作品资格过滤', () => {
  const clean = balancedWorks(440);
  const preliminary = preliminaryPlan(clean).rows;
  clean[0].qualification = false;
  assert.equal(finalScoringPlan(clean, preliminary).rows.some(w => w._id === '0'), false);
  clean.forEach(w => w.evaluations.push({ expertCode: 'veto', disqualify: true }));
  assert.throws(() => preliminaryPlan(clean), /缺|无法满足/);
});
test('院校选择包含低分单件院校，并严格保持分类名额', () => {
  const rows = rankWorks([work('a', 'technique', '甲', 10), work('b', 'technique', '甲', 9), work('c', 'technique', '乙', 1)]);
  const plan = selectWithSchoolMinimum(rows, { technique: 2, culture: 0, algorithm: 0, industry: 0 }, ['甲测试院校', '乙测试院校']);
  assert.deepEqual(plan.selected.map(w => w._id).sort(), ['a', 'c']);
});
test('院校约束与穷举最高总分对比，覆盖跨类别联动替换和不可行组合', () => {
  let seed = 23;
  const rnd = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
  for (let sample = 0; sample < 80; sample++) {
    const rows = rankWorks(Array.from({ length: 8 }, (_, i) => work(i, i < 4 ? 'technique' : 'culture', ['甲', '乙', '丙'][rnd(3)], rnd(11))));
    let best = -Infinity;
    for (let mask = 0; mask < 256; mask++) {
      const selected = rows.filter((_, i) => mask & (1 << i));
      if (selected.length !== 4 || selected.filter(w => w.categoryKey === 'technique').length !== 2 || ['甲', '乙', '丙'].some(p => !selected.some(w => w.provinceKey === p))) continue;
      best = Math.max(best, selected.reduce((s, w) => s + w.totalScore, 0));
    }
    const run = () => selectWithSchoolMinimum(rows, { technique: 2, culture: 2, algorithm: 0, industry: 0 }, ['甲测试院校', '乙测试院校', '丙测试院校']);
    if (!Number.isFinite(best)) assert.throws(run);
    else assert.equal(run().selected.reduce((s, w) => s + w.totalScore, 0), best);
  }
});
test('完整终评320件：港澳台占对应名额，每校至少1件，评奖仅展出名单', () => {
  const clean = [];
  for (const category of rules.CATEGORY_ORDER) for (let i = 0; i < 150; i++) clean.push(work(`${category}${i}`, category, i % 2 ? '江西省' : '青海省', 5 + i % 6));
  clean.push(work('hmt', 'technique', '香港', 10));
  const plan = finalResultsPlan(clean, clean);
  assert.equal(plan.rows.length, 320); assert.equal(plan.summary.quotas.technique, 99);
  for (const key of rules.CATEGORY_ORDER) assert.equal(plan.rows.filter(w => w.categoryKey === key).length, rules.EXHIBITION_QUOTAS[key]);
  assert.ok(plan.summary.schoolCounts.every(row => row.count >= 1));
  assert.equal(plan.summary.coveredSchoolCount, 3);
  assert.ok(plan.rows.find(w => w._id === 'hmt').awardRank > 0);
  assert.ok(plan.rows.every(w => w.status === undefined));
});
test('缺少院校候选时明确失败，无自动调剂', () => {
  const rows = rankWorks([work('a')]);
  assert.throws(() => selectWithSchoolMinimum(rows, { technique: 1, culture: 0, algorithm: 0, industry: 0 }, ['江西测试院校', '缺失院校']), /缺失院校/);
});
test('导出没有自动奖项，无分数记录不变成0分', () => {
  const csv = makeCsv(rankWorks([work('a', 'technique', '江西', null), work('b')]));
  assert.ok(csv.includes('未评分')); assert.ok(!csv.includes('一等奖')); assert.ok(!csv.includes('优秀奖'));
});
// A serialized in-memory transaction model; no SDK/network calls are permitted.
function mockCloud(initial) {
  const data = structuredClone(initial); let lock = Promise.resolve();
  const db = { collection(name) {
    if (!data[name]) data[name] = [];
    let predicate = () => true, skip = 0, limit = Infinity;
    const query = {
      where(filter) { predicate = row => Object.entries(filter).every(([k, v]) => row[k] === v); return query; },
      field() { return query; },
      orderBy() { return query; }, skip(n) { skip = n; return query; }, limit(n) { limit = n; return query; },
      async get() { return { data: structuredClone(data[name].filter(predicate).slice(skip, skip + limit)) }; },
      async add({ data: row }) { const _id = 'mock-' + data[name].length; data[name].push({ ...structuredClone(row), _id }); return { _id }; },
      doc(id) { return {
        async get() { return { data: structuredClone(data[name].find(r => r._id === id)) }; },
        async update({ data: patch }) { const row = data[name].find(r => r._id === id); if (!row) throw Error('missing'); Object.assign(row, structuredClone(patch)); return { stats: { updated: 1 } }; },
        async set({ data: row }) { const i = data[name].findIndex(r => r._id === id); if (i >= 0) data[name][i] = { ...structuredClone(row), _id: id }; else data[name].push({ ...structuredClone(row), _id: id }); },
        async remove() { data[name] = data[name].filter(r => r._id !== id); }
      }; }
    }; return query;
  }, runTransaction(callback) { const run = lock.then(() => callback(db)); lock = run.catch(() => {}); return run; } };
  return { data, db, cloud: { init() {}, DYNAMIC_CURRENT_ENV: 'mock', database: () => db } };
}
function loadFunction(relative, cloud) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const localRequire = createRequire(filename), module = { exports: {} }; cache.set(filename, module);
    const safeRequire = name => {
      if (name === 'wx-server-sdk') return cloud;
      if (name.startsWith('.')) return load(localRequire.resolve(name));
      if (name.startsWith('node:') || ['crypto'].includes(name)) return localRequire(name);
      throw Error('测试禁止加载真实外部依赖：' + name);
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: safeRequire, console, Date, Buffer }, { filename });
    return module.exports;
  }
  return load(path.join(root, relative)).main;
}
test('真实评分入口使用模拟事务：并发不丢评分，取消后阻止提交和列表展示', async () => {
  const mock = mockCloud({ experts: [{ _id: 'e1', expertCode: 'e1', status: 'active', expertType: 'preliminary' }, { _id: 'e2', expertCode: 'e2', status: 'active', expertType: 'preliminary' }], pottery_submissions_clean_2026: [work('a', 'technique', '江西', null)] });
  const main = loadFunction('cloudfunctions/quickstartFunctions/submitExpertScore/index.js', mock.cloud);
  const event = { submissionId: 'a', editionId: 'pottery-2026', scores: { themeFit: 3, creativity: 2, craftsmanship: 1.5, aesthetics: 1 } };
  const results = await Promise.all(['e1', 'e2'].map(id => main({ ...event, expertId: id, expertCode: id })));
  assert.ok(results.every(r => r.success)); assert.equal(mock.data.pottery_submissions_clean_2026[0].evaluations.length, 2);
  assert.equal((await main({ ...event, expertId: 'e1', expertCode: 'e1', disqualify: true })).success, true);
  assert.equal((await main({ ...event, expertId: 'e2', expertCode: 'e2' })).success, false);
  const list = loadFunction('cloudfunctions/quickstartFunctions/fetchSubmissionsForEvaluation/index.js', mock.cloud);
  assert.equal((await list({ expertCode: 'e2' })).statistics.total, 0);
});
test('各生成入口在dryRun时不修改模拟数据，也不触碰旧届集合', async () => {
  const mock = mockCloud({ pottery_submissions_clean_2026: balancedWorks(), pottery_submissions_clean: [work('old')], pottery_submissions_preliminary_2026: [] });
  const main = loadFunction('cloudfunctions/quickstartFunctions/generatePreliminaryTable/index.js', mock.cloud);
  const result = await main({ editionId: 'pottery-2026', dryRun: true });
  assert.equal(result.success, true); assert.equal(mock.data.pottery_submissions_preliminary_2026.length, 0);
  assert.equal(mock.data.pottery_submissions_clean[0]._id, 'old');
});
test('真实生成入口的完整模拟流程：初评520、终评加入港澳台、最终320、人工奖项保留', async () => {
  const clean = [];
  for (const category of rules.CATEGORY_ORDER) for (let i = 0; i < 160; i++) clean.push(work(`${category}-${i}`, category, i % 3 ? '江西' : '青海', 5 + i % 6));
  clean.push(work('hmt', 'culture', '台湾', null));
  const mock = mockCloud({ pottery_submissions_clean_2026: clean, pottery_submissions_final: [work('old')] });
  const run = name => loadFunction(`cloudfunctions/quickstartFunctions/${name}/index.js`, mock.cloud);
  const preliminary = await run('generatePreliminaryTable')({ editionId: 'pottery-2026' });
  assert.equal(preliminary.success, true); assert.equal(preliminary.data.totalCount, 520);
  const final = await run('startFinalEvaluation')({ editionId: 'pottery-2026' });
  assert.equal(final.success, true); assert.equal(final.data.totalCount, 521);
  mock.data.pottery_submissions_for_final_2026.forEach((w, i) => { w.evaluations = [evaluation(5 + i % 6)]; });
  const result = await run('generateFinalRanking')({ editionId: 'pottery-2026' });
  assert.equal(result.success, true, result.message); assert.equal(result.data.totalCount, 320);
  const winner = mock.data.pottery_submissions_final_2026[0]; winner.status = '卓越创作奖'; winner.awardCertificate = 'synthetic-certificate';
  assert.equal((await run('generateFinalRanking')({ editionId: 'pottery-2026' })).success, true);
  assert.equal(mock.data.pottery_submissions_final_2026.find(w => w._id === winner._id).status, '卓越创作奖');
  assert.equal(mock.data.pottery_submissions_final[0]._id, 'old');
  assert.equal((await run('startFinalEvaluation')({ editionId: 'pottery-2026' })).success, false);
});
test('终评取消资格同步原作品；陈旧页面继续评分被拒绝', async () => {
  const mock = mockCloud({ experts: [{ _id: 'e1', expertCode: 'e1', expertType: 'final', status: 'active' }], pottery_submissions_clean_2026: [work('a')], pottery_submissions_for_final_2026: [work('a')] });
  const main = loadFunction('cloudfunctions/submitExpertScore/index.js', mock.cloud);
  const event = { submissionId: 'a', expertId: 'e1', expertCode: 'e1', disqualify: true };
  assert.equal((await main(event)).success, true);
  assert.equal(mock.data.pottery_submissions_clean_2026[0].qualification, false);
  assert.equal(mock.data.pottery_submissions_for_final_2026[0].qualification, false);
  assert.equal((await main({ ...event, disqualify: false, scores: { themeFit: 3, creativity: 3, craftsmanship: 2, aesthetics: 2 } })).success, false);
  const details = loadFunction('cloudfunctions/fetchSubmissionDetail/index.js', mock.cloud);
  assert.equal((await details(event, {})).success, false);
});
test('管理员执行入口运行真实处理器的模拟版本，拒绝重复与跨届确认', async () => {
  const { hashConfirmationCode } = require(base + 'adminOperation');
  const operationId = 'op1', operationName = 'generatePreliminaryTable', editionId = 'pottery-2026';
  const mock = mockCloud({
    admin: [{ _id: 'admin1', account: 'admin' }], pottery_submissions_clean_2026: balancedWorks(),
    operation_logs: [
      { _id: 'b', operationId, operationName, editionId, state: 'BACKED_UP', backupId: 'backup', createdBy: 'admin' },
      { _id: 'c', operationId, operationName, editionId, state: 'CONFIRMED', confirmationHash: hashConfirmationCode('123456'), confirmationIssuedAt: Date.now(), createdBy: 'admin' }
    ]
  });
  const main = loadFunction('cloudfunctions/quickstartFunctions/manageAdminOperation/index.js', mock.cloud);
  const event = { action: 'execute', operationId, operationName, editionId, passphrase: editionId, confirmationCode: '123456', admin: { id: 'admin1', account: 'admin' } };
  const result = await main(event);
  assert.equal(result.success, true, result.errMsg); assert.equal(result.data.state, 'SUCCEEDED', result.data.message);
  assert.equal(mock.data.pottery_submissions_preliminary_2026.length, 400);
  assert.equal((await main(event)).data.state, 'SUCCEEDED');
  assert.equal((await main({ ...event, operationName: 'generateFinalRanking' })).success, false);
  assert.equal((await main({ ...event, editionId: 'pottery-2025', passphrase: 'pottery-2025' })).success, false);
});
test('类别入口返回的本届待评作品可直接读取详情，初评终评均不读取旧届同ID作品', async () => {
  for (const expertType of ['preliminary', 'final']) {
    const rows = rules.CATEGORY_ORDER.flatMap(category => Array.from({ length: 7 }, (_, i) => ({
      ...work(`${category}-${i}`, category, '江西', null), artworkName: `本届-${category}-${i}`
    })));
    const oldRows = rows.map(row => ({ ...row, artworkName: '旧届作品' }));
    const mock = mockCloud({
      experts: [{ _id: 'e1', expertCode: 'e1', expertType, status: 'active', editionId: 'pottery-2026' }],
      pottery_submissions_clean_2026: rows, pottery_submissions_for_final_2026: rows,
      pottery_submissions_clean: oldRows, pottery_submissions_for_final: oldRows
    });
    const list = loadFunction('cloudfunctions/fetchSubmissionsForEvaluation/index.js', mock.cloud);
    const detail = loadFunction('cloudfunctions/fetchSubmissionDetail/index.js', mock.cloud);
    const before = JSON.stringify(mock.data);
    for (const category of rules.CATEGORY_ORDER) {
      const event = { expertCode: 'e1', expertId: 'e1', editionId: 'pottery-2026', category };
      const response = await list(event);
      assert.equal(response.success, true, response.message);
      assert.equal(response.data.length, 5);
      assert.ok(response.data.every(row => row.category === category));
      const first = response.data[0];
      const result = await detail({ ...event, submissionId: first.id }, {});
      assert.equal(result.success, true, result.message);
      assert.equal(result.data.id, first.id);
      assert.equal(result.data.category, category);
      assert.equal(result.data.title, `本届-${first.id}`);
      assert.equal(result.data.existingScores.themeFit, null);
    }
    // Mock queries lazily create absent configuration collections; business rows stay unchanged.
    const original = JSON.parse(before);
    for (const name of Object.keys(original)) assert.deepEqual(mock.data[name], original[name]);
  }
});

test('列表、详情独立部署包相对依赖均留在自身目录', () => {
  for (const fn of ['submitExpertScore', 'fetchSubmissionsForEvaluation', 'fetchSubmissionDetail']) {
    const directory = path.join(root, 'cloudfunctions', fn);
    for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.js'))) {
      const source = fs.readFileSync(path.join(directory, name), 'utf8');
      for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        const target = createRequire(path.join(directory, name)).resolve(match[1]);
        assert.ok(target.startsWith(directory + path.sep), `${fn}/${name} 引用了部署包外文件`);
      }
    }
  }
});
test('评分页数字选择保留0与1.5，未选择时不能提交', () => {
  let page;
  const filename = path.join(root, 'miniprogram/pages/expert-scoring/index.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { getApp: () => ({}), Page: value => { page = value; }, require: createRequire(filename), console });
  page.setData = patch => {
    for (const [key, value] of Object.entries(patch)) {
      const keys = key.split('.'); let obj = page.data;
      for (const part of keys.slice(0, -1)) obj = obj[part];
      obj[keys.at(-1)] = value;
    }
  };
  // The real page activates this guard in onLoad; explicitly model an active,
  // not-yet-scored page instead of relying on the UI's current default scores.
  page._isPageActive = true;
  page.data.scores = { themeFit: null, creativity: null, craftsmanship: null, aesthetics: null };
  page.onScoreSelect({ currentTarget: { dataset: { field: 'craftsmanship', score: '1.5' } } });
  assert.equal(page.data.scores.craftsmanship, 1.5);
  page.onScoreSelect({ currentTarget: { dataset: { field: 'themeFit', score: '0' } } });
  assert.equal(page.data.scores.themeFit, 0);
  assert.equal(page.data.scores.creativity, null);
});
test('真实导出入口只导出最终入选作品，保留人工奖项并兼容下载返回字段', async () => {
  const clean = [work('a'), work('b'), work('h', 'technique', '香港')];
  const mock = mockCloud({ pottery_submissions_clean_2026: clean, pottery_submissions_for_final_2026: clean, pottery_submissions_final_2026: [{ ...clean[0], status: '卓越创作奖' }, clean[2]] });
  let csv = '';
  mock.cloud.uploadFile = async ({ fileContent }) => { csv = fileContent.toString('utf8'); return { fileID: 'mock-file' }; };
  mock.cloud.getTempFileURL = async () => ({ fileList: [{ tempFileURL: 'mock-download' }] });
  const main = loadFunction('cloudfunctions/quickstartFunctions/exportFinalResults/index.js', mock.cloud);
  const result = await main({ editionId: 'pottery-2026', sourceKey: 'finalResults' });
  assert.equal(result.success, true, result.message); assert.equal(result.recordCount, 2);
  assert.equal(result.downloadUrl, 'mock-file'); assert.ok(csv.includes('卓越创作奖'));
  assert.ok(!csv.includes('一等奖')); assert.ok(!csv.includes('"b"'));
});
test('后导入的港澳台未进入终评任务时阻止生成遗漏名单', () => {
  const cleaned = [work('a'), work('h', 'technique', '香港')];
  assert.throws(() => finalResultsPlan(cleaned, [cleaned[0]]), /港澳台作品尚未加入/);
});

test('按类别返回5件、类别统计独立，首页只取统计，无效类别拒绝', async () => {
  const rows = Array.from({ length: 125 }, (_, i) => work('t' + i, 'technique', '江西', null));
  rows.push(work('culture', 'culture', '江西', null), work('digital', 'algorithm', '江西', null), work('industry', 'industry', '江西', null), work('hmt', 'technique', '香港', null));
  const mock = mockCloud({ experts: [{ _id: 'e', expertCode: 'e', status: 'active', expertType: 'preliminary' }], pottery_submissions_clean_2026: rows });
  const main = loadFunction('cloudfunctions/fetchSubmissionsForEvaluation/index.js', mock.cloud);
  const summary = await main({ expertCode: 'e', summaryOnly: true });
  assert.equal(summary.success, true); assert.equal(summary.data.length, 0); assert.equal(summary.categories.length, 4);
  assert.equal(summary.categories.find(c => c.key === 'technique').total, 125);
  for (let round = 0; round < 25; round++) {
    const result = await main({ expertCode: 'e', category: 'technique' });
    assert.equal(result.data.length, 5); assert.ok(result.data.every(w => w.category === 'technique'));
    for (const row of result.data) mock.data.pottery_submissions_clean_2026.find(w => w._id === row.id).evaluations.push({ expertCode: 'e' });
  }
  const done = await main({ expertCode: 'e', category: 'technique' });
  assert.equal(done.data.length, 0); assert.equal(done.statistics.evaluated, 125);
  assert.equal(done.categories.find(c => c.key === 'culture').unevaluated, 1);
  assert.equal((await main({ expertCode: 'e', category: 'vision' })).success, false);
});
