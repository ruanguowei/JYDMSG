// cloudfunctions/queryWorkStatus/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const { resolveEdition } = require('../quickstartFunctions/common/edition')
const {
  CERTIFICATE_TYPES,
  fetchActiveCertificates,
  normalizeCertificate
} = require('../common/certificate')

/**
 * 查询作品入围状态
 * 通过手机号+姓名查询作品是否入围
 */
exports.main = async (event, context) => {
  const {
    phone,  // 手机号
    name,   // 学生姓名
    editionId
  } = event;
  
  try {
    console.log('=== 查询作品入围状态 ===');
    console.log('手机号:', phone);
    console.log('姓名:', name);
    
    // 参数验证
    if (!phone || !name) {
      return {
        success: false,
        message: '请输入手机号和姓名'
      };
    }
    
    // 去除手机号和姓名的空格
    const phoneClean = phone.trim();
    const nameClean = name.trim();
    const edition = await resolveEdition(db, {
      editionId: editionId || 'pottery-2026',
      mode: 'read'
    });

    if (!edition.featureFlags || edition.featureFlags.shortlistedQuery !== true) {
      return {
        success: false,
        code: 'SHORTLISTED_QUERY_CLOSED',
        message: `${edition.title}入围结果暂未开放`
      };
    }

    const finalResultsCollection = edition.collectionMap.finalResults || 'pottery_submissions_final';
    
    // 在终评结果表中查询（最终入围的作品）
    const result = await db.collection(finalResultsCollection)
      .where({
        phone: phoneClean,
        name: nameClean
      })
      .field({
        _id: true,
        workCode: true,
        artworkName: true,
        title: true,
        category: true,
        school: true,
        teacher: true,
        status: true,
        shortlisted: true,
        qualification: true,
        shortlistedCertificate: true
      })
      .limit(100)
      .get();
    
    console.log('查询结果数量:', result.data.length);
    
    if (result.data.length > 0) {
      const certificateMap = await fetchActiveCertificates(
        db,
        edition.editionId,
        result.data.map(work => work.workCode)
      );
      const works = result.data.map(work => {
        const certificateRecord = work.workCode
          ? certificateMap[`${work.workCode}:${CERTIFICATE_TYPES.SHORTLISTED}`]
          : null;
        const certificate = normalizeCertificate(certificateRecord, work.shortlistedCertificate || '');

        return {
          id: work._id,
          workCode: work.workCode || '',
          artworkName: work.artworkName || work.title,
          category: work.category || '',
          school: work.school || '',
          teacher: work.teacher || '',
          shortlisted: true,
          awardStatus: work.status || '',
          shortlistedCertificate: certificate ? certificate.fileId : '',
          certificates: {
            shortlisted: certificate
          }
        };
      });
      const work = works[0];
      
      console.log('✅ 作品已入围');
      console.log('作品名称:', work.artworkName || work.title);
      console.log('学校:', work.school);
      
      return {
        success: true,
        qualified: true,
        total: works.length,
        message: works.length > 1 ? `查询到 ${works.length} 件入围作品` : '恭喜！您的作品已入围',
        edition: {
          editionId: edition.editionId,
          year: edition.year,
          editionNumber: edition.editionNumber,
          title: edition.title
        },
        works,
        data: work
      };
      
    } else {
      // 未找到，未入围
      console.log('❌ 作品未入围');
      
      return {
        success: true,
        qualified: false,
        total: 0,
        message: '很遗憾，您的作品未入围',
        edition: {
          editionId: edition.editionId,
          year: edition.year,
          editionNumber: edition.editionNumber,
          title: edition.title
        },
        works: []
      };
    }
    
  } catch (error) {
    console.error('查询失败:', error);
    return {
      success: false,
      message: '查询失败，请重试',
      error: error.message
    };
  }
}



