// cloudfunctions/quickstartFunctions/getVideoWorksList/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 获取视频作品列表（按评分展示顺序）
 * 用于管理员查看和下载视频
 * 返回顺序号、作品名称、作品ID等信息
 */
exports.main = async (event, context) => {
  try {
    const { 
      phase = 'initial',  // 'initial' 初评 | 'final' 终评
      expertCode          // 可选：指定专家代码，查看该专家看到的顺序
    } = event;
    
    console.log('=== 获取视频作品列表 ===');
    console.log('评选阶段:', phase);
    console.log('专家代码:', expertCode || '全部');
    
    // 确定数据源表
    const tableName = phase === 'final' 
      ? 'pottery_submissions_for_final' 
      : 'pottery_submissions_clean';
    
    console.log('数据源:', tableName);
    
    // 1. 读取所有视频作品（分批）
    const MAX_LIMIT = 100;
    let allVideoWorks = [];
    let skip = 0;
    let hasMore = true;
    
    // 初评阶段需要排除港澳台作品
    const whereCondition = {
      workType: 'video',
      qualification: db.command.neq(false)
    };
    
    // 初评阶段：排除港澳台作品（与专家评分逻辑一致）
    if (phase === 'initial') {
      whereCondition.schoolProvinces = db.command.nin(['香港', '澳门', '台湾', '香港特别行政区', '澳门特别行政区', '台湾省']);
      console.log('初评阶段：排除港澳台视频作品');
    } else {
      console.log('终评阶段：包含港澳台视频作品');
    }
    
    while (hasMore) {
      const result = await db.collection(tableName)
        .where(whereCondition)
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      allVideoWorks = allVideoWorks.concat(result.data);
      skip += MAX_LIMIT;
      hasMore = result.data.length === MAX_LIMIT;
    }
    
    console.log('视频作品总数:', allVideoWorks.length);
    
    if (allVideoWorks.length === 0) {
      return {
        success: true,
        message: '暂无视频作品',
        data: {
          phase: phase,
          total: 0,
          list: []
        }
      };
    }
    
    // 2. 如果指定了专家，过滤已评分作品
    let videoWorks = allVideoWorks;
    
    if (expertCode) {
      videoWorks = allVideoWorks.filter(work => {
        const evaluations = work.evaluations || [];
        const isEvaluated = evaluations.some(eval => eval.expertCode === expertCode);
        return !isEvaluated;  // 只返回未评分的
      });
      console.log(`专家${expertCode}未评分的视频作品:`, videoWorks.length, '件');
    }
    
    // 3. 保持数据表原有顺序（不额外排序）
    
    // 4. 生成列表
    const videoList = videoWorks.map((work, index) => {
      const evaluations = work.evaluations || [];
      
      return {
        order: index + 1,  // 顺序号：1, 2, 3...
        id: work._id,
        title: work.artworkName || work.title || '未命名作品',
        category: getCategoryName(work.category),
        createYear: work.createYear || '',
        description: work.artworkDescription || work.description || '',
        submitTime: work.submissionTime || work.submitTime || null,
        submitTimeStr: formatDate(work.submissionTime || work.submitTime),
        // 评分信息
        evaluatedCount: evaluations.length,
        isEvaluated: expertCode ? evaluations.some(e => e.expertCode === expertCode) : false,
        // 学生信息
        studentName: work.name || '',
        school: work.school || '',
        schoolProvinces: work.schoolProvinces || ''
      };
    });
    
    // 5. 输出到控制台
    console.log('');
    console.log('========================================');
    console.log(`${phase === 'final' ? '终评' : '初评'}视频作品列表（按数据表原有顺序）`);
    console.log('========================================');
    console.log('');
    
    videoList.forEach(item => {
      console.log(`顺序${item.order}: ${item.title}`);
      console.log(`  分类: ${item.category} | 创作年份: ${item.createYear}`);
      console.log(`  提交时间: ${item.submitTimeStr}`);
      console.log(`  学生: ${item.studentName} | 学校: ${item.school}`);
      console.log(`  作品ID: ${item.id}`);
      console.log(`  已评分数: ${item.evaluatedCount}位评委`);
      console.log('');
    });
    
    console.log('========================================');
    console.log('总计:', videoList.length, '件视频作品');
    console.log('========================================');
    
    // 6. 生成CSV格式的表格数据
    console.log('');
    console.log('=== 生成表格并上传到云存储 ===');
    
    // CSV表头
    const csvHeaders = [
      '顺序',
      '作品名称',
      '作品分类',
      '创作年份',
      '提交时间',
      '学生姓名',
      '学校',
      '省份',
      '已评分数',
      '作品ID',
      '作品简介'
    ];
    
    // CSV数据行
    const csvRows = [csvHeaders.join(',')];
    
    videoList.forEach(item => {
      const row = [
        item.order,
        `"${(item.title || '').replace(/"/g, '""')}"`,  // 处理引号
        item.category,
        item.createYear,
        item.submitTimeStr,
        `"${(item.studentName || '').replace(/"/g, '""')}"`,
        `"${(item.school || '').replace(/"/g, '""')}"`,
        item.schoolProvinces,
        item.evaluatedCount,
        item.id,
        `"${(item.description || '').substring(0, 100).replace(/"/g, '""')}"` // 简介截取前100字
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // 7. 上传到云存储
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `video_works_list_${phase}_${timestamp}.csv`;
    const filePath = `exports/${fileName}`;
    
    try {
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
        message: `获取成功，共${videoList.length}件视频作品，已导出到云存储`,
        data: {
          phase: phase,
          expertCode: expertCode || null,
          total: videoList.length,
          allTotal: allVideoWorks.length,
          list: videoList,
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
        message: `获取成功，共${videoList.length}件视频作品（文件上传失败）`,
        data: {
          phase: phase,
          expertCode: expertCode || null,
          total: videoList.length,
          allTotal: allVideoWorks.length,
          list: videoList,
          export: {
            error: '文件上传失败: ' + uploadError.message
          }
        }
      };
    }
    
  } catch (error) {
    console.error('获取视频作品列表失败:', error);
    return {
      success: false,
      message: '获取视频作品列表失败: ' + error.message,
      error: error.message
    };
  }
}

/**
 * 获取分类名称
 */
function getCategoryName(category) {
  const map = {
    'technique': '技艺类', '技艺': '技艺类', '技艺类': '技艺类',
    'culture': '文脉类', '文脉': '文脉类', '文脉类': '文脉类',
    'algorithm': '算法类', '算法': '算法类', '算法类': '算法类',
    'industry': '产业类', '产业': '产业类', '产业类': '产业类',
    'vision': '视界类', '视界': '视界类', '视界类': '视界类'
  };
  const raw = (category || '').toString().trim();
  return map[raw] || raw || '未知分类';
}

/**
 * 格式化日期
 */
function formatDate(timestamp) {
  if (!timestamp) return '未知';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

