const { assertOrientation } = require('../common/reviewOrientation');
// cloudfunctions/fetchSubmissionDetail/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { normalizeCategory, eligible, prepareWork } = require('../common/evaluationRules')
const { collectionName, publicEdition, resolveEdition } = require('../common/edition')

async function buildVideoPlaybackInfo(submission) {
  if (!submission.video) return null;
  const video = { ...(submission.video || {}) };
  const fileId = video.fileId || '';
  if (!video.tempUrl && fileId.startsWith('cloud://')) {
    try {
      const result = await cloud.getTempFileURL({ fileList: [fileId] });
      const item = result.fileList && result.fileList[0];
      if (item && item.tempFileURL) video.tempUrl = item.tempFileURL;
    } catch (error) {
      console.warn('生成视频临时播放地址失败:', error.message);
    }
  }
  return video;
}

exports.main = async (event, context) => {
  const { submissionId, expertCode } = event
  const expertId = event.expertId || context.OPENID
  
  try {
    // 获取专家信息，判断评委类型
    let expertType = '';
    let authenticatedExpert;
    if (expertCode) {
      const expertResult = await db.collection('experts')
        .where({ expertCode: expertCode, status: 'active' })
        .get();
      
      if (expertResult.data.length > 0) {
        authenticatedExpert = expertResult.data.find(e => e._id === expertId);
        expertType = authenticatedExpert ? authenticatedExpert.expertType : '';
      }
    }
    
    if (!['preliminary', 'final'].includes(expertType)) throw new Error('专家身份无效');
    // 获取作品详情 - 根据评委类型从不同表读取
    let submissionResult;
    const edition = await resolveEdition(db, {
      editionId: event.editionId || 'pottery-2026',
      mode: 'read'
    });
    if (authenticatedExpert.editionId && authenticatedExpert.editionId !== edition.editionId) throw new Error('专家届次不匹配');
    assertOrientation(authenticatedExpert, edition);
    const cleanedCollection = collectionName(edition, 'cleaned');
    const finalScoringCollection = collectionName(edition, 'finalScoring');
    
    if (expertType === 'final') {
      // 终评评委：从终评评分表读取
      submissionResult = await db.collection(finalScoringCollection)
        .doc(submissionId)
        .get();
    } else {
      // 初评评委：从清洗表读取
      submissionResult = await db.collection(cleanedCollection)
        .doc(submissionId)
        .get();
    }
    
    if (!submissionResult.data) {
      return {
        success: false,
        message: '作品不存在'
      }
    }
    
    const submission = submissionResult.data
    if (event.category && prepareWork(submission).categoryKey !== event.category) throw new Error('该作品不属于当前评审类别');
    const source = expertType === 'final' ? (await db.collection(cleanedCollection).doc(submission.sourceWorkId || submission._id).get()).data : submission;
    if (!source || !eligible(source) || !eligible(submission)) throw new Error('作品已取消资格，不能继续评审');
    const group = prepareWork(source).participantGroup;
    if (group === 'international' || (expertType === 'preliminary' && group !== 'domestic')) throw new Error('该作品不属于本阶段评审范围');
    const playbackVideo = await buildVideoPlaybackInfo(submission)
    
    // 调试：输出原始数据
    console.log('原始作品数据:', {
      id: submission._id,
      artworkName: submission.artworkName,
      dimensions: submission.dimensions,
      dimensionsType: typeof submission.dimensions,
      isArray: Array.isArray(submission.dimensions)
    });
    
    // 检查是否已有评分记录
    let existingGradeScores = {
      themeFit: '',
      creativity: '',
      craftsmanship: '',
      aesthetics: ''
    }

    let existingScores = {
      themeFit: null,
      creativity: null,
      craftsmanship: null,
      aesthetics: null
    }
    
    let existingBaseScore = null;
    let existingDeductions = {};
    if (submission.evaluations && submission.evaluations.length > 0) {
      // 查找当前专家的评分记录
      const expertEvaluation = submission.evaluations.find(eval => 
        eval.expertId === expertId || eval.expertCode === expertCode
      )
      
      if (expertEvaluation) {
        existingBaseScore = expertEvaluation.baseScore ?? expertEvaluation.rawTotalScore ?? expertEvaluation.totalScore ?? null;
        existingDeductions = expertEvaluation.deductions || {};
        existingGradeScores = expertEvaluation.gradeScores || existingGradeScores
        existingScores = {
          themeFit: expertEvaluation.themeFit || 0,
          creativity: expertEvaluation.creativity || 0,
          craftsmanship: expertEvaluation.craftsmanship || 0,
          aesthetics: expertEvaluation.aesthetics || 0
        }
      }
    }
    
    return {
      success: true,
      data: {
        id: submission._id,
        workCode: submission.workCode || submission.submissionNumber || '',
        title: submission.artworkName || submission.title || '未命名作品',
        artworkName: submission.artworkName || submission.title || '未命名作品',
        createYear: submission.createYear || '',
        workType: submission.workType || 'regular', // 添加workType字段，默认为regular
        ...(() => { const { key, name } = normalizeCategory(submission.category); return { category: key, categoryName: name } })(),
        dimensions: (() => {
          // 处理尺寸数据
          if (!submission.dimensions) {
            console.log('dimensions字段不存在');
            return null;
          }
          
          if (Array.isArray(submission.dimensions) && submission.dimensions.length > 0) {
            const firstDimension = submission.dimensions[0];
            console.log('第一组尺寸数据:', firstDimension);
            return firstDimension;
          }
          
          // 如果不是数组，可能是对象格式
          if (typeof submission.dimensions === 'object' && submission.dimensions !== null) {
            console.log('dimensions是对象格式:', submission.dimensions);
            return submission.dimensions;
          }
          
          console.log('dimensions格式不正确:', submission.dimensions);
          return null;
        })(),
        allDimensions: Array.isArray(submission.dimensions) ? submission.dimensions : [], // 返回所有尺寸组
        craftMaterial: submission.craftMaterial || '',
        // 兼容旧字段：保留首图 imageUrl，同时返回所有图片 images
        imageUrl: (submission.artworkImages && submission.artworkImages[0]) || submission.photoUrl || '',
        images: Array.isArray(submission.artworkImages) && submission.artworkImages.length > 0
          ? submission.artworkImages.filter(Boolean)
          : (submission.photoUrl ? [submission.photoUrl] : []),
        // 新增：返回所有图片字段，确保URL完整
        fourViewImages: (submission.fourViewImages || []).filter(url => url && url.trim()), // 四面图（3张）
        perspectiveImage: submission.perspectiveImage || '', // 透视图（1张）
        detailImages: (submission.detailImages || []).filter(url => url && url.trim()), // 局部图（3张）
        // 注意：个人照片 photoUrl 不返回，不在评分页面显示
        description: submission.artworkDescription || submission.description || '',
        artworkDescription: submission.artworkDescription || submission.description || '',
        submitTime: submission.submissionTime || submission.submitTime || null,
        existingGradeScores: existingGradeScores,
        existingScores: existingScores,
        existingDeductions,
        existingBaseScore,
        video: playbackVideo || null,
        videoUrl: (playbackVideo && playbackVideo.tempUrl) || submission.videoUrl || '',
        // 视频作品固定编号
        videoNumber: submission.videoNumber || ''
      },
      edition: publicEdition(edition)
    }
    
  } catch (error) {
    console.error('获取作品详情失败:', error)
    return {
      success: false,
      message: error.message || '获取作品详情失败', code: error.code
    }
  }
}

// 获取分类名称
