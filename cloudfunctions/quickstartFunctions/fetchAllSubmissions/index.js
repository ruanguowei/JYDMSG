// 云函数获取所有参展申请记录
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  // 如果没有openid，则返回错误
  if (!openid) {
    return {
      success: false,
      errMsg: '用户未登录'
    };
  }
  
  try {
    console.log('当前用户openid:', openid);
    
    // 获取用户所有的参展申请记录
    // 按更新时间降序排列，最新的在最前面
    const submissionsResult = await db.collection('pottery_submissions')
      .where({
        _openid: openid // 修改为标准的_openid字段
      })
      .orderBy('updatedAt', 'desc')
      .get();
    
    // 格式化数据
    const submissions = submissionsResult.data.map(item => {
      
      // 处理作品图片字段 - 合并所有图片类型
      const artworkImages = [];
      
      // 添加透视图
      if (item.perspectiveImage) {
        artworkImages.push(item.perspectiveImage);
      }
      
      // 添加四面图
      if (item.fourViewImages && Array.isArray(item.fourViewImages)) {
        artworkImages.push(...item.fourViewImages.filter(img => img && img.trim()));
      }
      
      // 添加局部图
      if (item.detailImages && Array.isArray(item.detailImages)) {
        artworkImages.push(...item.detailImages.filter(img => img && img.trim()));
      }
      
      // 如果没有分类图片，尝试使用旧的photoUrl字段
      if (artworkImages.length === 0 && item.photoUrl) {
        artworkImages.push(item.photoUrl);
      }
      
      return {
        ...item,
        // 确保作品信息字段存在
        artworkName: item.artworkName || item.title || '未命名作品',
        artworkDescription: item.artworkDescription || item.description || '',
        artworkImages: artworkImages,
        // 确保尺寸信息正确显示
        length: item.dimensions && item.dimensions[0] ? item.dimensions[0].length : item.length,
        width: item.dimensions && item.dimensions[0] ? item.dimensions[0].width : item.width,
        height: item.dimensions && item.dimensions[0] ? item.dimensions[0].height : item.height,
        // 添加完整的尺寸数组数据
        allDimensions: Array.isArray(item.dimensions) ? item.dimensions : (item.dimensions ? [item.dimensions] : []),
        // 确保分类信息正确显示
        category: item.category || '未分类',
        // 确保视频作品字段存在
        workType: item.workType || 'regular',
        videoDuration: item.videoDuration || '',
        videoResolution: item.videoResolution || '',
        videoAspectRatio: item.videoAspectRatio || '',
        shootingTechnique: item.shootingTechnique || '',
        baiduCloudLink: item.baiduCloudLink || '',
        baiduCloudPassword: item.baiduCloudPassword || '',
        specialDisplay: item.specialDisplay || ''
      };
    });
    
    console.log('获取到的记录数量:', submissions.length);
    
    return {
      success: true,
      data: submissions
    };
  } catch (err) {
    console.error('获取参展申请记录失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取参展申请记录失败'
    };
  }
}; 