const cloud = require('wx-server-sdk');
const { resolveEdition } = require('../common/edition');
const { handleOrientation } = require('../common/reviewOrientation');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event = {}) => {
  try {
    const db = cloud.database();
    const expert = (await db.collection('experts').doc(event.expertId).get()).data;
    if (!expert || expert.expertCode !== event.expertCode || expert.status !== 'active' || !['preliminary','final'].includes(expert.expertType)) throw new Error('专家身份无效');
    const edition = await resolveEdition(db, { editionId: event.editionId || 'pottery-2026', mode: 'read' });
    if (expert.editionId && expert.editionId !== edition.editionId) throw new Error('专家届次不匹配');
    if (!expert.pledgeSigned) return { success: false, code: 'PLEDGE_REQUIRED', message: '请先签署承诺书' };
    return { success: true, data: await handleOrientation(db, cloud, expert, edition, event) };
  } catch (error) { return { success: false, message: error.message }; }
};
