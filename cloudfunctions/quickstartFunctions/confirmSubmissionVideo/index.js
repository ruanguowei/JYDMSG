const cloud = require('wx-server-sdk');
const { collectionName, resolveEdition } = require('../common/edition');
const { MAX_VIDEO_SIZE_BYTES, normalizeVideoMeta } = require('../common/video');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

function hasAllowedPath(fileId, editionId, submissionId) {
  const value = String(fileId || '');
  return value.includes(`exhibitions/${editionId}/submissions/${submissionId}/video/`);
}

exports.main = async (event) => {
  const db = cloud.database();
  const wxContext = cloud.getWXContext();

  try {
    const edition = await resolveEdition(db, {
      editionId: event.editionId,
      useCurrent: !event.editionId,
      mode: 'write'
    });
    const submissionId = event.submissionId;
    const video = normalizeVideoMeta(event.video || {});

    if (!submissionId) {
      throw new Error('缺少报名记录 ID');
    }

    if (!video.fileId) {
      throw new Error('缺少视频文件 ID');
    }

    if (!hasAllowedPath(video.fileId, edition.editionId, submissionId)) {
      throw new Error('视频路径与当前作品不匹配');
    }

    if (video.format !== 'mp4' && !/\.mp4$/i.test(video.fileName)) {
      throw new Error('视频仅支持 MP4 格式');
    }

    if (!video.sizeBytes || video.sizeBytes > MAX_VIDEO_SIZE_BYTES) {
      throw new Error('视频大小不能超过 100MB');
    }

    const collection = db.collection(collectionName(edition, 'submissions'));
    const record = await collection.doc(submissionId).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      throw new Error('无权确认该作品视频');
    }

    const confirmedVideo = {
      ...video,
      format: 'mp4',
      uploadStatus: 'uploaded',
      uploadedAt: Date.now()
    };

    await collection.doc(submissionId).update({
      data: {
        video: confirmedVideo,
        updatedAt: Date.now()
      }
    });

    return {
      success: true,
      data: confirmedVideo
    };
  } catch (error) {
    console.error('确认视频失败:', error);
    return {
      success: false,
      errMsg: error.message || '确认视频失败'
    };
  }
};
