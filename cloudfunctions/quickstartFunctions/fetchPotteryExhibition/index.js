// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database()
  
  try {
    // 查询pottery_exhibition集合中的数据
    const exhibitionData = await db.collection('pottery_exhibition')
      .get()
    
    // 处理云存储图片链接
    let imageURL = '';
    if (exhibitionData.data.length > 0 && exhibitionData.data[0].imageURL) {
      try {
        // 如果是云存储文件ID，则获取临时访问链接
        if (exhibitionData.data[0].imageURL.startsWith('cloud://')) {
          const fileID = exhibitionData.data[0].imageURL;
          const result = await cloud.getTempFileURL({
            fileList: [fileID]
          });
          
          if (result.fileList && result.fileList[0] && result.fileList[0].tempFileURL) {
            imageURL = result.fileList[0].tempFileURL;
          }
        } else {
          // 如果已经是可访问的URL，直接使用
          imageURL = exhibitionData.data[0].imageURL;
        }
      } catch (fileError) {
        console.error('获取图片临时链接失败', fileError);
        // 如果获取临时链接失败，仍然使用原始链接
        imageURL = exhibitionData.data[0].imageURL || '';
      }
    }
    
    // 获取展览数据（从数据库获取，如果不存在则使用默认值）
    const firstItem = exhibitionData.data.length > 0 ? exhibitionData.data[0] : {};
    const exhibition = {
      title: firstItem.title || '2024景德镇国际大陶展',
      description: firstItem.description || '景德镇国际大陶展是展示陶瓷艺术的国际性平台，汇集世界各地的优秀陶瓷艺术作品。欢迎艺术家和爱好者参与此次盛会，共同探索陶瓷艺术的无限可能。',
      bannerImageUrl: imageURL
    }
    
    // 获取活动安排（如果数据库中存在则使用，否则使用默认值）
    let schedules = [];
    if (firstItem.schedules && Array.isArray(firstItem.schedules) && firstItem.schedules.length > 0) {
      schedules = firstItem.schedules;
    } else {
      // 默认活动安排
      schedules = [
        {
          date: '5月1日',
          event: '开幕式',
          desc: '国际陶瓷艺术大师见面会及作品展示'
        },
        {
          date: '5月15日',
          event: '陶艺工作坊',
          desc: '专业陶艺家现场教学，零基础可参与'
        },
        {
          date: '6月10日',
          event: '评选活动',
          desc: '最佳陶瓷作品评选及颁奖仪式'
        }
      ];
    }

    return {
      success: true,
      data: {
        exhibition,
        schedules,
        rawExhibitionData: exhibitionData.data // 返回原始数据，以便前端可以使用更多字段
      }
    }
  } catch (error) {
    console.error('获取展览数据失败', error)
    return {
      success: false,
      errMsg: '获取展览数据失败：' + error.message
    }
  }
} 