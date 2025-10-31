/**
 * 测试数据调整脚本
 * 用于模拟不同的评选阶段场景
 * 
 * 使用方法：
 * 1. 在微信开发者工具的云开发控制台
 * 2. 选择"云函数" → 新建云函数 → 粘贴此代码
 * 3. 或者在数据库的"高级操作"中执行相关命令
 */

// ==========================================
// 场景1：模拟取消评选（< 320件）
// ==========================================

/**
 * 方法1：将部分作品临时改为视界类
 * 在云开发控制台执行以下代码片段
 */

// 第1步：备份并修改（将200件作品临时改为视界类）
/*
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 查询需要临时修改的作品
    const result = await db.collection('pottery_submissions')
      .where({
        category: db.command.in(['technique', 'culture', 'algorithm', 'industry']),
        qualification: db.command.neq(false)
      })
      .limit(200)  // 修改200件，保留约300件
      .get();
    
    const ids = result.data.map(item => item._id);
    console.log('将修改的作品数量:', ids.length);
    
    // 批量更新
    const promises = ids.map(id => 
      db.collection('pottery_submissions').doc(id).update({
        data: {
          _originalCategory: db.command.set('$category'),  // 备份原分类
          category: 'vision'  // 临时改为视界类
        }
      })
    );
    
    await Promise.all(promises);
    
    return {
      success: true,
      message: `已将${ids.length}件作品临时改为视界类`,
      modifiedIds: ids
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
};
*/

// 第2步：测试完成后恢复数据
/*
exports.main = async (event, context) => {
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const db = cloud.database();
  
  try {
    const result = await db.collection('pottery_submissions')
      .where({
        _originalCategory: db.command.exists(true)
      })
      .get();
    
    const ids = result.data.map(item => item._id);
    console.log('将恢复的作品数量:', ids.length);
    
    const promises = result.data.map(item => 
      db.collection('pottery_submissions').doc(item._id).update({
        data: {
          category: item._originalCategory,  // 恢复原分类
          _originalCategory: db.command.remove()  // 删除备份字段
        }
      })
    );
    
    await Promise.all(promises);
    
    return {
      success: true,
      message: `已恢复${ids.length}件作品的原分类`
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
};
*/


// ==========================================
// 场景2：模拟直接终评（320-639件）
// ==========================================

/**
 * 调整视界类作品数量，使总数在320-639之间
 * 假设当前有500件作品，保留400件（在范围内）
 */

// 修改100件为视界类
// 参考"场景1"的代码，将limit改为100


// ==========================================
// 场景3：模拟初评+终评（≥ 640件）
// ==========================================

/**
 * 方法1：恢复所有视界类作品
 * 方法2：批量生成测试数据
 */

// 批量生成测试数据
/*
exports.main = async (event, context) => {
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const db = cloud.database();
  
  const count = event.count || 100;  // 生成数量
  
  try {
    const categories = ['technique', 'culture', 'algorithm', 'industry'];
    const provinces = ['北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '陕西'];
    const schools = ['清华大学', '北京大学', '复旦大学', '浙江大学', '南京大学'];
    
    const promises = [];
    
    for (let i = 0; i < count; i++) {
      const testData = {
        name: `测试作者${i + 1}`,
        gender: i % 2 === 0 ? '男' : '女',
        school: schools[i % schools.length],
        schoolProvinces: provinces[i % provinces.length],
        grade: '研一',
        major: '陶瓷艺术设计',
        phone: `138${String(i).padStart(8, '0')}`,
        artworkName: `测试作品${i + 1}`,
        category: categories[i % categories.length],
        workType: 'regular',
        qualification: true,
        createYear: '2025',
        dimensions: [{
          length: String(20 + i % 30),
          width: String(15 + i % 20),
          height: String(10 + i % 15)
        }],
        artworkDescription: `这是测试作品${i + 1}的描述`,
        perspectiveImage: 'https://via.placeholder.com/800x600?text=Test' + (i + 1),
        fourViewImages: [
          'https://via.placeholder.com/800x600?text=Front',
          'https://via.placeholder.com/800x600?text=Back',
          'https://via.placeholder.com/800x600?text=Left'
        ],
        detailImages: [
          'https://via.placeholder.com/800x600?text=Detail1',
          'https://via.placeholder.com/800x600?text=Detail2'
        ],
        status: 'approved',
        submissionTime: new Date(Date.now() - i * 3600000), // 时间递减
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      
      promises.push(
        db.collection('pottery_submissions').add({ data: testData })
      );
    }
    
    await Promise.all(promises);
    
    return {
      success: true,
      message: `已成功生成${count}件测试作品`
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
};
*/


// ==========================================
// 场景4：模拟港澳台作品
// ==========================================

/**
 * 添加港澳台测试作品
 */

/*
exports.main = async (event, context) => {
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const db = cloud.database();
  
  const count = event.count || 20;  // 生成20件港澳台作品
  
  try {
    const regions = [
      { province: '香港', school: '香港中文大学' },
      { province: '澳门', school: '澳门大学' },
      { province: '台湾', school: '台湾艺术大学' }
    ];
    const categories = ['technique', 'culture', 'algorithm', 'industry'];
    
    const promises = [];
    
    for (let i = 0; i < count; i++) {
      const region = regions[i % regions.length];
      
      const testData = {
        name: `港澳台作者${i + 1}`,
        gender: i % 2 === 0 ? '男' : '女',
        school: region.school,
        schoolProvinces: region.province,  // 关键字段
        grade: '研一',
        major: '陶瓷艺术设计',
        phone: `138${String(i + 100).padStart(8, '0')}`,
        artworkName: `港澳台作品${i + 1}`,
        category: categories[i % categories.length],
        workType: 'regular',
        qualification: true,
        createYear: '2025',
        dimensions: [{
          length: String(25 + i % 20),
          width: String(18 + i % 15),
          height: String(12 + i % 10)
        }],
        artworkDescription: `这是港澳台测试作品${i + 1}的描述`,
        perspectiveImage: 'https://via.placeholder.com/800x600?text=HMT' + (i + 1),
        fourViewImages: [
          'https://via.placeholder.com/800x600?text=Front',
          'https://via.placeholder.com/800x600?text=Back',
          'https://via.placeholder.com/800x600?text=Left'
        ],
        detailImages: [
          'https://via.placeholder.com/800x600?text=Detail1',
          'https://via.placeholder.com/800x600?text=Detail2'
        ],
        status: 'approved',
        submissionTime: new Date(Date.now() - i * 3600000),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      
      promises.push(
        db.collection('pottery_submissions').add({ data: testData })
      );
    }
    
    await Promise.all(promises);
    
    return {
      success: true,
      message: `已成功生成${count}件港澳台测试作品`
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
};
*/






















