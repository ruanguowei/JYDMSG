Page({
  data: { loading: true, groups: [], error: '', saved: false },
  onLoad(options) {
    this._alive = true;
    const pages = getCurrentPages(), parent = pages[pages.length - 2];
    if (!parent || typeof parent.getAdminPayload !== 'function') { wx.navigateBack(); return; }
    this.admin = parent.getAdminPayload();
    this.editionId = parent.data.adminOperation.editionId || 'pottery-2026';
    this.operationName = options.operation;
    if (!['generatePreliminaryTable','generateFinalRanking'].includes(this.operationName)) { wx.navigateBack(); return; }
    this.load();
  },
  onUnload() { this._alive = false; },
  key() { return `tieResolution:${this.editionId}:${this.operationName}`; },
  async request(tieResolution) {
    const response = await wx.cloud.callFunction({ name: 'quickstartFunctions', timeout: 180000,
      data: { type: 'manageAdminOperation', action: 'rankingPreview', admin: this.admin,
        editionId: this.editionId, operationName: this.operationName, tieResolution } });
    return response.result || { success: false, message: '无法获取计算结果' };
  },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await this.request();
      if (!this._alive) return;
      if (result.success) {
        wx.removeStorageSync(this.key());
        this.setData({ groups: [], error: '当前没有需要人工确认的同分边界，可返回管理员面板生成结果。' }); return;
      }
      if (result.code !== 'TIE_CONFIRMATION_REQUIRED' || !result.details) throw new Error(result.message || result.errMsg || '计算失败');
      this.plan = result.details;
      this.setData({ groups: result.details.groups.map(g => ({ ...g, scoreText: Number(g.score.toFixed(6)), checkedCount: g.selectedCount })) });
    } catch (error) { if (this._alive) this.setData({ error: error.message }); }
    finally { if (this._alive) this.setData({ loading: false }); }
  },
  choose(e) {
    if (this.data.loading) return;
    const index = Number(e.currentTarget.dataset.index), ids = e.detail.value;
    const group = this.data.groups[index];
    this.setData({ [`groups[${index}].works`]: group.works.map(w => ({ ...w, selected: ids.includes(w.id) })),
      [`groups[${index}].checkedCount`]: ids.length, saved: false });
  },
  async save() {
    if (this.data.loading || !this.plan) return;
    if (this.data.groups.some(g => g.checkedCount !== g.selectedCount)) { wx.showToast({ title: '请按每组名额选择作品', icon: 'none' }); return; }
    const tied = new Set(this.data.groups.flatMap(g => g.works.map(w => w.id)));
    const selectedIds = this.plan.selectedIds.filter(id => !tied.has(id))
      .concat(this.data.groups.flatMap(g => g.works.filter(w => w.selected).map(w => w.id))).sort();
    const resolution = { fingerprint: this.plan.fingerprint, selectedIds };
    this.setData({ loading: true, error: '' });
    try {
      const result = await this.request(resolution);
      if (!this._alive) return;
      if (!result.success) throw new Error(result.message || result.errMsg || '名单校验未通过，请重新载入');
      wx.setStorageSync(this.key(), resolution);
      this.setData({ saved: true });
      wx.showModal({ title: '同分选择已保存', content: '类别名额和院校保底校验通过。请返回管理员面板，重新预检、备份并生成确认码后执行。', showCancel: false,
        success: () => { if (this._alive) wx.navigateBack(); } });
    } catch (error) { if (this._alive) this.setData({ error: error.message }); }
    finally { if (this._alive) this.setData({ loading: false }); }
  }
});
