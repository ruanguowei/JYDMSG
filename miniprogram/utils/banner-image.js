// 只用于横幅展示；原图地址保留给分享及缩略图失败时的一次回退。
const BANNER_IMAGE_RULE = 'imageMogr2/thumbnail/1280x/format/jpg/quality/80/strip';

function toBannerImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const original = url.trim();
  const hostMatch = original.match(/^https:\/\/([^/?#]+)(?:[/?#]|$)/i);
  if (!hostMatch) return original;
  const host = hostMatch[1].toLowerCase();
  if (!/(^|\.)tcb\.qcloud\.la$/.test(host) && !/\.cos\.[a-z0-9-]+\.myqcloud\.com$/.test(host)) {
    return original;
  }

  const hashIndex = original.indexOf('#');
  const address = hashIndex < 0 ? original : original.slice(0, hashIndex);
  const fragment = hashIndex < 0 ? '' : original.slice(hashIndex);
  const queryIndex = address.indexOf('?');
  const query = queryIndex < 0 ? '' : address.slice(queryIndex + 1);
  // 保留已有图片样式及签名参数，避免二次处理改变运营设置的画面。
  if (/(^|&)(imageMogr2|imageView2|imageSlim)(\/|&|$)/.test(query)) return original;
  const separator = queryIndex < 0 ? '?' : (query && !query.endsWith('&') ? '&' : '');
  return address + separator + BANNER_IMAGE_RULE + fragment;
}

function buildBannerImage(url) {
  const originalImageUrl = typeof url === 'string' ? url.trim() : '';
  return {
    imageUrl: toBannerImageUrl(originalImageUrl),
    originalImageUrl,
    imageLoaded: false,
    imageFailed: false
  };
}

module.exports = { toBannerImageUrl, buildBannerImage };
