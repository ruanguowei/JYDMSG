// cloudfunctions/quickstartFunctions/fetchSubmissionsForEvaluation/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const getEvaluationPhase = require('../getEvaluationPhase/index')

/**
 * 判断是否为港澳台作品
 * @param {string} schoolProvinces - 学校省份
 * @returns {boolean} - 是否为港澳台作品
 */
function isHkMacauTaiwan(schoolProvinces) {
  const province = schoolProvinces || '';
  return province === '香港' || province === '澳门' || province === '台湾' ||
         province === '香港特别行政区' || province === '澳门特别行政区' || province === '台湾省';
}

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
    
    // 获取专家信息，判断评委角色
    const expertResult = await db.collection('experts')
      .where({ expertCode: expertCode })
      .get();
    
    if (expertResult.data.length === 0) {
      console.error('专家信息不存在');
      return {
        success: false,
        message: '专家信息不存在'
      };
    }
    
    const expertInfo = expertResult.data[0];
    const expertType = expertInfo.expertType || ''; // 'preliminary' | 'final' | ''
    console.log('专家类型 (expertType):', expertType);
    
    // 所有评委都使用 evaluations 字段
    const targetField = 'evaluations';
    let evaluationRole = '初评评委';
    
    if (expertType === 'final') {
      evaluationRole = '终评评委';
    } else if (expertType === 'preliminary') {
      evaluationRole = '初评评委';
    } else {
      evaluationRole = '评委';
    }
    
    console.log('评委角色:', evaluationRole);
    console.log('评分字段:', targetField);
    
    // 获取作品
    let submissionsResult;
    
    if (expertType === 'final') {
      // 终评评委：从终评评分表读取（已包含480普通+港澳台，不含评分记录）
      console.log('终评评委：从终评评分表读取所有作品');
      
      // 分批读取终评评分表
      const MAX_LIMIT = 100;
      let allWorks = [];
      let skip = 0;
      let hasMore = true;
      
      while (hasMore) {
        const result = await db.collection('pottery_submissions_for_final')
          .skip(skip)
          .limit(MAX_LIMIT)
          .orderBy('submissionTime', 'desc')  // 添加排序：按提交时间倒序，确保所有评委顺序一致
          .get();
        
        allWorks = allWorks.concat(result.data);
        skip += MAX_LIMIT;
        hasMore = result.data.length === MAX_LIMIT;
        
        console.log(`终评评委已读取 ${allWorks.length} 件作品...`);
      }
      
      console.log('终评评委看到的作品总数:', allWorks.length, '件');
      
      submissionsResult = {
        data: allWorks
      };
    } else {
      // 初评评委：显示所有普通作品（排除视界类和港澳台）- 从清洗表读取（分批）
      console.log('初评评委：显示所有普通作品（不含港澳台）');
      
      const MAX_LIMIT = 100;
      let allWorks = [];
      let skip = 0;
      let hasMore = true;
      
      while (hasMore) {
        const result = await db.collection('pottery_submissions_clean')
          .where({
            qualification: db.command.neq(false),
            workType: db.command.in(['regular', 'video']),  // 包含普通作品和视频作品
            category: db.command.nin(['vision', '视界', '视界类']),
            // 排除港澳台作品
            schoolProvinces: db.command.nin(['香港', '澳门', '台湾', '香港特别行政区', '澳门特别行政区', '台湾省'])
          })
          .skip(skip)
          .limit(MAX_LIMIT)
          .orderBy('submissionTime', 'desc')
          .get();
        
        allWorks = allWorks.concat(result.data);
        skip += MAX_LIMIT;
        hasMore = result.data.length === MAX_LIMIT;
        
        console.log(`初评评委已读取 ${allWorks.length} 件作品...`);
      }
      
      submissionsResult = {
        data: allWorks
      };
      
      console.log('初评评委作品总数:', allWorks.length);
    }
    
    const allSubmissions = submissionsResult.data || [];
    console.log('=== 透视图数据过滤 ===');
    console.log('原始作品数量:', allSubmissions.length);
    
    const submissions = allSubmissions
      .map(item => {
        // 检查该作品是否已被当前专家评分（统一使用 evaluations 字段）
        const evaluationsList = item.evaluations || [];
        const isEvaluated = evaluationsList.some(eval => eval.expertCode === expertCode);
        
        // 调试信息：输出评分检查详情
        if (evaluationsList.length > 0) {
          console.log(`作品 ${item.artworkName || item.title} 的评分记录:`, {
            expertType: expertType,
            evaluations: evaluationsList,
            expertCode: expertCode,
            isEvaluated: isEvaluated,
            expertCodes: evaluationsList.map(eval => eval.expertCode)
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
          totalScore: isEvaluated && evaluationsList.length > 0 ? 
            (evaluationsList.find(eval => eval.expertCode === expertCode)?.totalScore || 0) : 0,
          // 添加透视图数据
          perspectiveImage: item.perspectiveImage || '',
          fourViewImages: item.fourViewImages || [],
          detailImages: item.detailImages || [],
          // 添加作品类型和参赛资格字段
          workType: item.workType || 'regular',
          qualification: item.qualification !== false, // 默认为true，除非明确设置为false
          // 添加学校省份字段（用于后台判断港澳台作品）
          schoolProvinces: item.schoolProvinces || '',
          // 添加视频固定编号
          videoNumber: item.videoNumber || ''
        }
      })
      .filter(item => {
        // 显示regular类型和video类型的作品
        if (item.workType !== 'regular' && item.workType !== 'video') {
          console.log(`过滤掉作品 ${item.title}：非regular/video类型`, {
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
        
        // 视频作品不需要图片验证，直接通过
        if (item.workType === 'video') {
          console.log(`视频作品 ${item.title}：直接通过（无需图片）`);
          return true;
        }
        
        // 普通作品：过滤掉没有透视图数据的作品
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
    
    // 只返回未评分的作品
    const unevaluatedSubmissions = submissions.filter(item => !item.isEvaluated);
    
    // 视频作品排在最后：先按workType排序（regular在前，video在后）
    unevaluatedSubmissions.sort((a, b) => {
      // 先按类型排序：regular < video（普通作品在前）
      if (a.workType !== b.workType) {
        if (a.workType === 'regular') return -1;  // regular排在前面
        if (b.workType === 'regular') return 1;
        if (a.workType === 'video') return 1;     // video排在后面
        if (b.workType === 'video') return -1;
      }
      
      // 同类型内按提交时间排序（倒序：新的在前）
      const timeA = a.submitTime || 0;
      const timeB = b.submitTime || 0;
      if (timeA !== timeB) {
        return timeB - timeA;  // 倒序
      }
      
      // 如果提交时间相同，按作品ID排序（确保稳定性）
      return (a.id || '').localeCompare(b.id || '');
    });
    
    const limitedSubmissions = unevaluatedSubmissions.slice(0, 5);  // 只取前5件
    
    // 为每个作品添加顺序编号（从1开始）
    limitedSubmissions.forEach((item, index) => {
      item.orderNumber = index + 1;  // 顺序编号：1, 2, 3, 4, 5...
    });
    
    // 统计视频作品数量
    const regularCount = unevaluatedSubmissions.filter(item => item.workType === 'regular').length;
    const videoCount = unevaluatedSubmissions.filter(item => item.workType === 'video').length;
    console.log('未评分作品分类: 普通作品', regularCount, '件, 视频作品', videoCount, '件');
    
    console.log('总作品数:', submissions.length);
    console.log('未评分作品数:', unevaluatedSubmissions.length);
    console.log('本次返回:', limitedSubmissions.length, '件');
    
    // 输出编号信息
    limitedSubmissions.forEach(item => {
      if (item.workType === 'video' && item.videoNumber) {
        console.log(`编号${item.videoNumber}: 📹视频 - ${item.title} (ID: ${item.id})`);
      } else {
        console.log(`编号${item.orderNumber}: ${item.workType === 'video' ? '📹视频' : '普通'} - ${item.title} (ID: ${item.id})`);
      }
    });
    
    return {
      success: true,
      data: limitedSubmissions,  // 只返回5件未评分的
      // 返回评委信息
      expertInfo: {
        expertType: expertType,
        role: evaluationRole
      },
      // 返回统计信息
      statistics: {
        total: submissions.length,
        evaluated: submissions.filter(item => item.isEvaluated).length,
        unevaluated: unevaluatedSubmissions.length,
        returned: limitedSubmissions.length  // 本次返回的数量
      }
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