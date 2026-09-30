// 云函数：fetchCatalogIndex
// 独立云函数 - 获取画册索引信息（分类统计 + 轻量级作品列表）
// 高频访问场景优化：独立部署，减少单点压力

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 分类顺序配置
const CATEGORY_ORDER = ['技艺', '文脉', '算法', '产业', '视界'];

exports.main = async (event, context) => {
  try {
    console.log('[fetchCatalogIndex] 开始获取索引数据');
    const startTime = Date.now();

    // 获取所有作品的轻量级信息
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
        name: true,         // 对应 authorName
        school: true,       // 对应 schoolName
        teacher: true,      // 对应 advisorName
        artworkDescription: true,
        perspectiveImage: true,
        dimensions: true,
        craftMaterial: true,
        createYear: true,
        category: true
      }).get();

      if (result.data.length === 0) break;

      // 字段映射
      const mappedData = result.data.map(item => ({
        _id: item._id,
        artworkName: item.artworkName,
        authorName: item.name,
        schoolName: item.school,
        advisorName: item.teacher,
        artworkDescription: item.artworkDescription,
        perspectiveImage: item.perspectiveImage,
        dimensions: item.dimensions,
        craftMaterial: item.craftMaterial,
        createYear: item.createYear,
        category: item.category
      }));

      allWorks.push(...mappedData);
      lastId = result.data[result.data.length - 1]._id;

      if (result.data.length < batchSize) break;
    }

    console.log('[fetchCatalogIndex] 总作品数:', allWorks.length);

    // 按分类统计
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

    // 按分类顺序排序作品
    const sortedWorks = [];
    CATEGORY_ORDER.forEach(cat => {
      const catWorks = allWorks.filter(w => w.category === cat);
      // 按作品名称排序
      catWorks.sort((a, b) => (a.artworkName || '').localeCompare(b.artworkName || ''));
      sortedWorks.push(...catWorks);
    });

    // 构建分类信息
    const categories = CATEGORY_ORDER.map(cat => ({
      category: cat,
      count: categoryStats[cat]
    }));

    const duration = Date.now() - startTime;
    console.log('[fetchCatalogIndex] 完成，耗时:', duration, 'ms');

    return {
      success: true,
      data: {
        categories: categories,
        works: sortedWorks,
        totalCount: allWorks.length
      }
    };

  } catch (error) {
    console.error('[fetchCatalogIndex] 错误:', error);
    return {
      success: false,
      message: error.message || '获取索引数据失败'
    };
  }
};
