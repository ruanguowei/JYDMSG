// cloudfunctions/removeDuplicates/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100

/**
 * 通用去重云函数
 * 删除指定表中的重复数据，保留最新的一条
 * 
 * @param {string} tableName - 要去重的表名
 * @param {array} uniqueFields - 用于判断重复的字段数组，如 ['name', 'school']
 * @param {string} keepStrategy - 保留策略: 'newest'(最新) 或 'oldest'(最早)，默认 newest
 * @param {boolean} dryRun - 是否只预览不删除，默认 true（安全模式）
 */
exports.main = async (event, context) => {
  const {
    tableName,
    uniqueFields = ['name', 'school'],
    keepStrategy = 'newest',
    dryRun = true  // 默认安全模式，只预览不删除
  } = event;
  
  try {
    console.log('=== 通用去重云函数 ===');
    console.log('表名:', tableName);
    console.log('去重字段:', uniqueFields.join(', '));
    console.log('保留策略:', keepStrategy === 'newest' ? '保留最新' : '保留最早');
    console.log('运行模式:', dryRun ? '🔍 预览模式（不删除）' : '⚠️ 执行模式（会删除）');
    console.log('');
    
    if (!tableName) {
      return {
        success: false,
        message: '请指定表名 tableName'
      };
    }
    
    if (!uniqueFields || uniqueFields.length === 0) {
      return {
        success: false,
        message: '请指定去重字段 uniqueFields'
      };
    }
    
    // 第1步：读取所有数据
    let allData = [];
    let lastId = null;
    
    while (true) {
      let query = db.collection(tableName);
      
      if (lastId) {
        query = query.where({
          _id: db.command.gt(lastId)
        });
      }
      
      const result = await query
        .orderBy('_id', 'asc')
        .limit(MAX_LIMIT)
        .get();
      
      if (result.data.length === 0) break;
      
      allData = allData.concat(result.data);
      lastId = result.data[result.data.length - 1]._id;
      
      console.log(`已读取 ${allData.length} 条数据...`);
    }
    
    console.log('');
    console.log('总数据量:', allData.length, '条');
    
    if (allData.length === 0) {
      return {
        success: true,
        message: '表中无数据',
        data: { total: 0, duplicates: 0 }
      };
    }
    
    // 第2步：按指定字段分组
    const grouped = {};
    
    allData.forEach(item => {
      // 生成分组key
      const keyParts = uniqueFields.map(field => {
        const value = item[field];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      });
      const key = keyParts.join('_||_');
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });
    
    // 第3步：找出重复数据
    const toDelete = [];
    const duplicateLog = [];
    
    Object.keys(grouped).forEach(key => {
      const items = grouped[key];
      
      if (items.length > 1) {
        // 有重复，按时间排序
        items.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || a._createTime || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || b._createTime || 0).getTime();
          
          if (keepStrategy === 'newest') {
            return timeB - timeA;  // 降序，最新的在前
          } else {
            return timeA - timeB;  // 升序，最早的在前
          }
        });
        
        // 保留第一条，其余删除
        const kept = items[0];
        const removed = items.slice(1);
        
        removed.forEach(item => {
          toDelete.push(item._id);
        });
        
        // 记录日志
        const keyValues = uniqueFields.map(f => `${f}=${items[0][f] || '空'}`).join(', ');
        duplicateLog.push({
          key: keyValues,
          total: items.length,
          kept: kept._id,
          removed: removed.map(r => r._id)
        });
      }
    });
    
    console.log('');
    console.log('=== 去重分析结果 ===');
    console.log('唯一记录数:', Object.keys(grouped).length);
    console.log('重复组数:', duplicateLog.length);
    console.log('待删除数量:', toDelete.length);
    console.log('');
    
    if (duplicateLog.length > 0) {
      console.log('=== 重复数据详情 ===');
      duplicateLog.slice(0, 20).forEach((log, index) => {
        console.log(`${index + 1}. [${log.key}] 共${log.total}条`);
        console.log(`   ✅ 保留: ${log.kept}`);
        console.log(`   ❌ 删除: ${log.removed.join(', ')}`);
      });
      
      if (duplicateLog.length > 20) {
        console.log(`... 还有 ${duplicateLog.length - 20} 组重复数据`);
      }
      console.log('');
    }
    
    // 第4步：执行删除（如果不是预览模式）
    let deletedCount = 0;
    
    if (!dryRun && toDelete.length > 0) {
      console.log('=== ⚠️ 开始删除重复数据 ===');
      
      // 分批删除
      const batchSize = 50;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const deletePromises = batch.map(id => 
          db.collection(tableName).doc(id).remove()
        );
        
        await Promise.all(deletePromises);
        deletedCount += batch.length;
        console.log(`已删除 ${deletedCount}/${toDelete.length} 条`);
      }
      
      console.log('');
      console.log('=== ✅ 删除完成 ===');
    }
    
    return {
      success: true,
      message: dryRun 
        ? `预览完成：发现 ${toDelete.length} 条重复数据待删除（设置 dryRun: false 执行删除）`
        : `删除完成：已删除 ${deletedCount} 条重复数据`,
      data: {
        tableName,
        uniqueFields,
        keepStrategy,
        dryRun,
        total: allData.length,
        uniqueCount: Object.keys(grouped).length,
        duplicateGroups: duplicateLog.length,
        toDeleteCount: toDelete.length,
        deletedCount: deletedCount,
        duplicateDetails: duplicateLog.slice(0, 50)  // 最多返回50组详情
      }
    };
    
  } catch (error) {
    console.error('去重失败:', error);
    return {
      success: false,
      message: '去重失败: ' + error.message,
      error: error.message
    };
  }
}
