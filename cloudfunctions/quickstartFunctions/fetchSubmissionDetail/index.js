// cloudfunctions/quickstartFunctions/fetchSubmissionDetail/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { submissionId } = event
  const expertId = event.expertId || context.OPENID
  
  try {
    // 获取作品详情
    const submissionResult = await db.collection('pottery_submissions')
      .doc(submissionId)
      .get()
    
    if (!submissionResult.data) {
      return {
        success: false,
        message: '作品不存在'
      }
    }
    
    const submission = submissionResult.data
    
    // 调试：输出原始数据
    console.log('原始作品数据:', {
      id: submission._id,
      artworkName: submission.artworkName,
      dimensions: submission.dimensions,
      dimensionsType: typeof submission.dimensions,
      isArray: Array.isArray(submission.dimensions)
    });
    
    // 检查是否已有评分记录
    let existingScores = {
      themeFit: 3, // 默认满分
      creativity: 3, // 默认满分
      craftsmanship: 2, // 默认满分
      aesthetics: 2 // 默认满分
    }
    
    if (submission.evaluations && submission.evaluations.length > 0) {
      // 查找当前专家的评分记录
      const expertEvaluation = submission.evaluations.find(eval => 
        eval.expertId === expertId
      )
      
      if (expertEvaluation) {
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
        existingScores: existingScores
      }
    }
    
  } catch (error) {
    console.error('获取作品详情失败:', error)
    return {
      success: false,
      message: '获取作品详情失败'
    }
  }
}

// 获取分类名称
function getCategoryName(category) {
  const { name } = normalizeCategory(category)
  return name
}

function normalizeCategory(category) {
  const map = {
    'technique': '技艺类', '技艺': '技艺类', '技艺类': '技艺类',
    'culture': '文脉类', '文脉': '文脉类', '文脉类': '文脉类',
    'algorithm': '算法类', '算法': '算法类', '算法类': '算法类',
    'industry': '产业类', '产业': '产业类', '产业类': '产业类',
    'vision': '视界类', '视界': '视界类', '视界类': '视界类'
  }
  const raw = (category || '').toString().replace(/[\s\u3000]+/g, '')
  const lower = raw.toLowerCase()
  const keyGuess = {
    'technique': 'technique',
    'culture': 'culture',
    'algorithm': 'algorithm',
    'industry': 'industry',
    'vision': 'vision'
  }[lower]
  const name = map[raw] || map[keyGuess] || '未知分类'
  const reverse = {
    '技艺类': 'technique',
    '文脉类': 'culture',
    '算法类': 'algorithm',
    '产业类': 'industry',
    '视界类': 'vision'
  }
  const key = reverse[name] || ''
  return { key, name }
}
