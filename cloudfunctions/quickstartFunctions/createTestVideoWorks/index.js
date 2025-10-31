// cloudfunctions/quickstartFunctions/createTestVideoWorks/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 创建测试视频作品
 */
exports.main = async (event, context) => {
  try {
    const { count = 5 } = event;  // 默认创建5件视频作品
    
    console.log('=== 开始创建测试视频作品 ===');
    console.log('创建数量:', count);
    
    const categories = ['technique', 'culture', 'algorithm', 'industry'];
    const categoryNames = {
      'technique': '技艺类',
      'culture': '文脉类',
      'algorithm': '算法类',
      'industry': '产业类'
    };
    
    const provinces = ['江西', '北京', '浙江', '湖南', '广东'];
    const schools = [
      '景德镇陶瓷大学',
      '清华大学',
      '中国美术学院',
      '湖南大学',
      '广州美术学院'
    ];
    
    const videoWorks = [];
    
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      const province = provinces[i % provinces.length];
      const school = schools[i % schools.length];
      
      const videoWork = {
        // 基本信息
        artworkName: `测试视频作品${i + 1}`,
        name: `测试学生${i + 1}`,
        school: school,
        schoolProvinces: province,
        
        // 分类信息
        category: categoryNames[category],
        createYear: '2024',
        
        // 作品信息
        artworkDescription: `这是第${i + 1}件测试视频作品的简介。本作品展示了${categoryNames[category]}的独特魅力，运用创新技术手段进行创作。`,
        craftMaterial: '综合材料',
        
        // 重要：标记为视频作品
        workType: 'video',
        
        // 参赛资格
        qualification: true,
        
        // 提交时间（递减，保证顺序）
        submissionTime: new Date(Date.now() - i * 3600000),  // 每件相差1小时
        
        // 初始评分为空
        evaluations: [],
        
        // 其他字段
        _openid: 'test_openid_video_' + i,
        _createdAt: new Date()
      };
      
      videoWorks.push(videoWork);
    }
    
    // 批量插入到清洗表
    const insertPromises = videoWorks.map(work => 
      db.collection('pottery_submissions_clean').add({ data: work })
    );
    
    await Promise.all(insertPromises);
    
    console.log('');
    console.log('=== ✅ 测试视频作品创建完成 ===');
    console.log('创建数量:', videoWorks.length, '件');
    console.log('已写入清洗表: pottery_submissions_clean');
    console.log('');
    
    // 输出创建的作品信息
    videoWorks.forEach((work, index) => {
      console.log(`视频作品${index + 1}:`, {
        名称: work.artworkName,
        分类: work.category,
        学校: work.school,
        省份: work.schoolProvinces
      });
    });
    
    return {
      success: true,
      message: `成功创建 ${videoWorks.length} 件测试视频作品`,
      data: {
        createdCount: videoWorks.length,
        works: videoWorks.map(w => ({
          name: w.artworkName,
          category: w.category,
          school: w.school,
          province: w.schoolProvinces
        }))
      }
    };
    
  } catch (error) {
    console.error('创建测试视频作品失败:', error);
    return {
      success: false,
      message: '创建测试视频作品失败: ' + error.message,
      error: error.message
    };
  }
}






