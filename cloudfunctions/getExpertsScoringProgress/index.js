// cloudfunctions/getExpertsScoringProgress/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 获取专家评分进度
 * 统计所有专家的评分情况，包括取消资格的作品
 */
exports.main = async (event, context) => {
  const {
    phase = 'all',  // 'all' | 'initial' | 'final'
    expertCode,     // 可选：查询特定专家
    includeDetails = false  // 是否包含详细的作品列表
  } = event;
  
  try {
    console.log('=== 获取专家评分进度 ===');
    console.log('阶段:', phase);
    console.log('专家代码:', expertCode || '全部');
    console.log('包含详情:', includeDetails);
    
    // 1. 读取专家列表
    let expertQuery = db.collection('experts').where({ status: 'active' });
    
    // 根据阶段筛选专家
    if (phase === 'initial') {
      expertQuery = expertQuery.where({ expertType: 'preliminary' });
    } else if (phase === 'final') {
      expertQuery = expertQuery.where({ expertType: 'final' });
    }
    
    // 如果指定专家，只查询该专家
    if (expertCode) {
      expertQuery = expertQuery.where({ expertCode: expertCode });
    }
    
    const expertsResult = await expertQuery.get();
    const experts = expertsResult.data;
    
    console.log('专家总数:', experts.length);
    
    if (experts.length === 0) {
      return {
        success: false,
        message: '未找到专家数据'
      };
    }
    
    // 2. 统计每个专家的评分情况
    const expertProgress = [];
    
    for (const expert of experts) {
      const expertType = expert.expertType || '';
      const expertCodeValue = expert.expertCode;
      const expertName = expert.expertName;
      
      console.log('');
      console.log(`--- 统计专家: ${expertName} (${expertCodeValue}) ---`);
      
      // 确定数据表
      let tableName;
      if (expertType === 'final') {
        tableName = 'pottery_submissions_for_final';
      } else if (expertType === 'preliminary') {
        tableName = 'pottery_submissions_clean';
      } else {
        // 类型未知，跳过
        console.log('专家类型未设置，跳过');
        continue;
      }
      
      console.log('数据表:', tableName);
      
      // 分批读取所有作品
      const MAX_LIMIT = 100;
      let allWorks = [];
      let skip = 0;
      let hasMore = true;
      
      while (hasMore) {
        const result = await db.collection(tableName)
          .where({
            qualification: db.command.exists(true)  // 包含所有作品（包括被取消资格的）
          })
          .skip(skip)
          .limit(MAX_LIMIT)
          .get();
        
        allWorks = allWorks.concat(result.data);
        skip += MAX_LIMIT;
        hasMore = result.data.length === MAX_LIMIT;
      }
      
      console.log('作品总数:', allWorks.length);
      
      // 统计该专家的评分情况
      let evaluatedCount = 0;
      let disqualifiedByThisExpert = 0;
      let evaluatedWorks = [];
      let disqualifiedWorks = [];
      let lastEvaluationTime = null;
      
      allWorks.forEach(work => {
        const evaluations = work.evaluations || [];
        
        // 检查该专家是否评分过
        const expertEvaluation = evaluations.find(eval => eval.expertCode === expertCodeValue);
        
        if (expertEvaluation) {
          evaluatedCount++;
          
          if (includeDetails) {
            evaluatedWorks.push({
              workId: work._id,
              artworkName: work.artworkName || work.title,
              score: expertEvaluation.totalScore || expertEvaluation.finalScore || 0,
              evaluationTime: expertEvaluation.evaluationTime
            });
          }
          
          // 更新最后评分时间
          if (expertEvaluation.evaluationTime) {
            const evalTime = new Date(expertEvaluation.evaluationTime);
            if (!lastEvaluationTime || evalTime > lastEvaluationTime) {
              lastEvaluationTime = evalTime;
            }
          }
        }
        
        // 检查该专家是否取消了该作品资格
        if (work.qualification === false && work.disqualifyExpertCode === expertCodeValue) {
          disqualifiedByThisExpert++;
          
          if (includeDetails) {
            disqualifiedWorks.push({
              workId: work._id,
              artworkName: work.artworkName || work.title,
              studentName: work.name,
              school: work.school,
              disqualifyReason: work.disqualifyReason,
              disqualifyTime: work.disqualifyTime
            });
          }
        }
      });
      
      // 计算有效作品数（排除被取消资格的）
      const qualifiedWorks = allWorks.filter(work => work.qualification !== false);
      const totalQualifiedWorks = qualifiedWorks.length;
      const unevaluatedCount = totalQualifiedWorks - evaluatedCount;
      const progress = totalQualifiedWorks > 0 ? ((evaluatedCount / totalQualifiedWorks) * 100).toFixed(1) : 0;
      
      // 确定状态
      let status = '未开始';
      if (evaluatedCount === 0) {
        status = '未开始';
      } else if (evaluatedCount >= totalQualifiedWorks) {
        status = '已完成';
      } else {
        status = '进行中';
      }
      
      const expertData = {
        expertCode: expertCodeValue,
        expertName: expertName,
        expertType: expertType,
        expertTitle: expert.expertTitle || '',
        expertPosition: expert.expertPosition || '',
        statistics: {
          totalWorks: allWorks.length,  // 所有作品数（含被取消资格的）
          qualifiedWorks: totalQualifiedWorks,  // 有资格的作品数
          evaluated: evaluatedCount,  // 已评分数
          unevaluated: unevaluatedCount,  // 未评分数
          disqualified: disqualifiedByThisExpert,  // 该专家取消资格的数量
          progress: parseFloat(progress),  // 评分进度百分比
          lastEvaluationTime: lastEvaluationTime
        },
        status: status
      };
      
      // 如果需要详细信息，添加作品列表
      if (includeDetails) {
        expertData.evaluatedWorks = evaluatedWorks;
        expertData.disqualifiedWorks = disqualifiedWorks;
      }
      
      expertProgress.push(expertData);
      
      console.log(`${expertName}: 已评${evaluatedCount}/${totalQualifiedWorks}件，取消${disqualifiedByThisExpert}件，进度${progress}%`);
    }
    
    // 3. 汇总统计
    const totalExperts = expertProgress.length;
    const completedExperts = expertProgress.filter(e => e.status === '已完成').length;
    const inProgressExperts = expertProgress.filter(e => e.status === '进行中').length;
    const notStartedExperts = expertProgress.filter(e => e.status === '未开始').length;
    
    // 计算整体进度
    const totalEvaluated = expertProgress.reduce((sum, e) => sum + e.statistics.evaluated, 0);
    const totalQualified = expertProgress.reduce((sum, e) => sum + e.statistics.qualifiedWorks, 0);
    const overallProgress = totalQualified > 0 ? ((totalEvaluated / (totalExperts * totalQualified)) * 100).toFixed(1) : 0;
    const avgScoresPerExpert = totalExperts > 0 ? Math.round(totalEvaluated / totalExperts) : 0;
    
    // 统计总取消资格数
    const totalDisqualified = expertProgress.reduce((sum, e) => sum + e.statistics.disqualified, 0);
    
    // 按进度排序（进行中的在前，已完成的在后，未开始的最后）
    expertProgress.sort((a, b) => {
      // 先按状态排序
      const statusOrder = { '进行中': 0, '已完成': 1, '未开始': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // 同状态按进度降序
      return b.statistics.progress - a.statistics.progress;
    });
    
    console.log('');
    console.log('=== 汇总统计 ===');
    console.log('总专家数:', totalExperts);
    console.log('已完成:', completedExperts, '人');
    console.log('进行中:', inProgressExperts, '人');
    console.log('未开始:', notStartedExperts, '人');
    console.log('整体进度:', overallProgress, '%');
    console.log('平均每人评分:', avgScoresPerExpert, '件');
    console.log('总取消资格:', totalDisqualified, '件');
    
    // 4. 导出为CSV文件
    console.log('');
    console.log('=== 生成CSV文件并上传 ===');
    
    // 构建CSV数据
    const csvHeaders = [
      '专家代码',
      '专家姓名',
      '评委类型',
      '职称',
      '单位职务',
      '总作品数',
      '有资格作品数',
      '已评分数',
      '未评分数',
      '取消资格数',
      '评分进度(%)',
      '状态',
      '最后评分时间'
    ];
    
    const csvRows = [csvHeaders.join(',')];
    
    expertProgress.forEach(expert => {
      const row = [
        expert.expertCode,
        `"${expert.expertName}"`,
        expert.expertType === 'preliminary' ? '初评' : expert.expertType === 'final' ? '终评' : '未知',
        `"${expert.expertTitle || ''}"`,
        `"${expert.expertPosition || ''}"`,
        expert.statistics.totalWorks,
        expert.statistics.qualifiedWorks,
        expert.statistics.evaluated,
        expert.statistics.unevaluated,
        expert.statistics.disqualified,
        expert.statistics.progress,
        expert.status,
        expert.statistics.lastEvaluationTime ? formatDateTime(expert.statistics.lastEvaluationTime) : '未开始'
      ];
      csvRows.push(row.join(','));
    });
    
    // 添加汇总行
    csvRows.push('');  // 空行
    csvRows.push('=== 汇总统计 ===');
    csvRows.push(`总专家数,${totalExperts}`);
    csvRows.push(`已完成,${completedExperts}人`);
    csvRows.push(`进行中,${inProgressExperts}人`);
    csvRows.push(`未开始,${notStartedExperts}人`);
    csvRows.push(`整体进度,${overallProgress}%`);
    csvRows.push(`平均每人评分,${avgScoresPerExpert}件`);
    csvRows.push(`总取消资格,${totalDisqualified}件`);
    
    const csvContent = csvRows.join('\n');
    
    // 上传到云存储
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const phaseStr = phase === 'initial' ? '初评' : phase === 'final' ? '终评' : '全部';
      const fileName = `专家评分进度_${phaseStr}_${timestamp}.csv`;
      const filePath = `exports/${fileName}`;
      
      const uploadResult = await cloud.uploadFile({
        cloudPath: filePath,
        fileContent: Buffer.from('\ufeff' + csvContent, 'utf8')  // 添加BOM，确保Excel正确识别UTF-8
      });
      
      console.log('✅ 文件上传成功');
      console.log('文件名:', fileName);
      console.log('云存储路径:', filePath);
      console.log('文件ID:', uploadResult.fileID);
      
      // 获取临时下载链接
      const tempFileResult = await cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });
      
      const downloadUrl = tempFileResult.fileList[0].tempFileURL;
      console.log('下载链接:', downloadUrl);
      console.log('（链接有效期2小时）');
      
      return {
        success: true,
        message: `获取成功，共${totalExperts}位专家，已导出到云存储`,
        data: {
          phase: phase,
          totalExperts: totalExperts,
          summary: {
            completed: completedExperts,
            inProgress: inProgressExperts,
            notStarted: notStartedExperts,
            overallProgress: parseFloat(overallProgress),
            avgScoresPerExpert: avgScoresPerExpert,
            totalDisqualified: totalDisqualified
          },
          experts: expertProgress,
          export: {
            fileName: fileName,
            filePath: filePath,
            fileID: uploadResult.fileID,
            downloadUrl: downloadUrl,
            expiresIn: '2小时'
          }
        }
      };
      
    } catch (uploadError) {
      console.error('文件上传失败:', uploadError);
      
      // 即使上传失败，也返回数据
      return {
        success: true,
        message: `获取成功，共${totalExperts}位专家（文件上传失败）`,
        data: {
          phase: phase,
          totalExperts: totalExperts,
          summary: {
            completed: completedExperts,
            inProgress: inProgressExperts,
            notStarted: notStartedExperts,
            overallProgress: parseFloat(overallProgress),
            avgScoresPerExpert: avgScoresPerExpert,
            totalDisqualified: totalDisqualified
          },
          experts: expertProgress,
          export: {
            error: '文件上传失败: ' + uploadError.message
          }
        }
      };
    }
    
  } catch (error) {
    console.error('获取专家评分进度失败:', error);
    return {
      success: false,
      message: '获取失败: ' + error.message,
      error: error.message
    };
  }
}

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}


