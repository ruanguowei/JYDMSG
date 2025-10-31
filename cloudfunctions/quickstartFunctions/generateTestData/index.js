// cloudfunctions/quickstartFunctions/generateTestData/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 批量生成测试数据
 * 用于测试不同的评选阶段
 */
exports.main = async (event, context) => {
  try {
    const { 
      totalCount = 400,  // 总数量（默认400件，用于测试直接终评）
      includeHkMacauTaiwan = true,  // 是否包含港澳台作品
      includeVision = true  // 是否包含视界类作品
    } = event;
    
    console.log('=== 开始生成测试数据 ===');
    console.log('目标总数:', totalCount);
    console.log('包含港澳台:', includeHkMacauTaiwan);
    console.log('包含视界类:', includeVision);
    
    const categories = [
      { key: 'technique', name: '技艺类' },
      { key: 'culture', name: '文脉类' },
      { key: 'algorithm', name: '算法类' },
      { key: 'industry', name: '产业类' }
    ];
    
    const provinces = [
      '北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '陕西',
      '山东', '河南', '湖南', '福建', '辽宁', '吉林', '黑龙江', '安徽',
      '江西', '重庆', '天津', '河北', '山西', '内蒙古', '广西', '海南',
      '贵州', '云南', '西藏', '甘肃', '青海', '宁夏', '新疆'
    ];
    
    const schools = [
      '清华大学', '北京大学', '复旦大学', '浙江大学', '南京大学',
      '上海交通大学', '中国科学技术大学', '武汉大学', '华中科技大学',
      '四川大学', '中山大学', '西安交通大学', '哈尔滨工业大学',
      '同济大学', '南开大学', '天津大学', '北京师范大学',
      '中国美术学院', '中央美术学院', '景德镇陶瓷大学'
    ];
    
    const firstNames = ['张', '王', '李', '刘', '陈', '杨', '黄', '赵', '周', '吴'];
    const lastNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];
    
    const promises = [];
    let regularCount = totalCount;
    let visionCount = 0;
    let hkMacauTaiwanCount = 0;
    
    // 计算各类作品数量
    if (includeVision) {
      visionCount = 30;
      regularCount -= 30;
    }
    
    if (includeHkMacauTaiwan) {
      hkMacauTaiwanCount = 20;
      regularCount -= 20;
    }
    
    console.log('将生成:');
    console.log('- 普通作品:', regularCount, '件');
    console.log('- 港澳台作品:', hkMacauTaiwanCount, '件');
    console.log('- 视界类作品:', visionCount, '件');
    
    let currentIndex = 0;
    
    // 生成普通作品
    for (let i = 0; i < regularCount; i++) {
      const category = categories[i % categories.length];
      const province = provinces[i % provinces.length];
      const school = schools[i % schools.length];
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      
      const testData = {
        // 基本信息
        name: firstName + lastName + currentIndex,
        gender: i % 2 === 0 ? '男' : '女',
        school: school,
        schoolProvinces: province,
        grade: ['大一', '大二', '大三', '大四', '研一', '研二', '研三'][i % 7],
        birthDate: `199${5 + i % 5}-${String((i % 12) + 1).padStart(2, '0')}`,
        major: '陶瓷艺术设计',
        phone: `138${String(i).padStart(8, '0')}`,
        email: `test${i}@example.com`,
        
        // 指导老师
        teacher: `导师${i % 50}`,
        teacherPhone: `139${String(i).padStart(8, '0')}`,
        
        // 地址
        address: `${province}某市某区某路${i}号`,
        
        // 作品信息
        artworkName: `${category.name}作品${currentIndex}`,
        category: category.key,
        createYear: '2025',
        
        // 作品尺寸（支持多组）
        dimensions: [
          {
            length: String(20 + i % 30),
            width: String(15 + i % 25),
            height: String(10 + i % 20)
          }
        ],
        
        // 工艺材料
        craftMaterial: `瓷土、釉料、${1200 + i % 200}°C烧制`,
        
        // 作品简介
        artworkDescription: `这是${category.name}测试作品${currentIndex}。作品融合了传统陶艺技法与现代设计理念，体现了"天工开物·智韵瓷章"的主题。创作灵感来源于中国传统文化，通过陶瓷材料展现独特的艺术表现力。`,
        
        // 图片（使用占位图）
        perspectiveImage: `https://via.placeholder.com/800x600/4a90e2/ffffff?text=Perspective+${currentIndex}`,
        fourViewImages: [
          `https://via.placeholder.com/800x600/7b68ee/ffffff?text=Front+${currentIndex}`,
          `https://via.placeholder.com/800x600/20b2aa/ffffff?text=Back+${currentIndex}`,
          `https://via.placeholder.com/800x600/ff6347/ffffff?text=Side+${currentIndex}`
        ],
        detailImages: [
          `https://via.placeholder.com/800x600/ffa500/ffffff?text=Detail1+${currentIndex}`,
          `https://via.placeholder.com/800x600/9370db/ffffff?text=Detail2+${currentIndex}`,
          `https://via.placeholder.com/800x600/3cb371/ffffff?text=Detail3+${currentIndex}`
        ],
        
        // 特殊陈列方式
        specialDisplay: i % 10 === 0 ? '需要特殊展台' : '',
        
        // 状态和资格
        workType: 'regular',
        qualification: true,
        status: 'approved',
        
        // 时间
        submissionTime: new Date(Date.now() - i * 60000), // 每件作品间隔1分钟
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        
        // 测试标记
        _isTestData: true
      };
      
      promises.push(
        db.collection('pottery_submissions').add({ data: testData })
      );
      
      currentIndex++;
    }
    
    // 生成港澳台作品
    if (includeHkMacauTaiwan && hkMacauTaiwanCount > 0) {
      const hkMacauTaiwanRegions = [
        { province: '香港', school: '香港中文大学' },
        { province: '香港', school: '香港大学' },
        { province: '香港', school: '香港理工大学' },
        { province: '澳门', school: '澳门大学' },
        { province: '澳门', school: '澳门科技大学' },
        { province: '台湾', school: '台湾艺术大学' },
        { province: '台湾', school: '台湾师范大学' }
      ];
      
      for (let i = 0; i < hkMacauTaiwanCount; i++) {
        const region = hkMacauTaiwanRegions[i % hkMacauTaiwanRegions.length];
        const category = categories[i % categories.length];
        const firstName = firstNames[i % firstNames.length];
        const lastName = lastNames[i % lastNames.length];
        
        const testData = {
          name: firstName + lastName + currentIndex,
          gender: i % 2 === 0 ? '男' : '女',
          school: region.school,
          schoolProvinces: region.province,  // 关键：港澳台标识
          grade: ['大一', '大二', '大三', '大四', '研一'][i % 5],
          birthDate: `199${6 + i % 4}-${String((i % 12) + 1).padStart(2, '0')}`,
          major: '陶瓷艺术设计',
          phone: `158${String(i).padStart(8, '0')}`,
          email: `hmt${i}@example.com`,
          teacher: `港澳台导师${i}`,
          teacherPhone: `159${String(i).padStart(8, '0')}`,
          address: `${region.province}某区某路${i}号`,
          artworkName: `港澳台${category.name}作品${currentIndex}`,
          category: category.key,
          createYear: '2025',
          dimensions: [
            {
              length: String(22 + i % 25),
              width: String(17 + i % 20),
              height: String(12 + i % 15)
            }
          ],
          craftMaterial: `特殊材料、${1250 + i % 150}°C烧制`,
          artworkDescription: `这是港澳台地区的${category.name}测试作品${currentIndex}。`,
          perspectiveImage: `https://via.placeholder.com/800x600/ff69b4/ffffff?text=HMT+Perspective+${currentIndex}`,
          fourViewImages: [
            `https://via.placeholder.com/800x600/da70d6/ffffff?text=HMT+Front+${currentIndex}`,
            `https://via.placeholder.com/800x600/ba55d3/ffffff?text=HMT+Back+${currentIndex}`,
            `https://via.placeholder.com/800x600/9370db/ffffff?text=HMT+Side+${currentIndex}`
          ],
          detailImages: [
            `https://via.placeholder.com/800x600/8a2be2/ffffff?text=HMT+Detail1+${currentIndex}`,
            `https://via.placeholder.com/800x600/9400d3/ffffff?text=HMT+Detail2+${currentIndex}`,
            `https://via.placeholder.com/800x600/9932cc/ffffff?text=HMT+Detail3+${currentIndex}`
          ],
          workType: 'regular',
          qualification: true,
          status: 'approved',
          submissionTime: new Date(Date.now() - (regularCount + i) * 60000),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
          _isTestData: true,
          _isHkMacauTaiwan: true  // 测试标记
        };
        
        promises.push(
          db.collection('pottery_submissions').add({ data: testData })
        );
        
        currentIndex++;
      }
    }
    
    // 生成视界类作品
    if (includeVision && visionCount > 0) {
      for (let i = 0; i < visionCount; i++) {
        const province = provinces[i % provinces.length];
        const school = schools[i % schools.length];
        const firstName = firstNames[i % firstNames.length];
        const lastName = lastNames[i % lastNames.length];
        
        const testData = {
          name: firstName + lastName + currentIndex,
          gender: i % 2 === 0 ? '男' : '女',
          school: school,
          schoolProvinces: province,
          grade: ['大二', '大三', '大四', '研一', '研二'][i % 5],
          birthDate: `199${7 + i % 3}-${String((i % 12) + 1).padStart(2, '0')}`,
          major: '数字媒体艺术',
          phone: `168${String(i).padStart(8, '0')}`,
          email: `vision${i}@example.com`,
          teacher: `视界导师${i}`,
          teacherPhone: `169${String(i).padStart(8, '0')}`,
          address: `${province}某市某区某路${i}号`,
          artworkName: `视界类作品${currentIndex}`,
          category: 'vision',  // 视界类
          createYear: '2025',
          dimensions: [
            {
              length: String(25 + i % 20),
              width: String(20 + i % 15),
              height: String(15 + i % 10)
            }
          ],
          craftMaterial: `综合材料、数字技术`,
          artworkDescription: `这是视界类邀约作品${currentIndex}，展现数字艺术与陶瓷的结合。`,
          perspectiveImage: `https://via.placeholder.com/800x600/32cd32/ffffff?text=Vision+${currentIndex}`,
          fourViewImages: [
            `https://via.placeholder.com/800x600/228b22/ffffff?text=Vision+Front+${currentIndex}`,
            `https://via.placeholder.com/800x600/6b8e23/ffffff?text=Vision+Back+${currentIndex}`,
            `https://via.placeholder.com/800x600/556b2f/ffffff?text=Vision+Side+${currentIndex}`
          ],
          detailImages: [
            `https://via.placeholder.com/800x600/8fbc8f/ffffff?text=Vision+Detail1+${currentIndex}`,
            `https://via.placeholder.com/800x600/90ee90/ffffff?text=Vision+Detail2+${currentIndex}`
          ],
          workType: 'regular',
          qualification: true,
          status: 'approved',
          submissionTime: new Date(Date.now() - (regularCount + hkMacauTaiwanCount + i) * 60000),
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
          _isTestData: true,
          _isVision: true  // 测试标记
        };
        
        promises.push(
          db.collection('pottery_submissions').add({ data: testData })
        );
        
        currentIndex++;
      }
    }
    
    console.log('准备插入数据，总数:', promises.length);
    
    // 批量插入（分批处理，避免超时）
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < promises.length; i += batchSize) {
      const batch = promises.slice(i, i + batchSize);
      await Promise.all(batch);
      insertedCount += batch.length;
      console.log(`已插入 ${insertedCount}/${promises.length} 件作品`);
    }
    
    console.log('=== 测试数据生成完成 ===');
    
    return {
      success: true,
      message: '测试数据生成成功',
      data: {
        totalInserted: insertedCount,
        regularCount: regularCount,
        hkMacauTaiwanCount: hkMacauTaiwanCount,
        visionCount: visionCount,
        breakdown: {
          普通作品: regularCount,
          港澳台作品: hkMacauTaiwanCount,
          视界类作品: visionCount
        }
      }
    };
    
  } catch (error) {
    console.error('生成测试数据失败:', error);
    return {
      success: false,
      message: '生成测试数据失败',
      error: error.message
    };
  }
}






















