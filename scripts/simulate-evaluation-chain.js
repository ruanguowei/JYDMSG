// Fully offline: runs real handlers with an in-memory SDK. Never imports a real SDK.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createOfflineCloud, loadOfflineFunction } = require('../tests/helpers/offlineEvaluationCloud');
const rules = require('../cloudfunctions/quickstartFunctions/common/evaluationRules');
const root = path.resolve(__dirname, '..');
const tables = {
  raw: 'pottery_submissions_2026', cleaned: 'pottery_submissions_clean_2026',
  preliminary: 'pottery_submissions_preliminary_2026', scoring: 'pottery_submissions_for_final_2026',
  final: 'pottery_submissions_final_2026'
};
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone = value => structuredClone(value);
const stageCounts = rows => Object.fromEntries(rules.CATEGORY_ORDER.map(key => [key, rows.filter(w => rules.normalizeCategory(w.category).key === key).length]));

function syntheticSubmissions() {
  const rows = [];
  function add(id, category, school, province, extra = {}) {
    const row = { _id: id, name: `模拟作者-${id}`, idNumber: `SIM-${id}`, school, schoolProvinces: province,
      category, artworkName: `模拟作品-${id}`, qualification: true, createdAt: 1, updatedAt: 2, workType: 'image', perspectiveImage: `cloud://offline/${id}.jpg`, ...extra };
    rows.push(row); return row;
  }
  rules.CATEGORY_ORDER.forEach((category, c) => {
    for (let i = 0; i < 200; i++) add(`${category}-${i}`, category, i === 199 ? `单件零分院校-${category}` : `模拟院校-${(i + c * 17) % 120}`, i % 2 ? '江西' : '青海', { simulationIndex: i, simulationRare: i === 199 });
    for (let j = 0; j < 2; j++) add(`hmt-${c}-${j}`, category, `港澳台模拟院校-${c}-${j}`, ['香港', '澳门', '台湾'][c % 3]);
  });
  for (let i = 0; i < 30; i++) add(`international-${i}`, 'vision', `国际模拟院校-${i}`, '国外');
  for (let i = 0; i < 8; i++) rows.push({ ...clone(rows[i]), _id: `duplicate-old-${i}`, updatedAt: 0 });
  for (let i = 0; i < 4; i++) add(`ineligible-${i}`, 'technique', '模拟院校-0', '江西', { qualification: false });
  return rows;
}

function independentAverage(work) {
  const fields = ['finalScore'];
  const records = (work.evaluations || []).filter(e => !e.disqualify).slice().sort((a, b) => a.finalScore - b.finalScore || a.expertCode.localeCompare(b.expertCode));
  const retained = records.length >= 3 ? records.slice(1, -1) : records;
  return fields.map(field => retained.length ? retained.reduce((sum, e) => sum + e[field], 0) / retained.length : null);
}

async function runSimulation(options = {}) {
  const outputDir = path.resolve(options.outputDir || path.join(root, 'outputs/evaluation-simulation', new Date().toISOString().replace(/[:.]/g, '-')));
  const functionDir = path.resolve(options.functionDir || path.join(root, 'cloudfunctions/quickstartFunctions'));
  const raw = options.input ? JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8').replace(/^\uFEFF/, '')) : syntheticSubmissions();
  assert.ok(Array.isArray(raw) && raw.length, '输入必须是非空JSON数组');
  assert.ok(raw.every(w => w._id) && new Set(raw.map(w => w._id)).size === raw.length, '原始记录编号必须存在且唯一');
  fs.mkdirSync(outputDir, { recursive: true });
  const report = { status: 'RUNNING', mode: 'OFFLINE_ONLY', synthetic: !options.input, functionDir, steps: [], checks: [], scoring: {}, startedAt: new Date().toISOString() };
  const check = (ok, message) => { assert.ok(ok, message); report.checks.push(message); };
  const save = (file, value) => fs.writeFileSync(path.join(outputDir, file), JSON.stringify(value, null, 2));
  const experts = ['preliminary', 'final'].flatMap(type => Array.from({ length: type === 'preliminary' ? 7 : 11 }, (_, i) => ({
    _id: `${type}-${i}`, expertCode: `${type}-${i}`, expertName: `模拟${type === 'preliminary' ? '初评' : '终评'}专家${i + 1}`, expertType: type, status: 'active', editionId: 'pottery-2026', pledgeSigned: true, pledgeSignTime: '2026-09-01'
  })));
  const legacy = { pottery_submissions: [{ _id: 'legacy-raw', school: '旧届保留数据' }], pottery_submissions_final: [{ _id: 'legacy-final', status: '旧届奖项' }] };
  const mock = createOfflineCloud({ [tables.raw]: raw, experts, ...legacy }, [tables.cleaned, tables.preliminary, tables.scoring, tables.final, 'experts', 'operation_logs', 'data_backups']);
  const rawHash = digest(mock.data[tables.raw]), legacyHash = digest(legacy);
  const run = name => loadOfflineFunction(path.join(functionDir, name, 'index.js'), mock.cloud);
  // The mini program submits scores to this standalone function, not the old aggregate route.
  const submit = loadOfflineFunction(path.join(root, 'cloudfunctions/submitExpertScore/index.js'), mock.cloud);
  async function rankWithConfirmation(name) {
    const event = { editionId: 'pottery-2026' };
    let result = await run(name)(event);
    if (result.code === 'TIE_CONFIRMATION_REQUIRED') {
      const before = digest([mock.data[tables.cleaned], mock.data[tables.preliminary], mock.data[tables.scoring], mock.data[tables.final]]);
      const tieResolution = { fingerprint: result.details.fingerprint, selectedIds: result.details.selectedIds };
      const preview = await run(name)({ ...event, dryRun: true, tieResolution });
      assert.equal(preview.success, true, preview.message);
      assert.equal(digest([mock.data[tables.cleaned], mock.data[tables.preliminary], mock.data[tables.scoring], mock.data[tables.final]]), before);
      report.checks.push(name + '同分边界经模拟管理员确认，预览不改业务表');
      result = await run(name)({ ...event, tieResolution });
    }
    return result;
  }
  async function step(name, action, table, file) {
    const started = Date.now();
    const result = await action();
    check(result.success, `${name}成功：${result.message || ''}`);
    const rows = mock.data[table];
    report.steps.push({ name, count: rows.length, categoryCounts: stageCounts(rows), durationMs: Date.now() - started, summary: result.data || {} });
    save(file, rows);
    return result;
  }
  async function scorePhase(type, table, cancelIds = []) {
    const judges = experts.filter(e => e.expertType === type);
    for (const judge of judges) {
      const identity = { expertId: judge._id, expertCode: judge.expertCode, editionId: 'pottery-2026' };
      const preview = run('reviewOrientation');
      const first = await preview(identity);
      assert.equal(first.success, true, first.message);
      assert.equal(first.data.total, 30);
      const ids = new Set();
      for (let batchIndex = 0; batchIndex < 5; batchIndex++) {
        const batch = await preview({ ...identity, batchIndex });
        assert.equal(batch.data.batch.length, 6);
        batch.data.batch.forEach(w => { assert.ok(w.thumbnail); ids.add(w.id); });
        const viewed = await preview({ ...identity, action: 'viewed', sessionId: first.data.sessionId, viewedIds: batch.data.batch.map(w => w.id) });
        assert.equal(viewed.success, true, viewed.message);
      }
      assert.equal(ids.size, 30);
      assert.equal((await preview({ ...identity, action: 'complete', sessionId: first.data.sessionId })).success, true);
    }
    report.checks.push(type + '全体专家完成30件分批预览');
    const rows = mock.data[table].filter(w => rules.prepareWork(w).participantGroup !== 'international' && (type === 'final' || !rules.isHmt(w)));
    const metrics = { judgeCount: judges.length, submitted: 0, intentionallyMissing: 0, cancelled: cancelIds.length };
    for (const id of cancelIds) {
      const event = { submissionId: id, expertId: judges[0]._id, expertCode: judges[0].expertCode, disqualify: true };
      assert.equal((await submit(event)).success, true);
      assert.equal((await submit({ ...event, expertId: judges[1]._id, expertCode: judges[1].expertCode, disqualify: false, scores: { themeFit: 3, creativity: 3, craftsmanship: 2, aesthetics: 2 } })).success, false);
    }
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!rules.eligible(row)) continue;
      for (let j = 0; j < judges.length; j++) {
        const noScore = !options.input && (type === 'preliminary' ? row.simulationIndex === 198 : row._id === 'hmt-0-0');
        const partial = !options.input && !row.simulationRare && ((index % 37 === 0 && j >= 1) || (index % 41 === 0 && j >= 2) || (index % 7 === 0 && j === judges.length - 1));
        if (noScore || partial) { metrics.intentionallyMissing++; continue; }
        const seed = parseInt(digest([row._id, type, j]).slice(0, 8), 16);
        const baseScore = row.simulationRare ? 0 : (seed % 101) / 10;
        const deductions = { aiNotLabeled: seed % 13 === 0, missingCreativeStatement: seed % 17 === 0 };
        const result = await submit({ submissionId: row._id, expertId: judges[j]._id, expertCode: judges[j].expertCode, baseScore, deductions, totalScore: 999, finalScore: 999 });
        assert.equal(result.success, true, result.message);
        const record = mock.data[table].find(w => w._id === row._id).evaluations.find(e => e.expertCode === judges[j].expertCode);
        const expected = Math.max(0, baseScore - (deductions.aiNotLabeled ? 2 : 0) - (deductions.missingCreativeStatement ? 1 : 0));
        assert.ok(Math.abs(record.finalScore - expected) < 1e-9, '服务端按基础总分与扣分重算，忽略伪造结果');
        metrics.submitted++;
      }
    }
    report.scoring[type] = metrics;
    return { success: true, data: metrics };
  }
  function checkResults(rows, scoresTable, quotas, label) {
    const source = new Map(mock.data[scoresTable].map(w => [w.sourceWorkId || w._id, w]));
    check(new Set(rows.map(w => w.sourceWorkId || w._id)).size === rows.length, `${label}作品无重复`);
    for (const row of rows) {
      const original = source.get(row.sourceWorkId || row._id);
      assert.ok(original && rules.eligible(original), `${label}来源与资格有效`);
      const values = independentAverage(original);
      ['totalScore'].forEach((field, i) => {
        if (values[i] === null) assert.equal(row[field], null);
        else assert.ok(Math.abs(row[field] - values[i]) < 1e-9, `${label}平均分不符：${row._id}/${field}`);
      });
    }
    report.checks.push(`${label}逐件总均分与独立计算一致`);
    assert.deepEqual(stageCounts(rows), JSON.parse(JSON.stringify(quotas)), `${label}类别数量`);
    report.checks.push(`${label}类别名额准确`);
  }
  try {
    save('01-原始报名表.json', raw);
    report.steps.push({ name: '原始报名表', count: raw.length, categoryCounts: stageCounts(raw) });
    await step('清洗', () => run('cleanSubmissionsData')({ editionId: 'pottery-2026' }), tables.cleaned, '02-清洗表.json');
    const expectedClean = new Map();
    for (const row of raw.filter(w => w.qualification !== false)) {
      const key = JSON.stringify([row.name || '', row.school || '', row.idNumber || '']);
      const previous = expectedClean.get(key);
      if (!previous || (row.updatedAt || row.createdAt || 0) > (previous.updatedAt || previous.createdAt || 0)) expectedClean.set(key, row);
    }
    check(expectedClean.size === mock.data[tables.cleaned].length, '清洗后的数量与独立去重结果一致');
    assert.deepEqual(mock.data[tables.cleaned].map(w => w._id).sort(), [...expectedClean.values()].map(w => w._id).sort());
    const initialCancel = options.input ? [] : ['technique-0', 'culture-0'];
    await step('模拟初评打分', () => scorePhase('preliminary', tables.cleaned, initialCancel), tables.cleaned, '03-初评评分表.json');
    const cleanBeforePreliminary = digest(mock.data[tables.cleaned]);
    const preliminary = await step('生成初评结果', () => rankWithConfirmation('generatePreliminaryTable'), tables.preliminary, '04-初评结果表.json');
    check(digest(mock.data[tables.cleaned]) === cleanBeforePreliminary, '生成初评结果不改动清洗表和初评分数');
    checkResults(mock.data[tables.preliminary], tables.cleaned, preliminary.data.quotas, '初评结果');
    const beforeStart = digest(mock.data[tables.preliminary]);
    await step('生成终评评分表', () => run('startFinalEvaluation')({ editionId: 'pottery-2026' }), tables.scoring, '05-终评待评分表.json');
    check(digest(mock.data[tables.preliminary]) === beforeStart, '生成终评评分表不改动初评结果');
    check(mock.data[tables.scoring].every(w => !w.evaluations.length), '终评分数独立，未沿用初评分数');
    const schoolCounts = new Map();
    mock.data[tables.scoring].forEach(w => schoolCounts.set(w.school, (schoolCounts.get(w.school) || 0) + 1));
    const finalCancel = options.input ? [] : mock.data[tables.scoring].filter(w => !w.simulationRare && !rules.isHmt(w) && schoolCounts.get(w.school) > 2).slice(0, 2).map(w => w._id);
    await step('模拟终评打分', () => scorePhase('final', tables.scoring, finalCancel), tables.scoring, '06-终评评分表.json');
    check(finalCancel.every(id => mock.data[tables.cleaned].find(w => w._id === id).qualification === false), '终评取消资格同步到清洗源记录');
    const protectedBeforeFinal = digest([mock.data[tables.cleaned], mock.data[tables.preliminary], mock.data[tables.scoring]]);
    const result = await step('生成最终结果', () => rankWithConfirmation('generateFinalRanking'), tables.final, '07-终评结果表.json');
    check(digest([mock.data[tables.cleaned], mock.data[tables.preliminary], mock.data[tables.scoring]]) === protectedBeforeFinal, '生成最终结果不改动前面三张表');
    checkResults(mock.data[tables.final], tables.scoring, rules.EXHIBITION_QUOTAS, '终评结果');
    const required = new Set(mock.data[tables.cleaned].filter(w => rules.prepareWork(w).participantGroup !== 'international').map(w => rules.normalizeSchool(w.school)));
    const actual = new Set(mock.data[tables.final].map(w => rules.normalizeSchool(w.school)));
    check([...required].every(school => actual.has(school)), '所有参评院校最终至少1件展出');
    check(result.data.schoolCount === required.size && result.data.coveredSchoolCount === required.size, '院校覆盖统计与独立核对一致');
    check(mock.data[tables.final].every(w => w.status === undefined), '没有自动授奖，获奖名额保留人工决定');
    const scoresBeforeAward = digest(mock.data[tables.scoring]);
    const award = mock.data[tables.final].find(w => w.totalScore != null);
    if (award) {
      await mock.db.collection(tables.final).doc(award._id).update({ data: { status: '卓越创作奖', awardCertificate: 'offline-certificate' } });
      check((await rankWithConfirmation('generateFinalRanking')).success, '已有人工奖项时重算成功');
      const retained = mock.data[tables.final].find(w => w._id === award._id);
      check(retained.status === '卓越创作奖' && retained.awardCertificate === 'offline-certificate', '重算保留人工奖项和证书');
    }
    const rejectStart = await run('startFinalEvaluation')({ editionId: 'pottery-2026' });
    check(!rejectStart.success && digest(mock.data[tables.scoring]) === scoresBeforeAward, '已有终评分数时禁止重建评分表');
    const beforeReclean = digest(mock.data[tables.cleaned]);
    check(!(await run('cleanSubmissionsData')({ editionId: 'pottery-2026' })).success && digest(mock.data[tables.cleaned]) === beforeReclean, '已有评分时禁止重新清洗覆盖');
    if (!options.input) {
      check(mock.data[tables.preliminary].length === 520 && mock.data[tables.scoring].length === 528 && mock.data[tables.final].length === 320, '主场景数量为初评520、终评任务528、最终320');
      check(mock.data[tables.final].filter(w => w.simulationRare).length === 4, '四所单件零分院校均获得入围保底');
      const unscoredHmt = mock.data[tables.final].find(w => w._id === 'hmt-0-0');
      check(unscoredHmt && unscoredHmt.totalScore === null && unscoredHmt.awardRank === null, '港澳台未评分仍展出，但无评奖名次');
    }
    check(digest(mock.data[tables.raw]) === rawHash && !mock.attemptedWrites.some(w => w.collection === tables.raw), '原始报名表内容与哈希不变，且从未尝试写入');
    check(digest(Object.fromEntries(Object.keys(legacy).map(key => [key, mock.data[key]]))) === legacyHash, '旧届数据保持不变');
    report.status = 'PASSED';
    report.schoolCount = required.size;
    report.writeCounts = Object.fromEntries([...new Set(mock.writes.map(w => w.collection))].map(name => [name, mock.writes.filter(w => w.collection === name).length]));
    report.rawHashBefore = rawHash; report.rawHashAfter = digest(mock.data[tables.raw]);
    save('08-人工奖项重算结果.json', mock.data[tables.final]);
  } catch (error) {
    report.status = 'FAILED'; report.error = error.stack;
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    save('report.json', report);
    const lines = ['# 评审全链路离线模拟报告', '', `结果：${report.status}`, '', '使用真实业务代码和本地内存数据库；未连接正式云环境。', '', '| 阶段 | 作品数 | 耗时毫秒 |', '|---|---:|---:|', ...report.steps.map(s => `| ${s.name} | ${s.count} | ${s.durationMs ?? '-'} |`), '', `覆盖院校：${report.schoolCount ?? '-'}所`, '', ...report.checks.map(message => `- 通过：${message}`)];
    if (report.error) lines.push('', '错误：', '```text', report.error, '```');
    lines.push('', '本报告不代表真机性能、网络故障或真实数据库并发已验证。');
    fs.writeFileSync(path.join(outputDir, 'report.md'), lines.join('\n'));
  }
  return { report, outputDir };
}

if (require.main === module) {
  const argv = process.argv.slice(2), options = {};
  const flags = { '--input': 'input', '--out': 'outputDir', '--function-dir': 'functionDir' };
  for (let i = 0; i < argv.length; i += 2) {
    if (!flags[argv[i]] || !argv[i + 1]) throw new Error('参数：--input 本地JSON（可选） --out 输出目录 --function-dir 聚合云函数目录（可选）');
    options[flags[argv[i]]] = argv[i + 1];
  }
  runSimulation(options).then(({ report, outputDir }) => console.log(JSON.stringify({ status: report.status, checks: report.checks.length, schoolCount: report.schoolCount, steps: report.steps.map(s => ({ name: s.name, count: s.count, durationMs: s.durationMs })), outputDir }, null, 2))).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { runSimulation, syntheticSubmissions };
