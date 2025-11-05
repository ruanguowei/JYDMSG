// cloudfunctions/quickstartFunctions/exportFinalResults/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 计算去最高最低分后的平均分
 */
function calculateAdjustedScore(scores) {
  if (!scores || scores.length === 0) return 0;
  
  // 如果评委数小于3，直接平均
  if (scores.length < 3) {
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  }
  
  // 排序
  const sorted = [...scores].sort((a, b) => a - b);
  
  // 去掉最高分和最低分
  const validScores = sorted.slice(1, -1);
  
  // 计算平均分
  return validScores.reduce((sum, s) => sum + s, 0) / validScores.length;
}

exports.main = async (event, context) => {
  const {
    sourceTable = 'pottery_submissions_for_final'  // 可选：pottery_submissions_for_final（评分表） | pottery_submissions_final（结果表）
  } = event;
  
  try {
    console.log('=== 开始导出终评结果（所有参评作品，按排序）===')
    console.log('数据来源表:', sourceTable);
    console.log('评分统计方式：使用所有评分（不限制专家类型）');
    
    // 从指定表读取所有作品（分批读取）
    const MAX_LIMIT = 100;
    let allData = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await db.collection(sourceTable)
        .where({
          qualification: db.command.neq(false)
        })
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      allData = allData.concat(result.data);
      skip += MAX_LIMIT;
      hasMore = result.data.length === MAX_LIMIT;
      
      console.log(`已读取 ${allData.length} 条数据...`);
    }
    
    console.log('参与终评的作品总数:', allData.length)
    
    if (allData.length === 0) {
      return {
        success: false,
        message: `表 ${sourceTable} 中暂无数据。请先执行相应的生成操作。`
      }
    }
    
    const submissionsResult = { data: allData };
    
    // 处理评分数据
    const results = []
    
    for (const item of submissionsResult.data) {
      const evaluations = item.evaluations || []
      
      // 使用所有评分（能写入终评评分表的都是终评评委的评分）
      const evalsToUse = evaluations;
      
      // 即使没有评分也要导出（显示为0分）
      // if (evalsToUse.length === 0) continue;
      
      // 收集所有评委的分数
      const scores = [];
      const themeFitScores = [];
      const creativityScores = [];
      const craftsmanshipScores = [];
      const aestheticsScores = [];
      
      evalsToUse.forEach(eval => {
        scores.push(eval.finalScore || eval.totalScore || 0);
        themeFitScores.push(eval.themeFit || 0);
        creativityScores.push(eval.creativity || 0);
        craftsmanshipScores.push(eval.craftsmanship || 0);
        aestheticsScores.push(eval.aesthetics || 0);
      });
      
      const scoreCount = scores.length;
      
      // 计算去最高最低分后的平均分
      const avgTotalScore = calculateAdjustedScore(scores).toFixed(2);
      const avgThemeFit = calculateAdjustedScore(themeFitScores).toFixed(2);
      const avgCreativity = calculateAdjustedScore(creativityScores).toFixed(2);
      const avgCraftsmanship = calculateAdjustedScore(craftsmanshipScores).toFixed(2);
      const avgAesthetics = calculateAdjustedScore(aestheticsScores).toFixed(2);
      
      // 统计扣分项的总扣分数
      let aiNotLabeledTotal = 0;
      let missingStatementTotal = 0;
      
      evalsToUse.forEach(eval => {
        if (eval.deductions) {
          if (eval.deductions.aiNotLabeled) aiNotLabeledTotal += 2;  // AI未标注扣2分
          if (eval.deductions.missingCreativeStatement) missingStatementTotal += 1;  // 缺创作说明扣1分
        }
      });
      
      // 计算平均扣分
      const avgAiDeduction = scoreCount > 0 ? (aiNotLabeledTotal / scoreCount).toFixed(2) : 0;
      const avgStatementDeduction = scoreCount > 0 ? (missingStatementTotal / scoreCount).toFixed(2) : 0;
      
      results.push({
        排名: 0, // 稍后计算
        作品类型: item.workType === 'video' ? '视频作品' : '普通作品',
        作品编号: item.submissionNumber || item._id,
        作品名称: item.artworkName || '',
        作者姓名: item.name || '',
        电话: item.phone || '',
        所在学校: item.school || '',
        学校省份: item.schoolProvinces || '',
        年级: item.grade || '',
        专业: item.major || '',
        指导老师: item.teacher || '',
        指导老师电话: item.teacherPhone || '',
        作品类别: getCategoryName(item.category),
        评委数量: scoreCount,
        主题契合度平均分: avgThemeFit,
        创意表现力平均分: avgCreativity,
        工艺材料平均分: avgCraftsmanship,
        美感实用性平均分: avgAesthetics,
        总分平均分: avgTotalScore,
        AI未标注平均扣分: avgAiDeduction,
        缺创作说明平均扣分: avgStatementDeduction,
        获奖等级: '' // 稍后计算
      })
    }
    
    // 按评分规则排序（总分 → 主题契合度 → 创意表现力 → 工艺材料）
    results.sort((a, b) => {
      // 1. 总分降序
      const scoreDiff = parseFloat(b.总分平均分) - parseFloat(a.总分平均分);
      if (scoreDiff !== 0) return scoreDiff;
      
      // 2. 主题契合度降序
      const themeDiff = parseFloat(b.主题契合度平均分) - parseFloat(a.主题契合度平均分);
      if (themeDiff !== 0) return themeDiff;
      
      // 3. 创意表现力降序
      const creativityDiff = parseFloat(b.创意表现力平均分) - parseFloat(a.创意表现力平均分);
      if (creativityDiff !== 0) return creativityDiff;
      
      // 4. 工艺材料降序
      return parseFloat(b.工艺材料平均分) - parseFloat(a.工艺材料平均分);
    })
    
    // 添加排名和获奖等级
    results.forEach((item, index) => {
      item.排名 = index + 1
      
      // 根据排名设置获奖等级（可根据实际规则调整）
      if (index < 10) {
        item.获奖等级 = '一等奖'
      } else if (index < 30) {
        item.获奖等级 = '二等奖'
      } else if (index < 60) {
        item.获奖等级 = '三等奖'
      } else if (index < 100) {
        item.获奖等级 = '优秀奖'
      } else {
        item.获奖等级 = '入围奖'
      }
    })
    
    // 生成CSV格式数据
    const csvContent = generateCSV(results)
    
    // 上传到云存储
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const tableLabel = sourceTable === 'pottery_submissions_for_final' ? '评分表' : '结果表';
    const fileName = `终评结果_${tableLabel}_${dateStr}.csv`
    
    const uploadResult = await cloud.uploadFile({
      cloudPath: `admin_exports/final/${fileName}`,
      fileContent: Buffer.from('\uFEFF' + csvContent, 'utf8') // 添加BOM头以支持Excel打开中文
    })
    
    console.log('导出成功，文件:', fileName)
    console.log('数据来源:', sourceTable)
    console.log('导出作品数:', results.length)
    console.log('评分统计方式: 所有评分（去最高最低分后的平均分）');
    
    // 统计视频作品数量
    const videoCount = results.filter(r => r.作品类型 === '视频作品').length;
    console.log('其中视频作品:', videoCount, '件');
    
    // 获取临时下载链接
    const tempFileResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    });
    
    const downloadUrl = tempFileResult.fileList[0].tempFileURL;
    
    return {
      success: true,
      downloadUrl: downloadUrl,
      fileID: uploadResult.fileID,
      fileName: fileName,
      sourceTable: sourceTable,
      recordCount: results.length,
      videoCount: videoCount,
      message: `成功导出 ${results.length} 条终评结果（来自${tableLabel}，含${videoCount}件视频作品）`
    }
    
  } catch (error) {
    console.error('导出终评结果失败:', error)
    return {
      success: false,
      message: '导出失败: ' + error.message
    }
  }
}

// 获取分类名称
function getCategoryName(category) {
  const categoryMap = {
    'technique': '技艺类',
    'culture': '文脉类', 
    'algorithm': '算法类',
    'industry': '产业类',
    'vision': '视界类',
    '技艺': '技艺类',
    '文脉': '文脉类',
    '算法': '算法类',
    '产业': '产业类',
    '视界': '视界类'
  }
  return categoryMap[category] || category || '未分类'
}

// 生成CSV内容
function generateCSV(data) {
  if (data.length === 0) return ''
  
  // 获取表头
  const headers = Object.keys(data[0])
  
  // 生成CSV内容
  let csvContent = headers.join(',') + '\n'
  
  data.forEach(row => {
    const values = headers.map(header => {
      let value = row[header]
      if (value === null || value === undefined) {
        value = ''
      }
      // 处理包含逗号、引号或换行的值
      value = String(value)
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    csvContent += values.join(',') + '\n'
  })
  
  return csvContent
}

