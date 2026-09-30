const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

function normalizeVideoMeta(rawVideo = {}) {
  return {
    fileId: rawVideo.fileId || '',
    fileName: rawVideo.fileName || '',
    sizeBytes: Number(rawVideo.sizeBytes || 0),
    format: String(rawVideo.format || '').toLowerCase(),
    durationSeconds: Number(rawVideo.durationSeconds || 0),
    width: Number(rawVideo.width || 0),
    height: Number(rawVideo.height || 0),
    aspectRatio: rawVideo.aspectRatio || '',
    uploadStatus: rawVideo.uploadStatus || 'ready',
    uploadedAt: rawVideo.uploadedAt || null
  };
}

function isMp4FileName(fileName) {
  return /\.mp4$/i.test(String(fileName || ''));
}

function validateVideoMeta(rawVideo, options = {}) {
  const video = normalizeVideoMeta(rawVideo);
  const errors = [];

  if (options.required && !video.fileId) {
    errors.push('请上传 MP4 视频文件');
  }

  if (video.fileId || video.fileName || video.sizeBytes) {
    if (!isMp4FileName(video.fileName) && video.format !== 'mp4') {
      errors.push('视频仅支持 MP4 格式');
    }

    if (!video.sizeBytes || video.sizeBytes <= 0) {
      errors.push('视频文件大小异常');
    }

    if (video.sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      errors.push('视频大小不能超过 100MB');
    }

    if (video.uploadStatus !== 'uploaded') {
      errors.push('视频尚未完成上传确认');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    video
  };
}

function validateBaiduCloudBackup(link, password) {
  const normalizedLink = String(link || '').trim();
  const normalizedPassword = String(password || '').trim();
  if (!normalizedLink && !normalizedPassword) return { ok: false, errors: [] };
  if (!/^https?:\/\//i.test(normalizedLink) || !/baidu\.com|baidupan\.com/i.test(normalizedLink)) {
    return { ok: false, errors: ['请填写有效的百度网盘分享链接'] };
  }
  if (!normalizedPassword) return { ok: false, errors: ['请填写百度网盘提取码'] };
  return { ok: true, errors: [] };
}

module.exports = {
  MAX_VIDEO_SIZE_BYTES,
  normalizeVideoMeta,
  validateVideoMeta,
  validateBaiduCloudBackup
};
