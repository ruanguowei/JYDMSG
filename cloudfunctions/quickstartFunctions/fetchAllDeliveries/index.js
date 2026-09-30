const cloud = require('wx-server-sdk');
const { collectionName, publicEdition, resolveEdition } = require('../common/edition');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizeImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }
  return [];
}

function safeDelivery(record) {
  return {
    ...record,
    packageImages: normalizeImages(record.packageImages),
    artworkImages: normalizeImages(record.artworkImages)
  };
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { success: false, errMsg: '用户未登录' };

  try {
    const edition = await resolveEdition(db, {
      editionId: event.editionId,
      useCurrent: !event.editionId,
      mode: 'read'
    });
    const deliveriesCollection = collectionName(edition, 'deliveries');
    let query = db.collection(deliveriesCollection).where({ _openid: openid });
    if (event.deliveryId) {
      query = db.collection(deliveriesCollection).where({ _id: event.deliveryId, _openid: openid });
    }
    const result = await query.orderBy('updatedAt', 'desc').get();
    return {
      success: true,
      edition: publicEdition(edition),
      data: (result.data || []).map(safeDelivery)
    };
  } catch (error) {
    console.error('获取运送记录失败:', error.message);
    return { success: false, errMsg: error.message || '获取运送记录失败' };
  }
};
