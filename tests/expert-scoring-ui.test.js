const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../miniprogram/pages/expert-scoring/index.js');

function fixture() {
  let page;
  const storage = new Map();
  const calls = [];
  const list = { route: 'pages/expert-evaluation/index', data: { submissions: [{ id: 'a' }, { id: 'b' }], statistics: { evaluated: 0, unevaluated: 2 } }, setData(patch) { Object.assign(this.data, patch); } };
  const wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, structuredClone(value)), removeStorageSync: key => storage.delete(key),
    showToast: data => calls.push(data), showLoading() {}, hideLoading() {},
    navigateBack: () => calls.push('back'), redirectTo: data => calls.push(data),
    cloud: { callFunction: options => options.success({ result: { success: true } }) }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Page: value => { page = value; }, getApp: () => ({ globalData: {} }), wx,
    getCurrentPages: () => [list, page], require: createRequire(filename), console: { log() {}, error() {} }
  });
  page.setData = patch => {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = page.data;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)] = value;
    }
  };
  page.data.expertInfo = { expertId: 'judge-a', expertType: 'final', editionId: 'pottery-2026' };
  page.data.submissionId = 'a';
  page._isPageActive = true;
  return { page, wx, storage, calls, list };
}

test('七角度标签与报名字段一致，仅成功查看的大图标记已看', () => {
  const { page } = fixture();
  page.prepareMediaItems({ perspectiveImage: 'overall', fourViewImages: ['front', 'right', 'back'], detailImages: ['left', 'top', 'detail'] });
  assert.equal(page.data.mediaItems.map(item => item.label).join(','), '整体,正面,右侧,背面,左侧,顶/底,细节');
  assert.ok(page.data.mediaItems.every(item => !item.viewed));
  page.onMediaThumbTap({ currentTarget: { dataset: { index: 2 } } });
  assert.equal(page.data.activeMediaUrl, 'right');
  page.onImageLoad({ currentTarget: { dataset: { url: 'right' } } });
  assert.equal(page.data.mediaItems.filter(item => item.viewed).length, 1);
});

test('总分滑轨覆盖0—10分的101档，零分可选，提交和验证期间锁定分数', () => {
  const { page } = fixture();
  const choose = value => page.onScoreSliderChange({ detail: { value } });
  choose('invalid'); assert.equal(page.data.scoreTouched, false);
  for(let i=0;i<=100;i++){choose(i);assert.equal(page.data.baseScore,i/10);assert.equal(page.data.scoreTenths,i);}
  choose(0); assert.equal(page.data.scoreTouched,true);assert.equal(page.data.totalScore,0);
  page.data.submitting = true; choose(85);assert.equal(page.data.baseScore,0);
  page.data.submitting = false;page.data.verificationPending = true;choose(85);assert.equal(page.data.baseScore,0);
  page.data.verificationPending = false;choose(85);assert.equal(page.data.baseScore,8.5);
  page.adjustBaseScore({currentTarget:{dataset:{delta:1}}});assert.equal(page.data.baseScore,8.6);
});

test('草稿按届次、评委、阶段、作品隔离，恢复扣分与零分，服务端评分优先', () => {
  const { page, storage } = fixture();
  page.data.baseScore = 0; page.data.scoreTouched = true;
  page.data.deductions.aiNotLabeled = true;
  page.saveDraft(); const key = page.draftKey(); assert.ok(storage.has(key));
  page.data.baseScore = 8; page.data.scoreTouched = false;page.restoreDraft({});
  assert.equal(page.data.baseScore, 0);assert.equal(page.data.scoreTouched,true); assert.equal(page.data.deductions.aiNotLabeled, true);
  page.data.baseScore = 3; page.restoreDraft({ existingBaseScore: 0 });
  assert.equal(page.data.baseScore, 3);
  for (const field of ['expertId', 'expertType', 'editionId']) {
    const old = page.data.expertInfo[field]; page.data.expertInfo[field] = 'other';
    assert.notEqual(page.draftKey(), key); page.data.expertInfo[field] = old;
  }
  page.clearDraft(); assert.equal(storage.size, 0);
});

test('提交成功删除草稿、移除当前作品并进入下一件，批次结束回列表', () => {
  const { page, calls, list, storage } = fixture();
  page.saveDraft(); page.doSubmitScore();
  assert.equal(storage.size, 0); assert.equal(list.data.statistics.evaluated, 1);
  assert.ok(calls.some(call => call.url === '/pages/expert-scoring/index?submissionId=b'));
  page.data.submissionId = 'b'; page.doSubmitScore();
  assert.equal(calls.at(-1), 'back'); assert.equal(list.data.submissions.length, 0);
});

test('提交失败保留草稿与当前列表，播放进度不等同观看时长', () => {
  const { page, wx, calls, storage, list } = fixture();
  page.saveDraft();
  wx.cloud.callFunction = options => options.success({ result: { success: false, message: '模拟失败' } });
  page.doSubmitScore(); assert.equal(storage.size, 1); assert.equal(list.data.submissions.length, 2);
  assert.ok(!calls.some(call => call.url));
  page.onVideoTimeUpdate({ detail: { currentTime: 50, duration: 100 } });
  assert.equal(page.data.videoWatchPercent, 50);
});

test('批次结束只补充当前类别，过滤跨类与已提交作品，保持页面替换', () => {
 const {page,wx,calls,list}=fixture();page.data.category='technique';list.data.categories=[];
 wx.cloud.callFunction=options=>{
  assert.equal(options.data.category,'technique');
  options.success({result:{success:true,data:[{id:'a',category:'technique'},{id:'wrong',category:'culture'},{id:'next',category:'technique'}],statistics:{total:2}}});
 };
 page.loadNextCategoryBatch(list);
 assert.equal(list.data.submissions.length,1);assert.equal(list.data.submissions[0].id,'next');
 assert.ok(calls.some(call=>call.url==='/pages/expert-scoring/index?submissionId=next&category=technique'));
});
