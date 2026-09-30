// All records are synthetic; the VM loader rejects the real SDK and network modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { createOfflineCloud, loadOfflineFunction } = require('./helpers/offlineEvaluationCloud');
const { calculateTotalRubric } = require('../cloudfunctions/quickstartFunctions/common/evaluationRubric');
const { aggregateEvaluations, compareWorks } = require('../cloudfunctions/quickstartFunctions/common/evaluationRanking');
const { preliminaryPlan } = require('../cloudfunctions/quickstartFunctions/common/evaluationPipeline');
const raw = 'pottery_submissions_2026', clean = 'pottery_submissions_clean_2026';
function fixture(count = 40) {
  const expert = { _id: 'judge', expertCode: 'code', status: 'active', expertType: 'preliminary', pledgeSigned: true, pledgeSignTime: '2026-09-01' };
  const rows = Array.from({ length: count }, (_, i) => ({ _id: 'work-' + i, category: 'technique', school: '虚拟院校', schoolProvinces: '江西', perspectiveImage: 'cloud://offline/' + i, evaluations: [] }));
  const mock = createOfflineCloud({ [raw]: [{ _id: 'protected', value: '虚拟原始数据' }], [clean]: rows, experts: [expert] }, [clean, 'experts']);
  const load = name => loadOfflineFunction(path.resolve('cloudfunctions/quickstartFunctions', name, 'index.js'), mock.cloud);
  const call = event => load('reviewOrientation')({ expertId: 'judge', expertCode: 'code', ...event });
  return { mock, call, load };
}
test('总分101档、非法输入及逐评委扣分', () => {
  for (let i = 0; i <= 100; i++) assert.equal(calculateTotalRubric(i / 10).ok, true);
  for (const value of [undefined, null, '8', NaN, Infinity, -0.1, 10.1, 0.01]) assert.equal(calculateTotalRubric(value).ok, false);
  assert.equal(calculateTotalRubric(8.6, { aiNotLabeled: true, missingCreativeStatement: true }).finalScore, 5.6);
  assert.equal(calculateTotalRubric(0, { aiNotLabeled: true }).finalScore, 0);
});
test('缺评分忽略、去最高最低、零分有效、同分不比较旧维度', () => {
  const scores = values => values.map((finalScore, i) => ({ expertCode: String(i), finalScore }));
  assert.equal(aggregateEvaluations([]).totalScore, null);
  assert.equal(aggregateEvaluations(scores([0])).totalScore, 0);
  assert.equal(aggregateEvaluations(scores([0, 10])).totalScore, 5);
  assert.equal(aggregateEvaluations(scores([0, 6, 8, 10])).totalScore, 7);
  assert.equal(compareWorks({ totalScore: 8, themeFitTotal: 3 }, { totalScore: 8, themeFitTotal: 0 }), 0);
});
test('预览身份校验、并发初始化、未看完阻止评分、跨阶段隔离', async () => {
  const { mock, call, load } = fixture();
  assert.equal((await call({ expertCode: 'wrong' })).success, false);
  const [a, b] = await Promise.all([call({}), call({})]);
  assert.equal(a.data.sessionId, b.data.sessionId);
  const sessionId = a.data.sessionId;
  assert.equal((await call({ action: 'complete', sessionId })).success, false);
  assert.equal((await call({ action: 'viewed', sessionId, viewedIds: ['foreign'] })).success, false);
  const score = { expertId: 'judge', expertCode: 'code', submissionId: 'work-0', baseScore: 0 };
  assert.equal((await load('submitExpertScore')(score)).success, false);
  const seen = new Set();
  for (let batchIndex = 0; batchIndex < 5; batchIndex++) {
    const result = await call({ batchIndex });
    assert.equal(result.data.batch.length, 6);
    result.data.batch.forEach(w => { seen.add(w.id); assert.match(w.thumbnail, /thumbnail\/320x/); });
    const event = { action: 'viewed', sessionId, viewedIds: result.data.batch.map(w => w.id) };
    await Promise.all([call(event), call(event)]);
  }
  assert.equal(seen.size, 30);
  assert.equal((await call({ action: 'complete', sessionId })).success, true);
  assert.equal((await call({ action: 'status' })).data.completed, true);
  assert.equal((await load('submitExpertScore')(score)).success, true);
  assert.equal(mock.data[clean][0].evaluations[0].finalScore, 0);
  mock.data.experts[0].expertType = 'final';
  assert.equal((await call({ action: 'status' })).data.completed, false);
  mock.data.experts[0].expertType = 'preliminary';
  mock.data.experts[0].pledgeSignTime = '2026-09-02';
  assert.equal((await call({ action: 'status' })).data.completed, false);
  assert.equal(mock.attemptedWrites.some(w => w.collection === raw), false);
});
test('不足30按实际数量；取消资格和境外作品排除；零图片阻止进入', async () => {
  const { mock, call } = fixture(5);
  mock.data[clean][0].qualification = false;
  mock.data[clean][1].schoolProvinces = '香港';
  mock.data[clean][2].category = 'vision';
  assert.equal((await call({})).data.total, 2);
  assert.equal((await fixture(0).call({})).success, false);
});
test('名额边界必须确认，过期确认与重复选择被拒绝', () => {
  const rows = Array.from({ length: 600 }, (_, i) => ({ _id: String(i), category: ['technique','culture','algorithm','industry'][i % 4], school: '模拟院校', schoolProvinces: '江西', evaluations: [{ expertCode: 'judge', finalScore: 8 }] }));
  let details;
  assert.throws(() => preliminaryPlan(rows), error => { details = error.details; return error.code === 'TIE_CONFIRMATION_REQUIRED'; });
  const resolution = { fingerprint: details.fingerprint, selectedIds: details.selectedIds };
  assert.equal(preliminaryPlan(rows, resolution).rows.length, 520);
  assert.throws(() => preliminaryPlan(rows, { ...resolution, fingerprint: 'expired' }));
  assert.throws(() => preliminaryPlan(rows, { ...resolution, selectedIds: Array(520).fill('0') }));
});
test('图片加载与进入视口缺一不可，页面退出释放观察器', async () => {
  let page, calls = 0, disconnected = 0;
  vm.runInNewContext(fs.readFileSync(path.resolve('miniprogram/pages/expert-orientation/index.js'), 'utf8'), { Page: value => { page = value; }, require: () => [], wx: {} });
  page.data = { batch: [{ id: 'a', ordinal: 1, viewed: false }], sessionId: 'session', batchIndex: 0 };
  page._alive = page._visible = true; page._loaded = new Set(); page._seen = new Set(); page._observers = [];
  page.setData = patch => Object.assign(page.data, patch);
  page.call = async () => { calls++; return { viewedCount: 1, total: 1 }; };
  page._loaded.add('a'); await page.acknowledge(); assert.equal(calls, 0);
  page._loaded.clear(); page._seen.add('a'); await page.acknowledge(); assert.equal(calls, 0);
  page._loaded.add('a'); await page.acknowledge(); assert.equal(calls, 1); assert.equal(page.data.allViewed, true);
  page._observers = [{ disconnect() { disconnected++; } }]; page.onUnload();
  assert.equal(disconnected, 1); assert.equal(page._alive, false);
});
test('原始表写入保护拒绝修改且内容不变', async () => {
  const { mock } = fixture();
  const before = JSON.stringify(mock.data[raw]);
  await assert.rejects(mock.db.collection(raw).doc('protected').update({ data: { value: '禁止写入' } }));
  assert.equal(JSON.stringify(mock.data[raw]), before);
});
test('提交遇事务冲突重新读取后重试，其他错误不重试', async () => {
  const { mock, load } = fixture();
  mock.data.experts[0].reviewOrientations = { 'pottery-2026_preliminary': {
    version: 'orientation-total-v1', pledgeStamp: JSON.stringify('2026-09-01'), completedAt: 1
  } };
  const transaction = mock.db.runTransaction.bind(mock.db); let attempts = 0;
  mock.db.runTransaction = callback => {
    attempts++;
    if (attempts <= 2) return Promise.reject(new Error('ResourceUnavailable.TransactionConflict'));
    return transaction(callback);
  };
  const event = { expertId: 'judge', expertCode: 'code', submissionId: 'work-0', baseScore: 8.1 };
  assert.equal((await load('submitExpertScore')(event)).success, true);
  assert.equal(attempts, 3); assert.equal(mock.data[clean][0].evaluations.length, 1);
  attempts = 0;
  mock.db.runTransaction = () => { attempts++; return Promise.reject(new Error('PERMISSION_DENIED')); };
  assert.equal((await load('submitExpertScore')(event)).success, false);
  assert.equal(attempts, 1);
});
