// cloudfunctions/quickstartFunctions/fetchSubmissionsForEvaluation/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 从event中获取专家Code
    const expertCode = event.expertCode
    
    // 调试信息：输出专家Code信息
    console.log('=== 云函数调试信息 ===');
    console.log('传入的expertCode:', event.expertCode);
    console.log('最终使用的expertCode:', expertCode);
    console.log('expertCode类型:', typeof expertCode);
    console.log('====================');
    
    // 获取作品（放宽条件，避免因为状态枚举差异取不到数据）
    const submissionsResult = await db.collection('pottery_submissions')
      .orderBy('submissionTime', 'desc')
      .get()
    
    const allSubmissions = submissionsResult.data || [];
    console.log('=== 透视图数据过滤 ===');
    console.log('原始作品数量:', allSubmissions.length);
    
    const submissions = allSubmissions
      .map(item => {
        // 检查该作品是否已被当前专家评分（使用expertCode进行匹配）
        const isEvaluated = item.evaluations && item.evaluations.some(eval => 
          eval.expertCode === expertCode
        )
        
        // 调试信息：输出评分检查详情
        if (item.evaluations && item.evaluations.length > 0) {
          console.log(`作品 ${item.artworkName || item.title} 的评分记录:`, {
            evaluations: item.evaluations,
            expertCode: expertCode,
            isEvaluated: isEvaluated,
            expertCodes: item.evaluations.map(eval => eval.expertCode)
          });
        }
        
        const { key: categoryKey, name: categoryName } = normalizeCategory(item.category)

        return {
          id: item._id,
          title: item.artworkName || item.title || '未命名作品',
          category: categoryKey,
          categoryName: categoryName,
          // 优先使用透视图，其次使用四面图第一张，最后使用其他图片
          imageUrl: item.perspectiveImage || 
                   (item.fourViewImages && item.fourViewImages[0]) || 
                   (item.artworkImages && item.artworkImages[0]) || 
                   (item.detailImages && item.detailImages[0]) || 
                   item.photoUrl || '',
          description: item.artworkDescription || item.description || '',
          submitTime: item.submissionTime || item.submitTime || null,
          isEvaluated: isEvaluated,
          totalScore: isEvaluated ? 
            item.evaluations.find(eval => eval.expertCode === expertCode).totalScore : 0,
          // 添加透视图数据
          perspectiveImage: item.perspectiveImage || '',
          fourViewImages: item.fourViewImages || [],
          detailImages: item.detailImages || [],
          // 添加作品类型和参赛资格字段
          workType: item.workType || 'regular',
          qualification: item.qualification !== false // 默认为true，除非明确设置为false
        }
      })
      .filter(item => {
        // 只显示regular类型的作品
        if (item.workType !== 'regular') {
          console.log(`过滤掉作品 ${item.title}：非regular类型`, {
            workType: item.workType
          });
          return false;
        }
        
        // 只显示有参赛资格的作品
        if (!item.qualification) {
          console.log(`过滤掉作品 ${item.title}：无参赛资格`, {
            qualification: item.qualification
          });
          return false;
        }
        
        // 过滤掉没有透视图数据的作品
        const hasPerspectiveImage = item.perspectiveImage && item.perspectiveImage.trim() !== '';
        const hasFourViewImages = item.fourViewImages && item.fourViewImages.length > 0;
        const hasDetailImages = item.detailImages && item.detailImages.length > 0;
        
        // 至少要有透视图或四面图或局部图之一
        const hasValidImages = hasPerspectiveImage || hasFourViewImages || hasDetailImages;
        
        if (!hasValidImages) {
          console.log(`过滤掉作品 ${item.title}：缺少透视图数据`, {
            perspectiveImage: item.perspectiveImage,
            fourViewImages: item.fourViewImages,
            detailImages: item.detailImages
          });
        }
        
        return hasValidImages;
      })
    
    console.log('过滤后作品数量:', submissions.length);
    console.log('过滤掉的作品数量:', allSubmissions.length - submissions.length);
    console.log('====================');
    
    return {
      success: true,
      data: submissions
    }
    
  } catch (error) {
    console.error('获取待评选作品失败:', error)
    return {
      success: false,
      message: '获取作品列表失败'
    }
  }
}

// 获取分类名称
function getCategoryName(category) {
  const categoryMap = {
    'technique': '技艺类',
    'culture': '文脉类', 
    'algorithm': '算法类',
    'industry': '产业类',
    'vision': '视界类'
  }
  const { name } = normalizeCategory(category)
  return name
}

function normalizeCategory(category) {
  // 返回统一英文key与中文名
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