// 云函数：fetchCatalogWorks
// 独立云函数 - 按分类分页获取作品列表
// 高频访问场景优化：支持分页加载，减少单次数据量

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { 
    category,      // 分类名称
    page = 0,      // 页码（从0开始）
    pageSize = 20  // 每页数量
  } = event;

  try {
    console.log('[fetchCatalogWorks] category:', category, 'page:', page, 'pageSize:', pageSize);
    const startTime = Date.now();

    if (!category) {
      return { success: false, message: '缺少 category 参数' };
    }

    const skip = page * pageSize;

    const result = await db.collection('secondWorks')
      .where({ category: category })
      .orderBy('artworkName', 'asc')
      .skip(skip)
      .limit(pageSize)
      .field({
        _id: true,
        artworkName: true,
        name: true,         // 对应 authorName
        school: true,       // 对应 schoolName
        teacher: true,      // 对应 advisorName
        artworkDescription: true,
        perspectiveImage: true,
        dimensions: true,
        craftMaterial: true,
        createYear: true,
        category: true
      })
      .get();

    // 字段映射
    const mappedData = result.data.map(item => ({
      ...item,
      authorName: item.name,
      schoolName: item.school,
      advisorName: item.teacher
    }));

    const duration = Date.now() - startTime;
    console.log('[fetchCatalogWorks] 获取', result.data.length, '条数据，耗时:', duration, 'ms');

    return {
      success: true,
      data: {
        works: mappedData,
        page: page,
        pageSize: pageSize,
        hasMore: result.data.length === pageSize
      }
    };

  } catch (error) {
    console.error('[fetchCatalogWorks] 错误:', error);
    return {
      success: false,
      message: error.message || '获取作品列表失败'
    };
  }
};
