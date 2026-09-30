const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = path.resolve(__dirname, '../miniprogram/pages/expert-scoring/index.js');
const url = name => `https://example.tcb.qcloud.la/${name}.jpg`;

function fixture() {
  let page;
  const patches = [], requests = [], previews = [];
  const storage = new Map();
  const wx = {
    cloud: { getTempFileURL(options) { requests.push(options); } },
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    showToast() {}, setNavigationBarTitle() {},
    previewImage(options) { previews.push(options); options.success(); options.complete(); }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Page: value => { page = value; }, getApp: () => ({ globalData: {} }),
    wx, require: createRequire(filename), console
  });
  page._isPageActive = true;
  page.data.submissionId = 'a';
  page.data.expertInfo = { expertId: 'judge', expertType: 'final', editionId: 'pottery-2026' };
  page.setData = patch => {
    patches.push(patch);
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = page.data;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)] = value;
    }
  };
  const prepare = detail => {
    page.data.submission = detail;
    page.prepareMediaItems(detail);
  };
  const tap = index => page.onMediaThumbTap({ currentTarget: { dataset: { index } } });
  return { page, patches, requests, previews, prepare, tap };
}

test('程序回调与重复索引不回写，快速点图后的旧通知不改变选中项', () => {
  const { page, patches, prepare, tap } = fixture();
  prepare({ id: 'a', perspectiveImage: url('a'), fourViewImages: [url('b'), url('c')] });
  patches.length = 0;
  for (const source of ['', undefined, 'autoplay']) page.onMediaSwipe({ detail: { source, current: 1 } });
  assert.equal(patches.length, 0);
  tap('1'); tap('2');
  const count = patches.length;
  for (let i = 0; i < 50; i++) page.onMediaSwipe({ detail: { source: '', current: i % 3 } });
  page.onMediaSwipe({ detail: { source: 'touch', current: 2 } });
  tap(2);
  assert.equal(page.data.activeMediaIndex, 2);
  assert.equal(patches.length, count);
  page.onMediaSwipe({ detail: { source: 'touch', current: 1 } });
  assert.equal(page.data.activeMediaUrl, url('b'));
  const afterSwipe = patches.length;
  for (const index of [-1, 3, 1.5, NaN, undefined, null, '', 'bad']) tap(index);
  assert.equal(patches.length, afterSwipe);
  page._isPageActive = false;
  tap(0); page.onMediaSwipe({ detail: { source: 'touch', current: 0 } });
  assert.equal(patches.length, afterSwipe);
});

test('重复 URL 保留七角度，刷新或前方空字段变化时按角度保留位置', () => {
  const { page, prepare, tap } = fixture();
  const detail = { id: 'a', perspectiveImage: url('same'),
    fourViewImages: [url('same'), url('same'), url('same')],
    detailImages: [url('same'), url('same'), url('same')] };
  prepare(detail);
  assert.equal(page.data.mediaItems.length, 7);
  assert.equal(new Set(page.data.mediaItems.map(item => item.key)).size, 7);
  assert.equal(page.data.mediaItems.map(item => item.label).join(','), '整体,正面,右侧,背面,左侧,顶/底,细节');
  tap(3);
  const selectedKey = page.data.mediaItems[3].key;
  prepare({ ...detail, perspectiveImage: '', fourViewImages: [url('same'), url('same'), url('updated')] });
  assert.equal(page.data.mediaItems[page.data.activeMediaIndex].key, selectedKey);
  assert.equal(page.data.activeMediaIndex, 2);
  assert.equal(page.data.activeMediaUrl, url('updated'));
  prepare({ ...detail, id: 'b' });
  assert.equal(page.data.activeMediaIndex, 0);
  tap(3);
  prepare({ id: 'b', perspectiveImage: url('only') });
  assert.equal(page.data.activeMediaIndex, 0);
  assert.equal(page.data.activeMediaUrl, url('only'));
});

test('慢网络返回图片地址不切图，过期及退出后的回调不更新页面', () => {
  const { page, patches, requests, prepare, tap } = fixture();
  const detail = { id: 'a', perspectiveImage: 'cloud://test/a', fourViewImages: ['cloud://test/b'] };
  const response = { fileList: [{ fileID: 'cloud://test/a', tempFileURL: url('a') },
    { fileID: 'cloud://test/b', tempFileURL: url('b') }] };
  prepare(detail); tap(1);
  requests[0].success(response);
  assert.equal(page.data.activeMediaIndex, 1);
  assert.ok(page.data.mediaItems[1].thumbnailUrl.includes('/b.jpg?'));
  prepare(detail);
  const count = patches.length;
  requests[0].success(response);
  assert.equal(patches.length, count);
  assert.equal(page.data.activeMediaIndex, 1);
  prepare({ id: 'b', perspectiveImage: url('next') });
  const changedWorkCount = patches.length;
  requests[1].success(response);
  assert.equal(patches.length, changedWorkCount);
  prepare(detail);
  page._isPageActive = false;
  const exitCount = patches.length;
  requests[2].success(response);
  assert.equal(patches.length, exitCount);
});

test('单图原图预览正常；切图不改评分、扣分、草稿，视频地址与进度正常', async () => {
  const { page, prepare, previews, tap } = fixture();
  page.onScoreSliderChange({ detail: { value: 73 } });
  page.onDeductionGroupChange({ detail: { value: ['aiNotLabeled'] } });
  page.saveDraft();
  const before = JSON.stringify([page.data.baseScore, page.data.finalScore, page.data.deductions, page.data.draftSaved]);
  prepare({ id: 'a', perspectiveImage: url('only') });
  await page.previewImage({ currentTarget: { dataset: { url: url('only') } } });
  assert.equal(previews.length, 1);
  assert.equal(previews[0].current, url('only'));
  assert.equal(page.data.mediaItems[0].viewed, true);
  prepare({ id: 'a', perspectiveImage: url('only'), fourViewImages: [url('b')] });
  tap(1);
  page.onMediaSwipe({ detail: { source: 'touch', current: 0 } });
  assert.equal(JSON.stringify([page.data.baseScore, page.data.finalScore, page.data.deductions, page.data.draftSaved]), before);
  page.data.baseScore = 0;
  page.restoreDraft({});
  page.calculateTotalScore();
  assert.equal(page.data.baseScore, 7.3);
  assert.equal(page.data.finalScore, 5.3);
  prepare({ id: 'video', workType: 'video', video: { tempUrl: 'https://example.test/video.mp4' } });
  assert.equal(page.data.activeMediaUrl, 'https://example.test/video.mp4');
  page.onVideoTimeUpdate({ detail: { currentTime: 25, duration: 100 } });
  assert.equal(page.data.videoWatchPercent, 25);
  prepare({ id: 'empty' });
  assert.equal(page.data.mediaItems.length, 0);
  assert.equal(page.data.activeMediaIndex, 0);
  assert.equal(page.data.activeMediaUrl, '');
});
