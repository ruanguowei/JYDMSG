// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 解析公告内容，提取结构化信息
function parseAnnouncementContent(content) {
  if (!content) {
    return {
      content: '',
      theme: '',
      sections: '',
      registrationMethod: '',
      contactPhone: '',
      contactPerson: ''
    };
  }

  const result = {
    content: content,
    theme: '',
    sections: '',
    registrationMethod: '',
    contactPhone: '',
    contactPerson: '',
    pdfFiles: [],
    attachments: []
  };

  // 提取活动主题
  const themeMatch = content.match(/活动主题[：:]\s*([^\n\r]+)/);
  if (themeMatch) {
    result.theme = themeMatch[1].trim();
  }

  // 提取活动板块
  const sectionsMatch = content.match(/活动板块[：:]\s*([^\n\r]+)/);
  if (sectionsMatch) {
    result.sections = sectionsMatch[1].trim();
  }

  // 征集截止时间提取已移除

  // 提取报名方法
  const registrationMatch = content.match(/报名方法[：:]\s*([^\n\r]+)/);
  if (registrationMatch) {
    result.registrationMethod = registrationMatch[1].trim();
  }

  // 提取咨询电话
  const phoneMatch = content.match(/咨询电话[：:]\s*([0-9\-\s]+)/);
  if (phoneMatch) {
    result.contactPhone = phoneMatch[1].trim();
  }

  // 提取联系人
  const personMatch = content.match(/咨询电话[：:]\s*[0-9\-\s]+\s*([^\n\r]+)/);
  if (personMatch) {
    result.contactPerson = personMatch[1].trim();
  }

  return result;
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { fetchType = 'all' } = event;
    let bannersResult = { data: [] };
    let announcementsResult = { data: [] };

    // 获取公告数据
    if (fetchType === 'all' || fetchType === 'announcements') {
      announcementsResult = await db.collection('announcements')
        .where({
          zt: true // 仅筛选活跃状态，暂时忽略过期时间条件
        })
        .orderBy('_createTime', 'desc')
        .limit(5)
        .get()
        .catch(err => {
          console.error("获取公告数据失败:", err);
          return { data: [] };
        });
    }

    // 只有在需要获取全部数据或明确指定获取轮播图时才获取轮播图
    if (fetchType === 'all' || fetchType === 'banners') {
      bannersResult = await db.collection('banners')
        .where({
          zt: true // 使用布尔值true表示活跃状态
        })
        .orderBy('px', 'asc') // 使用排序字段px
        .limit(5)
        .get()
        .catch(err => {
          console.error("获取轮播图数据失败:", err);
          return { data: [] };
        });
    }
    
    // 处理轮播图云存储链接
    let banners = bannersResult.data.map(item => ({
      _id: item._id,
      imageUrl: item.lbttp || '',
      title: item.bt,
      order: item.px || 0,
      status: item.zt ? 'active' : 'inactive'
    }));

    // 如果有云存储图片路径，获取临时访问链接
    const cloudFileIDs = banners
      .filter(banner => banner.imageUrl && banner.imageUrl.startsWith('cloud://'))
      .map(banner => banner.imageUrl);
    
    if (cloudFileIDs.length > 0) {
      try {
        const result = await cloud.getTempFileURL({
          fileList: cloudFileIDs
        });
        
        // 映射临时URL到对应的banner
        const fileIDToTempURL = {};
        result.fileList.forEach(file => {
          if (file.tempFileURL) {
            fileIDToTempURL[file.fileID] = file.tempFileURL;
          }
        });
        
        // 更新banners数组中的图片URL
        banners = banners.map(banner => {
          if (banner.imageUrl && banner.imageUrl.startsWith('cloud://') && fileIDToTempURL[banner.imageUrl]) {
            banner.imageUrl = fileIDToTempURL[banner.imageUrl];
          }
          return banner;
        });
      } catch (error) {
        console.error("获取临时文件URL失败:", error);
      }
    }
    
    // 映射公告数据
    const announcements = announcementsResult.data.map(item => {
      // 解析公告内容，提取结构化信息
      const content = item.ggnr || '';
      const parsedContent = parseAnnouncementContent(content);
      
      // 为"2025大陶展征集与报名提醒"添加PDF文件
      let pdfFiles = item.pdfFiles || [];
      if (item.ggbt && item.ggbt.includes('2025大陶展征集与报名提醒')) {
        pdfFiles = [{
          name: '关于邀请参加第二届全国大学生陶艺作品展的函',
          url: 'cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268/首页资料/关于邀请参加第二届全国大学生陶艺作品展的函.pdf',
          size: '2.5MB',
          type: 'pdf'
        }];
      }
      
      return {
        _id: item._id,
        title: item.ggbt,
        content: parsedContent.content,
        theme: parsedContent.theme,
        sections: parsedContent.sections,
        registrationMethod: parsedContent.registrationMethod,
        contactPhone: parsedContent.contactPhone,
        contactPerson: parsedContent.contactPerson,
        pdfFiles: pdfFiles,
        attachments: item.attachments || [],
        expireTime: item.gqsj,
        createTime: item._createTime ? new Date(item._createTime).toLocaleString('zh-CN') : '',
        status: item.zt ? 'active' : 'inactive'
      };
    });
    
    return {
      success: true,
      data: {
        banners: banners,
        announcements: announcements
      }
    }
  } catch (e) {
    console.error("云函数执行错误:", e);
    return {
      success: false,
      errMsg: e,
      data: {
        banners: [],
        announcements: []
      }
    }
  }
} 