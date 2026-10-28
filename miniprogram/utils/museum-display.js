const LIST_LIMIT = 20;
const PATHS = {
  collections: '/pages/museum-collections/index',
  artists: '/pages/museum-artists/index'
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function imageUrl(value) {
  const url = text(value);
  return /^(cloud:\/\/|https:\/\/)/.test(url) ? url : '';
}

function queryText(value) {
  const valueText = text(value);
  try { return decodeURIComponent(valueText); } catch (error) { return valueText; }
}

async function fetchContent(action, params) {
  const response = await wx.cloud.callFunction({
    name: 'museumDisplay',
    data: Object.assign({}, params, { action })
  });
  const result = (response && response.result) || {};
  if (!result.success || !result.data) {
    throw new Error(result.errMsg || '内容暂时无法加载，请稍后重试');
  }
  return result.data;
}

function showNavigationError() {
  wx.showToast({ title: '页面暂时无法打开，请重试', icon: 'none' });
}

function openUrl(url, replace) {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
  // Museum/artist links form a cycle. Keep room in WeChat's 10-page stack.
  if (replace || pages.length >= 9) {
    return wx.redirectTo({ url, fail: showNavigationError });
  }
  return wx.navigateTo({ url, fail: showNavigationError });
}

function navigate(path, key, value) {
  const id = text(value);
  if (!id) return;
  return openUrl('/pages/' + path + '/index?' + key + '=' + encodeURIComponent(id));
}

function uniqueImages(values) {
  return values.map(imageUrl).filter((url, index, all) => url && all.indexOf(url) === index);
}

function displayWork(item, position) {
  const result = Object.assign({}, item);
  result.coverImage = imageUrl(result.coverImage)
    || uniqueImages(Array.isArray(result.detailImages) ? result.detailImages : [])[0] || '';
  result.viewKey = text(result._id) ? 'collection:' + result._id
    : 'image:' + result.coverImage + '#' + position;
  return result;
}

async function previewImages(urls, current, shouldContinue) {
  const source = uniqueImages(urls);
  const selected = imageUrl(current);
  if (!selected || source.indexOf(selected) < 0) return;
  const cloudIds = source.filter(url => url.indexOf('cloud://') === 0);
  const mapping = {};
  // The temp-file API accepts a maximum of 50 files per call.
  for (let offset = 0; offset < cloudIds.length; offset += 50) {
    const response = await wx.cloud.getTempFileURL({ fileList: cloudIds.slice(offset, offset + 50) });
    ((response && response.fileList) || []).forEach(file => {
      if (/^https:\/\//.test(text(file.tempFileURL)) && (!file.status || file.status === 0)) {
        mapping[file.fileID] = file.tempFileURL;
      }
    });
  }
  const resolve = url => url.indexOf('cloud://') === 0 ? mapping[url] : url;
  const resolvedCurrent = resolve(selected);
  if (!resolvedCurrent) throw new Error('图片暂时无法打开');
  if (shouldContinue && !shouldContinue()) return;
  return wx.previewImage({ current: resolvedCurrent, urls: source.map(resolve).filter(Boolean) });
}

function listPage(action, field) {
  return {
    data: {
      loading: true,
      loadingMore: false,
      error: '',
      keyword: '',
      appliedKeyword: '',
      hasMore: false,
      activeModule: field === 'artists' ? 'artists' : 'collections',
      relatedArtistName: '',
      [field]: []
    },

    onLoad(options = {}) {
      this._artistId = queryText(options.artistId);
      this._version = 0;
      this._unloaded = false;
      this.setData({ relatedArtistName: queryText(options.artistName).slice(0, 80) });
      return this.fetchList(true);
    },

    onUnload() {
      this._unloaded = true;
      this._version++;
    },

    onKeywordInput(e) {
      this.setData({ keyword: e.detail.value });
    },

    onSearch() {
      return this.fetchList(true);
    },

    clearSearch() {
      this.setData({ keyword: '' });
      return this.fetchList(true);
    },

    retry() {
      return this.fetchList(!this.data[field].length);
    },

    async onPullDownRefresh() {
      try {
        await this.fetchList(true);
      } finally {
        wx.stopPullDownRefresh();
      }
    },

    onReachBottom() {
      return this.loadMore();
    },

    loadMore() {
      if (!this.data.loading && !this.data.loadingMore && !this.data.error && this.data.hasMore) {
        return this.fetchList(false);
      }
    },

    async fetchList(reset) {
      const version = reset ? ++this._version : this._version;
      if (reset) this._keyword = text(this.data.keyword).slice(0, 80);
      const previous = reset ? [] : this.data[field];
      this.setData(Object.assign({
        loading: reset,
        loadingMore: !reset,
        error: ''
      }, reset ? { [field]: [], hasMore: false, appliedKeyword: this._keyword } : {}));
      try {
        const offset = reset ? 0 : (this._offset || 0);
        const result = await fetchContent(action, {
          keyword: this._keyword,
          artistId: this._artistId,
          offset,
          limit: LIST_LIMIT
        });
        if (this._unloaded || version !== this._version) return;
        const incoming = Array.isArray(result.items) ? result.items : [];
        this._offset = offset + incoming.length;
        const seen = Object.create(null);
        const rows = field === 'collections' ? incoming.map(displayWork) : incoming;
        const items = previous.concat(rows).filter(item => {
          const id = text(item && item._id);
          if (!id || seen[id]) return false;
          seen[id] = true;
          return true;
        });
        this.setData({ [field]: items, hasMore: !!result.hasMore && incoming.length > 0 });
      } catch (error) {
        if (!this._unloaded && version === this._version) {
          this.setData({ error: error.message || '网络异常，请重试' });
        }
      } finally {
        if (!this._unloaded && version === this._version) {
          this.setData({ loading: false, loadingMore: false });
        }
      }
    },

    openDetail(e) {
      return navigate(field === 'artists' ? 'museum-artist-detail' : 'museum-collection-detail', 'id', e.currentTarget.dataset.id);
    },

    switchModule(e) {
      const module = e.currentTarget.dataset.module;
      if (!PATHS[module] || module === this.data.activeModule) return;
      return openUrl(PATHS[module], true);
    },

    showAllCollections() {
      return openUrl(PATHS.collections, true);
    },

    onListImageError(e) {
      const index = Number(e.currentTarget.dataset.index);
      const row = this.data[field][index];
      const url = e.currentTarget.dataset.url;
      if (!Number.isInteger(index) || !row) return;
      if (url && url !== (field === 'artists' ? row.avatar : row.coverImage)) return;
      this.setData({ [field + '[' + index + '].imageFailed']: true });
    }
  };
}

function detailPage(action, field) {
  return {
    data: {
      loading: true,
      error: '',
      [field]: null,
      images: [],
      failedImages: {},
      imageIndex: 0,
      previewing: false,
      authorImageFailed: false,
      avatarFailed: false
    },

    onLoad(options = {}) {
      // Only accept API identifiers from deep links, never pass arbitrary URL options.
      this._options = { id: queryText(options.id), artistId: queryText(options.artistId) };
      this._version = 0;
      this._unloaded = false;
      return this.fetchDetail();
    },

    onUnload() {
      this._unloaded = true;
      this._version++;
    },

    retry() {
      return this.fetchDetail();
    },

    async fetchDetail() {
      const version = ++this._version;
      this.setData({ loading: true, error: '', failedImages: {}, authorImageFailed: false, avatarFailed: false });
      if (!this._options.id && !this._options.artistId) {
        this.setData({ loading: false, error: '缺少内容编号，请返回列表重新进入' });
        return;
      }
      try {
        const item = await fetchContent(action, this._options);
        if (this._unloaded || version !== this._version) return;
        const images = uniqueImages([item.coverImage].concat(item.detailImages || []));
        if (field === 'artist') {
          item.representativeWorks = Array.isArray(item.representativeWorks) ? item.representativeWorks.map(displayWork) : [];
        }
        this.setData({ [field]: item, images, imageIndex: 0 });
      } catch (error) {
        if (!this._unloaded && version === this._version) {
          this.setData({ error: error.message || '网络异常，请重试' });
        }
      } finally {
        if (!this._unloaded && version === this._version) this.setData({ loading: false });
      }
    },

    onImageChange(e) {
      this.setData({ imageIndex: e.detail.current });
    },

    previousImage() {
      if (this.data.imageIndex > 0) this.setData({ imageIndex: this.data.imageIndex - 1 });
    },

    nextImage() {
      if (this.data.imageIndex < this.data.images.length - 1) {
        this.setData({ imageIndex: this.data.imageIndex + 1 });
      }
    },

    onHeroImageError(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (!Number.isInteger(index) || !this.data.images[index]) return;
      if (e.currentTarget.dataset.url && e.currentTarget.dataset.url !== this.data.images[index]) return;
      this.setData({ ['failedImages.' + index]: true });
    },

    onAuthorImageError() {
      this.setData({ authorImageFailed: true });
    },

    onAvatarError() {
      this.setData({ avatarFailed: true });
    },

    onWorkImageError(e) {
      const index = Number(e.currentTarget.dataset.index);
      const works = this.data.artist && this.data.artist.representativeWorks;
      if (!Number.isInteger(index) || !works || !works[index]) return;
      if (e.currentTarget.dataset.url && e.currentTarget.dataset.url !== works[index].coverImage) return;
      this.setData({ ['artist.representativeWorks[' + index + '].imageFailed']: true });
    },

    openArtist() {
      const item = this.data.item;
      if (item) return navigate('museum-artist-detail', 'id', item.artistDocumentId);
    },

    openCollection(e) {
      const id = e.currentTarget.dataset.id;
      if (id) return navigate('museum-collection-detail', 'id', id);
      // Independent representative images have no collection page.
      return this.previewImage(e);
    },

    showCollections() {
      const artist = this.data.artist;
      if (!artist || !text(artist.artistId || artist._id)) return;
      const url = PATHS.collections + '?artistId=' + encodeURIComponent(artist._id || artist.artistId)
        + '&artistName=' + encodeURIComponent(artist.name || '');
      return openUrl(url);
    },

    async previewImage(e) {
      const url = (e && e.currentTarget && e.currentTarget.dataset.url) || this.data.images[this.data.imageIndex];
      if (!imageUrl(url) || this.data.previewing) return;
      const urls = this.data.images.length ? this.data.images : [url];
      this.setData({ previewing: true });
      try {
        await previewImages(urls, url, () => !this._unloaded);
      } catch (error) {
        if (!this._unloaded) wx.showToast({ title: '图片暂时无法打开，请稍后重试', icon: 'none' });
      } finally {
        if (!this._unloaded) this.setData({ previewing: false });
      }
    }
  };
}

module.exports = { fetchContent, navigate, listPage, detailPage, previewImages };
