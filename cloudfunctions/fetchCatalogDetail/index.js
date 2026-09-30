// 云函数：fetchCatalogDetail
// 独立云函数 - 获取单个作品详情
// 高频访问场景优化：轻量级查询，快速响应

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { workId } = event;

  try {
    console.log('[fetchCatalogDetail] workId:', workId);
    const startTime = Date.now();

    if (!workId) {
      return { success: false, message: '缺少 workId 参数' };
    }

    const result = await db.collection('secondWorks')
      .doc(workId)
      .get();

    if (!result.data) {
      return { success: false, message: '作品不存在' };
    }

    // 字段映射
    const data = result.data;
    data.authorName = data.name;
    data.schoolName = data.school;
    data.advisorName = data.teacher;

    const duration = Date.now() - startTime;
    console.log('[fetchCatalogDetail] 完成，耗时:', duration, 'ms');

    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('[fetchCatalogDetail] 错误:', error);
    return {
      success: false,
      message: error.message || '获取作品详情失败'
    };
  }
};
