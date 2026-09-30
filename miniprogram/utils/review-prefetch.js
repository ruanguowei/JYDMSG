// 单槽、短期、可失效的预加载。不保存原图、视频、页面对象或整批详情。
const TTL = 5 * 60 * 1000;
const MAX_DETAIL_CHARS = 128 * 1024;
const MAX_THUMB_BYTES = 1024 * 1024;
let slot = null;
let generation = 0;
let expiryTimer = null;
let downloadTask = null;
let requestPending = false;

function key(params) {
  return JSON.stringify([params.editionId, params.expertId, params.expertCode,
    params.expertType, params.category, params.submissionId]);
}

function releaseFile(filePath) {
  if (!filePath) return;
  wx.getFileSystemManager().unlink({ filePath, fail() {} });
}

function clear() {
  generation++;
  clearTimeout(expiryTimer);
  expiryTimer = null;
  const task = downloadTask;
  downloadTask = null;
  if (task) task.abort();
  if (slot) releaseFile(slot.thumbnailPath);
  slot = null;
}

function thumbnailUrl(url, size) {
  if (!/^https?:\/\//.test(url || '')) return '';
  const host = url.split('/')[2].split(':')[0].toLowerCase();
  if (!/(^|\.)(tcb\.qcloud\.la|myqcloud\.com|tencentcos\.cn)$/.test(host)) return '';
  const parts = url.split('#')[0].split('?');
  const query = (parts[1] || '').split('&').filter(part => part && !/^image(Mogr2|View2)\//.test(part));
  query.push('imageMogr2/thumbnail/' + size + 'x/format/jpg/quality/70');
  return parts[0] + '?' + query.join('&');
}

async function warmThumbnail(detail, token) {
  if (detail.workType === 'video') return;
  const original = detail.perspectiveImage || (detail.fourViewImages || [])[0]
    || (detail.detailImages || [])[0] || (detail.images || [])[0];
  if (!original) return;
  let url = original;
  if (url.startsWith('cloud://')) {
    const result = await wx.cloud.getTempFileURL({ fileList: [url] });
    url = ((result.fileList || []).find(file => file.fileID === original) || {}).tempFileURL;
  }
  if (token !== generation || !slot) return;
  url = thumbnailUrl(url, 640);
  if (!url) return;
  downloadTask = wx.downloadFile({
    url, timeout: 10000,
    success(result) {
      const filePath = result.tempFilePath;
      if (token !== generation || !slot || result.statusCode !== 200) {
        releaseFile(filePath);
        return;
      }
      wx.getFileSystemManager().stat({
        path: filePath,
        success(info) {
          if (token !== generation || !slot || info.stats.size > MAX_THUMB_BYTES) {
            releaseFile(filePath);
            return;
          }
          slot.thumbnailPath = filePath;
          slot.thumbnailOriginal = original;
        },
        fail() { releaseFile(filePath); }
      });
    },
    fail() {},
    complete() { if (token === generation) downloadTask = null; }
  });
  downloadTask.onProgressUpdate(progress => {
    if (token === generation && progress.totalBytesWritten > MAX_THUMB_BYTES && downloadTask) {
      downloadTask.abort();
    }
  });
}

function prefetch(params) {
  if (requestPending) return;
  const cacheKey = key(params);
  if (slot && slot.key === cacheKey && Date.now() < slot.expiresAt) return;
  clear();
  const token = generation;
  requestPending = true;
  // 回调仅捕获参数与数字令牌；云请求无法取消时，不引用已销毁页面。
  wx.cloud.callFunction({
    name: 'fetchSubmissionDetail', data: params, timeout: 15000,
    success(response) {
      if (token !== generation) return;
      const result = response.result;
      const detail = result && result.data;
      if (!result || !result.success || !detail || detail.id !== params.submissionId
        || detail.category !== params.category) return;
      if (JSON.stringify(detail).length > MAX_DETAIL_CHARS) return;
      slot = { key: cacheKey, detail, expiresAt: Date.now() + TTL, thumbnailPath: '' };
      expiryTimer = setTimeout(clear, TTL);
      warmThumbnail(detail, token).catch(() => {});
    },
    fail() {},
    complete() { requestPending = false; }
  });
}

function take(params) {
  if (!slot || slot.key !== key(params) || Date.now() >= slot.expiresAt) {
    clear();
    return null;
  }
  const cached = slot;
  slot = null; // 临时缩略图的所有权交给评分页，避免重复释放。
  clear();
  return cached;
}

module.exports = { prefetch, take, clear, releaseFile, thumbnailUrl };
