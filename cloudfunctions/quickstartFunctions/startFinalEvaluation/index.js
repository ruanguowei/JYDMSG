// cloudfunctions/quickstartFunctions/startFinalEvaluation/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 判断是否为港澳台作品
 */
function isHkMacauTaiwan(schoolProvinces) {
  const province = schoolProvinces || '';
  return province === '香港' || province === '澳门' || province === '台湾' ||
         province === '香港特别行政区' || province === '澳门特别行政区' || province === '台湾省';
}

/**
 * 开始终评
 * 从初评结果表复制作品到终评评分表（不复制 evaluations 字段）
 * ⚠️ 危险操作：会清空 pottery_submissions_for_final 表
 */
exports.main = async (event, context) => {
  try {
    console.log('=== ⚠️ 开始终评（危险操作）===');
    
    // 1. 从初评结果表读取480件普通作品（分批）
    const MAX_LIMIT = 100;
    let preliminaryWorks = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await db.collection('pottery_submissions_preliminary')
        .where({
          qualification: db.command.neq(false)
        })
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      preliminaryWorks = preliminaryWorks.concat(result.data);
      skip += MAX_LIMIT;
      hasMore = result.data.length === MAX_LIMIT;
      
      console.log(`已读取初评结果表 ${preliminaryWorks.length} 件作品...`);
    }
    
    console.log('初评结果表作品总数:', preliminaryWorks.length, '件（已包含港澳台）');
    
    // 2. 分离统计（用于日志）
    let regularCount = 0;
    let hkMacauTaiwanCount = 0;
    
    preliminaryWorks.forEach(item => {
      if (isHkMacauTaiwan(item.schoolProvinces)) {
        hkMacauTaiwanCount++;
      } else {
        regularCount++;
      }
    });
    
    console.log('其中普通作品:', regularCount, '件');
    console.log('其中港澳台作品:', hkMacauTaiwanCount, '件');
    
    // 3. 直接使用初评结果表的作品（不需要再读取港澳台）
    const allWorks = preliminaryWorks;
    console.log('终评评分表总作品数:', allWorks.length, '件');
    
    if (allWorks.length === 0) {
      return {
        success: false,
        message: '没有可复制的作品。请先生成初评结果表。'
      };
    }
    
    // 4. 清空终评评分表
    console.log('=== ⚠️ 清空终评评分表 ===');
    
    try {
      const existingResult = await db.collection('pottery_submissions_for_final')
        .limit(1000)
        .get();
      
      if (existingResult.data.length > 0) {
        console.log('清空旧的终评评分表:', existingResult.data.length, '条');
        const removePromises = existingResult.data.map(item => 
          db.collection('pottery_submissions_for_final').doc(item._id).remove()
        );
        await Promise.all(removePromises);
      }
    } catch (err) {
      console.log('终评评分表不存在或为空，将新建');
    }
    
    // 5. 复制作品到终评评分表（不包含 evaluations 字段）
    console.log('=== 开始复制作品（不含评分记录）===');
    
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < allWorks.length; i += batchSize) {
      const batch = allWorks.slice(i, i + batchSize);
      const promises = batch.map(item => {
        // 复制作品数据，但排除评分字段
        const cleanItem = {
          ...item,
          _copiedAt: new Date(),
          _sourceTable: 'pottery_submissions_preliminary'
        };
        delete cleanItem._id;  // 删除原ID，生成新ID
        delete cleanItem.evaluations;  // ⭐ 不复制评分记录
        delete cleanItem.finalEvaluation;  // 删除任何评分记录
        
        return db.collection('pottery_submissions_for_final').add({ data: cleanItem });
      });
      
      await Promise.all(promises);
      insertedCount += batch.length;
      console.log(`已复制 ${insertedCount}/${allWorks.length} 件作品`);
    }
    
    console.log('');
    console.log('=== ✅ 终评评分表生成完成 ===');
    console.log('表名：pottery_submissions_for_final');
    console.log('总数：', allWorks.length, '件');
    console.log('普通作品：', regularCount, '件');
    console.log('港澳台作品：', hkMacauTaiwanCount, '件');
    console.log('所有作品的 evaluations 字段已清空');
    console.log('终评评委可以开始评分');
    console.log('');
    
    return {
      success: true,
      message: `终评评分表生成成功！共${allWorks.length}件作品（${regularCount}普通+${hkMacauTaiwanCount}港澳台），评分记录已清空。`,
      data: {
        totalCount: allWorks.length,
        regularCount: regularCount,
        hkMacauTaiwanCount: hkMacauTaiwanCount
      }
    };
    
  } catch (error) {
    console.error('开始终评失败:', error);
    return {
      success: false,
      message: '开始终评失败: ' + error.message
    };
  }
}

