// 云函数：fetchCatalogData
// 用于获取作品画册数据

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 分类顺序配置
const CATEGORY_ORDER = ['技艺', '文脉', '算法', '产业', '视界'];

/**
 * 获取画册数据
 * stage: 
 *   - 'index': 获取索引信息（分类统计 + 轻量级作品列表）
 *   - 'category': 获取某分类的完整作品列表
 *   - 'detail': 获取单个作品详情
 */
exports.main = async (event, context) => {
  const { stage = 'index', category, workId, page = 0, pageSize = 100 } = event;

  try {
    console.log('[fetchCatalogData] stage:', stage, 'category:', category);

    switch (stage) {
      case 'index':
        return await fetchIndex();
      case 'category':
        return await fetchCategoryWorks(category, page, pageSize);
      case 'detail':
        return await fetchWorkDetail(workId);
      default:
        return { success: false, message: '未知的 stage 参数' };
    }
  } catch (error) {
    console.error('[fetchCatalogData] 错误:', error);
    return {
      success: false,
      message: error.message || '获取数据失败'
    };
  }
};

/**
 * 获取索引信息
 * 返回：分类统计 + 所有作品的轻量级列表（用于构建目录）
 */
async function fetchIndex() {
  console.log('[fetchIndex] 开始获取索引数据');

  // 1. 获取所有作品的轻量级信息
  const allWorks = [];
  let lastId = '';
  const batchSize = 100;

  // 分批获取所有数据（微信云数据库单次最多100条）
  while (true) {
    let query = db.collection('secondWorks')
      .orderBy('_id', 'asc')
      .limit(batchSize);
    
    if (lastId) {
      query = query.where({
        _id: db.command.gt(lastId)
      });
    }

    const result = await query.field({
      _id: true,
      artworkName: true,
      authorName: true,
      schoolName: true,
      advisorName: true,
      artworkDescription: true,
      perspectiveImage: true,
      dimensions: true,
      craftMaterial: true,
      category: true
    }).get();

    if (result.data.length === 0) break;

    allWorks.push(...result.data);
    lastId = result.data[result.data.length - 1]._id;

    console.log(`[fetchIndex] 已获取 ${allWorks.length} 条数据`);

    if (result.data.length < batchSize) break;
  }

  console.log('[fetchIndex] 总作品数:', allWorks.length);

  // 2. 按分类统计
  const categoryStats = {};
  CATEGORY_ORDER.forEach(cat => {
    categoryStats[cat] = 0;
  });

  allWorks.forEach(work => {
    const cat = work.category;
    if (cat && categoryStats.hasOwnProperty(cat)) {
      categoryStats[cat]++;
    }
  });

  // 3. 按分类顺序排序作品
  const sortedWorks = [];
  CATEGORY_ORDER.forEach(cat => {
    const catWorks = allWorks.filter(w => w.category === cat);
    // 按作品名称排序（可选）
    catWorks.sort((a, b) => (a.artworkName || '').localeCompare(b.artworkName || ''));
    sortedWorks.push(...catWorks);
  });

  // 4. 构建分类信息
  const categories = CATEGORY_ORDER.map(cat => ({
    category: cat,
    count: categoryStats[cat]
  }));

  console.log('[fetchIndex] 分类统计:', categories);

  return {
    success: true,
    data: {
      categories: categories,
      works: sortedWorks,
      totalCount: allWorks.length
    }
  };
}

/**
 * 获取某分类的作品列表
 */
async function fetchCategoryWorks(category, page, pageSize) {
  if (!category) {
    return { success: false, message: '缺少 category 参数' };
  }

  console.log('[fetchCategoryWorks] category:', category, 'page:', page);

  const skip = page * pageSize;

  const result = await db.collection('secondWorks')
    .where({ category: category })
    .orderBy('artworkName', 'asc')
    .skip(skip)
    .limit(pageSize)
    .field({
      _id: true,
      artworkName: true,
      authorName: true,
      schoolName: true,
      advisorName: true,
      artworkDescription: true,
      perspectiveImage: true,
      dimensions: true,
      craftMaterial: true,
      category: true
    })
    .get();

  return {
    success: true,
    data: {
      works: result.data,
      hasMore: result.data.length === pageSize
    }
  };
}

/**
 * 获取单个作品详情
 */
async function fetchWorkDetail(workId) {
  if (!workId) {
    return { success: false, message: '缺少 workId 参数' };
  }

  console.log('[fetchWorkDetail] workId:', workId);

  const result = await db.collection('secondWorks')
    .doc(workId)
    .get();

  if (!result.data) {
    return { success: false, message: '作品不存在' };
  }

  return {
    success: true,
    data: result.data
  };
}
