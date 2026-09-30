const cloud = require('wx-server-sdk');
const { publicEdition, resolveEdition } = require('../common/edition');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const db = cloud.database();

  try {
    const edition = await resolveEdition(db, {
      editionId: event.editionId,
      useCurrent: !event.editionId,
      mode: 'read'
    });

    return {
      success: true,
      edition: publicEdition(edition),
      data: publicEdition(edition)
    };
  } catch (error) {
    console.error('获取当前届次失败:', error);
    return {
      success: false,
      errMsg: error.message
    };
  }
};
