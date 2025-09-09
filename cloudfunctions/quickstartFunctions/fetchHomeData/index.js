// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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
    const announcements = announcementsResult.data.map(item => ({
      _id: item._id,
      title: item.ggbt,
      content: item.ggnr,
      expireTime: item.gqsj,
      status: item.zt ? 'active' : 'inactive'
    }));
    
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