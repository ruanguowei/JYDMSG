const { CATEGORY_ORDER, CATEGORY_NAMES, SCHOOL_MINIMUM, normalizeSchool, eligible } = require('./evaluationRules');
const { compareWorks } = require('./evaluationRanking');
const crypto = require('crypto');

const SCORE_KEYS = ['totalScore'];
const ZERO_COST = [0];
const workId = work => work.sourceWorkId || work._id;
const totalQuota = quotas => CATEGORY_ORDER.reduce((sum, key) => sum + quotas[key], 0);
const schoolLabel = names => names.slice(0, 8).join('、') + (names.length > 8 ? `等${names.length}所院校` : '');

function countSchools(works) {
  const counts = new Map();
  for (const work of works) {
    const school = normalizeSchool(work.school);
    if (!school) throw new Error(`作品 ${work.submissionNumber || workId(work)} 未填写院校，无法核对每校至少1件`);
    counts.set(school, (counts.get(school) || 0) + 1);
  }
  return counts;
}

// Build this list BEFORE filtering qualifications/scores, otherwise a school with
// no remaining eligible work could silently disappear from the guarantee.
function requiredSchools(works) {
  return [...countSchools(works.filter(w => w.participantGroup !== 'international')).keys()].sort();
}

function validateQuotas(quotas, label) {
  for (const key of CATEGORY_ORDER) {
    if (!Number.isInteger(quotas[key]) || quotas[key] < 0) {
      throw new Error(`${CATEGORY_NAMES[key]}${label}必须是非负整数，请核对类别名额及港澳台实际数量`);
    }
  }
}

// Maximize actual total scores. Legacy dimension scores never break ties.
function lessCost(a, b) {
  if (!b) return true;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-10) return a[i] < b[i];
  }
  return false;
}

class MinCostCirculation {
  constructor() { this.graph = []; this.balance = []; }
  node() {
    this.graph.push([]);
    this.balance.push(0);
    return this.graph.length - 1;
  }
  edge(from, to, capacity, cost = ZERO_COST) {
    const forward = { to, rev: this.graph[to].length, capacity, cost };
    this.graph[from].push(forward);
    this.graph[to].push({ to: from, rev: this.graph[from].length - 1, capacity: 0, cost: cost.map(n => -n) });
    return forward;
  }
  bounded(from, to, lower, upper, cost = ZERO_COST) {
    if (lower < 0 || upper < lower) throw new Error('院校名额约束无效');
    this.balance[from] -= lower;
    this.balance[to] += lower;
    return this.edge(from, to, upper - lower, cost);
  }
  solve() {
    const originalNodes = this.graph.length;
    const source = this.node(), sink = this.node();
    let needed = 0;
    for (let v = 0; v < originalNodes; v++) {
      if (this.balance[v] > 0) {
        this.edge(source, v, this.balance[v]);
        needed += this.balance[v];
      } else if (this.balance[v] < 0) this.edge(v, sink, -this.balance[v]);
    }
    // The initial residual graph is acyclic. Shortest augmenting paths, including
    // reverse edges, allow joint exchanges across schools and categories.
    let flow = 0;
    while (flow < needed) {
      const distance = Array(this.graph.length).fill(null);
      const previous = Array(this.graph.length).fill(null);
      const inQueue = Array(this.graph.length).fill(false);
      const queue = [source];
      distance[source] = ZERO_COST;
      inQueue[source] = true;
      for (let head = 0; head < queue.length; head++) {
        const u = queue[head];
        inQueue[u] = false;
        this.graph[u].forEach((edge, index) => {
          if (edge.capacity <= 0) return;
          const next = distance[u].map((value, i) => value + edge.cost[i]);
          if (!lessCost(next, distance[edge.to])) return;
          distance[edge.to] = next;
          previous[edge.to] = [u, index];
          if (!inQueue[edge.to]) { queue.push(edge.to); inQueue[edge.to] = true; }
        });
      }
      if (!previous[sink]) throw new Error('类别名额与每校至少1件无法同时满足，未生成名单');
      let amount = needed - flow;
      for (let v = sink; v !== source;) {
        const [u, index] = previous[v];
        amount = Math.min(amount, this.graph[u][index].capacity);
        v = u;
      }
      for (let v = sink; v !== source;) {
        const [u, index] = previous[v];
        const edge = this.graph[u][index];
        edge.capacity -= amount;
        this.graph[v][edge.rev].capacity += amount;
        v = u;
      }
      flow += amount;
    }
  }
}

function assertSchoolCapacity(candidates, schools, quotas, stage) {
  const masks = new Map(schools.map(school => [school, 0]));
  for (const work of candidates) {
    const school = normalizeSchool(work.school);
    if (masks.has(school)) masks.set(school, masks.get(school) | (1 << CATEGORY_ORDER.indexOf(work.categoryKey)));
  }
  const missing = schools.filter(school => masks.get(school) === 0);
  if (missing.length) throw new Error(`${stage}：${schoolLabel(missing)}没有可用候选作品（可能未评分、已取消资格或未进入本阶段），无法满足每校至少1件`);
  // Four categories have only 15 nonempty subsets. Check all category bottlenecks,
  // including schools that can choose among several categories.
  for (let mask = 1; mask < (1 << CATEGORY_ORDER.length); mask++) {
    const keys = CATEGORY_ORDER.filter((_, index) => mask & (1 << index));
    const capacity = keys.reduce((sum, key) => sum + quotas[key], 0);
    const confined = schools.filter(school => (masks.get(school) & mask) === masks.get(school));
    if (confined.length > capacity) {
      throw new Error(`${stage}：${keys.map(key => CATEGORY_NAMES[key]).join('、')}可用终评名额${capacity}个，但有${confined.length}所院校只能从这些类别入围，至少缺${confined.length - capacity}个名额（${schoolLabel(confined)}）`);
    }
  }
}

/**
 * Choose Q[k] works and guarantee a final subset of F[k] works covering schools.
 * One representative per uncovered school goes to a school demand node.
 * Other selected works go to their own category's extra node, with lower bound
 * Q[k] - F[k]. Thus at most F[k] representatives may use category k. Since
 * Q[k] >= F[k], representatives can always be filled out to a final F[k] list.
 * This jointly optimizes all Q works, without first locking in school winners.
 * HMT-covered schools need no domestic representative.
 */
function selectWithSchoolMinimum(works, quotas, schools, options = {}) {
  const { coveredWorks = [], exhibitionQuotas = quotas, allowUnscored = false, stage = '终评' } = options;
  validateQuotas(quotas, '入选名额');
  validateQuotas(exhibitionQuotas, '普通作品终评名额');
  const candidates = works.filter(w => eligible(w) && (allowUnscored || w.totalScore != null));
  if (candidates.some(w => !CATEGORY_ORDER.includes(w.categoryKey))) throw new Error('候选作品类别不在四个参评类别内');
  if (candidates.some(w => !workId(w)) || new Set(candidates.map(workId)).size !== candidates.length) throw new Error('候选作品缺少来源编号或重复，不能重复占用名额');
  countSchools(candidates);
  const directWorks = coveredWorks.filter(eligible);
  const allIds = [...candidates, ...directWorks].map(workId);
  if (allIds.some(id => !id) || new Set(allIds).size !== allIds.length) throw new Error('直接展出作品与候选作品的来源编号缺失或重复');
  const covered = countSchools(directWorks);
  const schoolNames = [...new Set(schools.map(normalizeSchool))].sort();
  if (schoolNames.some(school => !school)) throw new Error('院校名单包含空名称，无法核对院校保底');
  const uncovered = schoolNames.filter(school => (covered.get(school) || 0) < SCHOOL_MINIMUM);
  for (const key of CATEGORY_ORDER) {
    if (quotas[key] < exhibitionQuotas[key]) {
      throw new Error(`${stage}：${CATEGORY_NAMES[key]}进入终评仅${quotas[key]}件，终评普通作品名额${exhibitionQuotas[key]}件，缺${exhibitionQuotas[key] - quotas[key]}件；不能自动调剂类别名额`);
    }
    const count = candidates.filter(w => w.categoryKey === key).length;
    if (count < quotas[key]) throw new Error(`${stage}：${CATEGORY_NAMES[key]}有效${allowUnscored ? '' : '已评分'}候选仅${count}件，需要${quotas[key]}件，缺${quotas[key] - count}件`);
  }
  assertSchoolCapacity(candidates, uncovered, exhibitionQuotas, stage);

  const network = new MinCostCirculation();
  const source = network.node(), sink = network.node();
  const total = totalQuota(quotas);
  const categoryNodes = new Map(), extraNodes = new Map(), schoolNodes = new Map();
  const groups = new Map();
  for (const school of uncovered) {
    const node = network.node();
    schoolNodes.set(school, node);
    network.bounded(node, sink, SCHOOL_MINIMUM, SCHOOL_MINIMUM);
  }
  for (const key of CATEGORY_ORDER) {
    const category = network.node(), extra = network.node();
    categoryNodes.set(key, category);
    extraNodes.set(key, extra);
    network.edge(source, category, quotas[key]);
    network.bounded(extra, sink, quotas[key] - exhibitionQuotas[key], quotas[key]);
  }
  const ordered = candidates.slice().sort((a, b) => CATEGORY_ORDER.indexOf(a.categoryKey) - CATEGORY_ORDER.indexOf(b.categoryKey) || compareWorks(a, b) || String(workId(a)).localeCompare(String(workId(b))));
  const workEdges = ordered.map(work => {
    const school = normalizeSchool(work.school);
    const key = JSON.stringify([school, work.categoryKey]);
    if (!groups.has(key)) {
      const group = network.node();
      groups.set(key, group);
      network.edge(group, extraNodes.get(work.categoryKey), total);
      if (schoolNodes.has(school)) network.edge(group, schoolNodes.get(school), SCHOOL_MINIMUM);
    }
    const cost = SCORE_KEYS.map(field => {
      const value = work[field];
      if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`作品 ${workId(work)} 的评分无效`);
      return -(value == null ? 0 : value);
    });
    return { work, edge: network.edge(categoryNodes.get(work.categoryKey), groups.get(key), 1, cost) };
  });
  network.bounded(sink, source, total, total);
  network.solve();

  let selected = workEdges.filter(item => item.edge.capacity === 0).map(item => item.work);
  if (options.requireTieConfirmation) {
    const chosen = new Set(selected.map(workId));
    const groups = [];
    for (const key of CATEGORY_ORDER) {
      const rows = ordered.filter(w => w.categoryKey === key && w.totalScore != null);
      for (let i = 0; i < rows.length;) {
        let end = i + 1;
        while (end < rows.length && compareWorks(rows[i], rows[end]) === 0) end++;
        const tied = rows.slice(i, end), selectedCount = tied.filter(w => chosen.has(workId(w))).length;
        if (selectedCount > 0 && selectedCount < tied.length) groups.push({
          key: key + ':' + i, category: CATEGORY_NAMES[key], score: rows[i].totalScore, selectedCount,
          works: tied.map(w => ({ id: workId(w), workCode: w.workCode || w.submissionNumber || workId(w),
            title: w.artworkName || w.title || '未命名作品', school: w.school, selected: chosen.has(workId(w)) }))
        });
        i = end;
      }
    }
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ quotas, exhibitionQuotas, schoolNames,
      candidates: ordered.map(w => [workId(w), w.categoryKey, normalizeSchool(w.school), w.totalScore, w.evaluationCount]),
      covered: directWorks.map(w => [workId(w), normalizeSchool(w.school)]).sort() })).digest('hex');
    if (groups.length) {
      const resolution = options.tieResolution;
      const details = { fingerprint, groups, selectedIds: selected.map(workId) };
      if (!resolution || resolution.fingerprint !== fingerprint) {
        const error = new Error('同分作品影响入围名单，请先由管理员确认同分作品，再重新预检、备份并生成结果');
        error.code = 'TIE_CONFIRMATION_REQUIRED'; error.details = details; throw error;
      }
      const ids = resolution.selectedIds;
      if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length !== selected.length) throw new Error('人工确认名单数量不正确');
      const manual = new Set(ids), tiedIds = new Set(groups.flatMap(g => g.works.map(w => w.id)));
      if (ids.some(id => !ordered.some(w => workId(w) === id)) ||
          ordered.some(w => !tiedIds.has(workId(w)) && manual.has(workId(w)) !== chosen.has(workId(w))) ||
          groups.some(g => g.works.filter(w => manual.has(w.id)).length !== g.selectedCount)) throw new Error('只能在对应的同分组内调整入选作品，不能改变其他作品或组内名额');
      selected = ordered.filter(w => manual.has(workId(w)));
    }
  }
  const counts = countSchools([...selected, ...directWorks]);
  if (selected.length !== total || CATEGORY_ORDER.some(key => selected.filter(w => w.categoryKey === key).length !== quotas[key]) || schoolNames.some(school => (counts.get(school) || 0) < SCHOOL_MINIMUM)) {
    throw new Error('名单的类别名额或院校保底校验失败，未生成名单');
  }
  assertSchoolCapacity(selected, uncovered, exhibitionQuotas, stage);
  // Names stay in values rather than database field names (which may not contain dots).
  return { selected, schoolCounts: schoolNames.map(school => ({ school, count: counts.get(school) || 0 })) };
}

module.exports = { countSchools, requiredSchools, selectWithSchoolMinimum };
