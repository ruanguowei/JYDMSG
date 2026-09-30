// cloudfunctions/queryAwardStatus/index.js
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

// 获奖状态列表
const AWARD_STATUS_LIST = ['卓越创作奖', '新锐突破奖', '优秀潜力奖']

/**
 * 查询作品获奖状态
 * 通过手机号+姓名查询作品获奖情况
 */
exports.main = async (event, context) => {
  const {
    phone,  // 手机号
    name,   // 学生姓名
    editionId
  } = event;
  
  try {
    console.log('=== 查询作品获奖状态 ===');
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

    if (!edition.featureFlags || edition.featureFlags.awardQuery !== true) {
      return {
        success: false,
        code: 'AWARD_QUERY_CLOSED',
        message: `${edition.title}获奖结果暂未开放`
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
        shortlistedCertificate: true,
        awardCertificate: true
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
        const status = work.status || '';
        const hasAward = AWARD_STATUS_LIST.includes(status);
        const awardCertificateRecord = work.workCode
          ? certificateMap[`${work.workCode}:${CERTIFICATE_TYPES.AWARD}`]
          : null;
        const shortlistedCertificateRecord = work.workCode
          ? certificateMap[`${work.workCode}:${CERTIFICATE_TYPES.SHORTLISTED}`]
          : null;
        const awardCertificate = normalizeCertificate(awardCertificateRecord, work.awardCertificate || '');
        const shortlistedCertificate = normalizeCertificate(shortlistedCertificateRecord, work.shortlistedCertificate || '');

        return {
          id: work._id,
          workCode: work.workCode || '',
          artworkName: work.artworkName || work.title,
          category: work.category || '',
          school: work.school || '',
          teacher: work.teacher || '',
          shortlisted: true,
          hasAward,
          awardStatus: hasAward ? status : '',
          awardCertificate: awardCertificate ? awardCertificate.fileId : '',
          certificates: {
            shortlisted: shortlistedCertificate,
            award: awardCertificate
          }
        };
      });
      const awardWorks = works.filter(work => work.hasAward);
      const work = awardWorks[0] || works[0];
      const status = work.awardStatus || '';
      
      console.log('作品名称:', work.artworkName || work.title);
      console.log('状态:', status);
      
      // 判断是否获奖
      const hasAward = awardWorks.length > 0;
      
      if (hasAward) {
        // 获奖
        console.log('🏆 作品已获奖:', status);
        
        return {
          success: true,
          hasAward: true,
          awardStatus: awardWorks.length === 1 ? status : '多件作品获奖',
          total: works.length,
          awardCount: awardWorks.length,
          message: awardWorks.length > 1 ? `恭喜！您有 ${awardWorks.length} 件作品获奖` : `恭喜！您的作品荣获${status}`,
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
        // 入围但未获奖
        console.log('📋 作品已入围但未获奖');
        
        return {
          success: true,
          hasAward: false,
          awardStatus: '',
          total: works.length,
          awardCount: 0,
          message: works.length > 1 ? `查询到 ${works.length} 件入围作品，暂未获奖` : '您的作品已入围但未获奖',
          edition: {
            editionId: edition.editionId,
            year: edition.year,
            editionNumber: edition.editionNumber,
            title: edition.title
          },
          works,
          data: work
        };
      }
      
    } else {
      // 未找到记录
      console.log('❌ 未找到作品记录');
      
      return {
        success: true,
        hasAward: false,
        awardStatus: '',
        total: 0,
        awardCount: 0,
        message: '未找到您的作品记录，请确认手机号和姓名是否正确',
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
