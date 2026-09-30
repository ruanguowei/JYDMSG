const standards = require('../../utils/review-standards');
Page({
  data: { loading: true, error: '', batch: [], total: 30, viewedCount: 0, batchIndex: 0, batchCount: 5,
    progress: 0, allViewed: false, batchReady: false, busy: false, expanded: -1, standards },
  onLoad() {
    this._alive = true; this._visible = true; this._observers = [];
    this.expert = wx.getStorageSync('expertInfo');
    if (!this.expert || !this.expert.isLoggedIn) { wx.redirectTo({ url: '/pages/expert-login/index' }); return; }
    this.loadBatch(0);
  },
  onShow() { this._visible = true; if (this.data.batch.length) this.observeImages(); },
  onHide() { this._visible = false; this.disconnect(); },
  onUnload() { this._alive = false; this.disconnect(); },
  disconnect() { (this._observers || []).forEach(o => o.disconnect()); this._observers = []; },
  call(action, extra = {}) {
    const expert = this.expert;
    return wx.cloud.callFunction({ name: 'quickstartFunctions', timeout: 60000, data: {
      type: 'reviewOrientation', action, expertId: expert.expertId, expertCode: expert.expertCode,
      editionId: expert.editionId || 'pottery-2026', ...extra
    } }).then(res => {
      if (res.result && res.result.code === 'PLEDGE_REQUIRED' && this._alive) wx.redirectTo({ url: '/pages/expert-pledge/index' });
      if (!res.result || !res.result.success) throw new Error((res.result || {}).message || (res.result || {}).errMsg || '预览加载失败'); return res.result.data;
    });
  },
  async loadBatch(index) {
    if (this._pending) return;
    this._pending = true; this.disconnect(); this._loaded = new Set(); this._seen = new Set();
    this.setData({ loading: true, error: '', batch: [], batchReady: false });
    try {
      const data = await this.call('get', { batchIndex: index });
      if (!this._alive) return;
      if (data.completed) { this.enterScoring(); return; }
      this.setData({ ...data, loading: false, batch: data.batch.map(item => ({ ...item, failed: !item.thumbnail })),
        progress: Math.round(data.viewedCount * 100 / data.total), allViewed: data.total > 0 && data.viewedCount === data.total,
        batchReady: data.batch.every(item => item.viewed) }, () => this.observeImages());
    } catch (error) {
      if (this._alive) this.setData({ loading: false, error: error.message });
    } finally { this._pending = false; if (this._alive && !this.data.error) this.acknowledge(); }
  },
  observeImages() {
    this.disconnect(); if (!this._visible || !this._alive) return;
    this.data.batch.forEach(item => {
      const observer = this.createIntersectionObserver({ thresholds: [0.8] });
      observer.relativeToViewport().observe('#preview-' + item.ordinal, result => {
        if (!this._visible || !this._alive || result.intersectionRatio < 0.8) return;
        if (!this.data.batch.some(row => row.id === item.id)) return;
        this._seen.add(item.id); this.acknowledge();
      });
      this._observers.push(observer);
    });
  },
  imageLoaded(e) {
    if (!this._alive || !this.data.batch.some(w => w.id === e.currentTarget.dataset.id)) return;
    this._loaded.add(e.currentTarget.dataset.id); this.acknowledge();
  },
  imageFailed(e) {
    const i = this.data.batch.findIndex(w => w.id === e.currentTarget.dataset.id);
    if (this._alive && i >= 0) this.setData({ [`batch[${i}].failed`]: true });
  },
  async acknowledge() {
    if (this._acking || this._pending || !this._visible || !this._alive) return;
    const ids = this.data.batch.filter(w => !w.viewed && this._loaded.has(w.id) && this._seen.has(w.id)).map(w => w.id);
    if (!ids.length) return;
    if (this.data.batch.some(w => !w.viewed && !ids.includes(w.id))) return;
    this._acking = true;
    try {
      const data = await this.call('viewed', { sessionId: this.data.sessionId, batchIndex: this.data.batchIndex, viewedIds: ids });
      if (!this._alive) return;
      if (data.completed) { this.enterScoring(); return; }
      const batch = this.data.batch.map(w => ({ ...w, viewed: w.viewed || ids.includes(w.id) }));
      this.setData({ batch, viewedCount: data.viewedCount, progress: Math.round(data.viewedCount * 100 / data.total),
        allViewed: data.viewedCount === data.total, batchReady: batch.every(w => w.viewed), error: '' });
    } catch (error) { if (this._alive) this.setData({ error: error.message }); }
    finally { this._acking = false; }
    // Additional image events may have arrived during the request; do not retry errors indefinitely.
    if (!this.data.error) this.acknowledge();
  },
  previous() { if (!this._acking && this.data.batchIndex > 0) this.loadBatch(this.data.batchIndex - 1); },
  next() { if (!this._acking && this.data.batchReady && this.data.batchIndex + 1 < this.data.batchCount) this.loadBatch(this.data.batchIndex + 1); },
  retry() { if (this._acking) return; this.loadBatch(this.data.batchIndex); },
  expand(e) { const i = Number(e.currentTarget.dataset.index); this.setData({ expanded: this.data.expanded === i ? -1 : i }); },
  async startScoring() {
    if (!this.data.allViewed || this.data.busy) return;
    this.setData({ busy: true });
    try {
      await this.call('complete', { sessionId: this.data.sessionId });
      if (this._alive) this.enterScoring();
    } catch (error) { if (this._alive) this.setData({ error: error.message, busy: false }); }
  },
  enterScoring() {
    wx.setStorageSync('expertLoginTicket', Date.now());
    wx.redirectTo({ url: '/pages/expert-evaluation/index' });
  }
});
