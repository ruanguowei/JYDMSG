// cloudfunctions/quickstartFunctions/cleanSubmissionsData/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const { resolveEdition, collectionName } = require('../common/edition')
const { prepareWork } = require('../common/evaluationRules')
const { readAll, replaceRows } = require('../common/evaluationStorage')

/**
 * 数据清洗（去重并生成评分表）
 * ⚠️ 危险操作：会清空 pottery_submissions_clean 表并重新生成
 */
exports.main = async (event, context) => {
  try {
    const edition = await resolveEdition(db, { editionId: event.editionId || 'pottery-2026', mode: 'write' });
    const submissionsCollection = collectionName(edition, 'submissions');
    const cleanedCollection = collectionName(edition, 'cleaned');
    console.log('=== ⚠️ 开始数据清洗（危险操作）===')
    console.log('云函数版本: v2.0 - 超时时间180秒')
    
    // 第1步：读取所有原始数据
    const MAX_LIMIT = 100
    let allData = []
    let skip = 0
    let hasMore = true
    
    while (hasMore) {
      const result = await db.collection(submissionsCollection)
        .where({
          qualification: _.neq(false)  // 只要有资格即可（不限制status）
        })
        .skip(skip)
        .limit(MAX_LIMIT)
        .get()
      
      allData = allData.concat(result.data)
      skip += MAX_LIMIT
      hasMore = result.data.length === MAX_LIMIT
      
      console.log(`已读取 ${allData.length} 条原始数据...`)
    }
    
    console.log('原始数据总量:', allData.length)
    
    if (allData.length === 0) {
      return {
        success: false,
        message: '暂无可清洗的数据（请确保有审核通过的作品）'
      }
    }
    
    // 第2步：数据清洗（去重）
    console.log('=== 开始去重处理 ===')
    
    const grouped = {}
    
    // 按 name + school + idNumber 分组
    allData.forEach(item => {
      const key = `${item.name || ''}_${item.school || ''}_${item.idNumber || ''}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      grouped[key].push(item);
    });
    
    // 第三届已由组委会审核定版：全部有资格记录保留，不按作者合并作品。
    const preserveAllSubmissions = edition.editionId === 'pottery-2026';
    const cleanedData = preserveAllSubmissions ? [...allData] : [];
    const duplicateLog = [];
    
    // 每组保留 updatedAt 最新的
    (preserveAllSubmissions ? [] : Object.keys(grouped)).forEach(key => {
      const items = grouped[key];
      
      if (items.length === 1) {
        // 无重复
        cleanedData.push(items[0]);
      } else {
        // 有重复，按 updatedAt 排序
        items.sort((a, b) => {
          const timeA = a.updatedAt || a.createdAt || 0;
          const timeB = b.updatedAt || b.createdAt || 0;
          return timeB - timeA;  // 降序，最新的在前
        });
        
        // 保留第一条（最新的）
        cleanedData.push(items[0]);
        
        // 记录被删除的重复数据
        const removed = items.slice(1);
        duplicateLog.push({
          key: key,
          保留: `${items[0].name} - ${items[0].artworkName || '未命名'} (ID: ${items[0]._id}, 更新时间: ${new Date(items[0].updatedAt || items[0].createdAt).toLocaleString('zh-CN')})`,
          删除: removed.map(r => `${r.name} - ${r.artworkName || '未命名'} (ID: ${r._id}, 更新时间: ${new Date(r.updatedAt || r.createdAt).toLocaleString('zh-CN')})`),
          重复数量: items.length
        });
      }
    });
    
    console.log('=== 数据清洗结果 ===');
    console.log('原始数据:', allData.length, '条');
    console.log('清洗后数据:', cleanedData.length, '条');
    console.log('删除重复:', allData.length - cleanedData.length, '条');
    console.log('重复组数:', duplicateLog.length, '组');
    
    if (duplicateLog.length > 0) {
      console.log('');
      console.log('=== ⚠️ 重复数据详情 ===');
      duplicateLog.forEach((log, index) => {
        console.log(`第${index + 1}组重复（${log.重复数量}条）：`);
        console.log('  ✅ 保留:', log.保留);
        console.log('  ❌ 删除:', log.删除.join('\n          '));
      });
      console.log('');
    }
    
    const existing = await readAll(db, cleanedCollection);
    const evaluatedCount = existing.filter(w => (w.evaluations || []).length).length;
    const hasEvaluations = evaluatedCount > 0;
    if (hasEvaluations || existing.some(w => w.qualification === false)) throw new Error('清洗表已有评分或取消资格记录，禁止重新清洗覆盖');
    const rows = cleanedData.map(w => ({ ...prepareWork(w), _originalId: w._id, sourceWorkId: w._id, evaluations: [] }));
    if (!event.dryRun) await replaceRows(db, cleanedCollection, rows, edition.editionId);
    return {
      success: true,
      message: `数据清洗完成！原始${allData.length}条，清洗后${cleanedData.length}条，删除重复${allData.length - cleanedData.length}条。评分表已生成。`,
      data: {
        originalCount: allData.length,
        cleanedCount: cleanedData.length,
        duplicateCount: allData.length - cleanedData.length,
        duplicateGroups: duplicateLog.length,
        hadEvaluations: hasEvaluations,
        lostEvaluations: hasEvaluations ? evaluatedCount : 0
      }
    }
    
  } catch (error) {
    console.error('数据清洗失败:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: '数据清洗失败: ' + error.message
    }
  }
}

