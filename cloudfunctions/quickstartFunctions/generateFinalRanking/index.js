// cloudfunctions/quickstartFunctions/generateFinalRanking/index.js
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
 * 标准化类别名称（支持中英文）
 */
function normalizeCategory(category) {
  const map = {
    'technique': 'technique', '技艺': 'technique', '技艺类': 'technique',
    'culture': 'culture', '文脉': 'culture', '文脉类': 'culture',
    'algorithm': 'algorithm', '算法': 'algorithm', '算法类': 'algorithm',
    'industry': 'industry', '产业': 'industry', '产业类': 'industry',
    'vision': 'vision', '视界': 'vision', '视界类': 'vision'
  };
  const raw = (category || '').toString().trim();
  return map[raw] || raw;
}

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

/**
 * 生成终评结果表（含地域均衡）
 * 从初评结果表中筛选前300件 + 港澳台20件 = 320件
 * ⚠️ 危险操作：会清空 pottery_submissions_final 表
 */
exports.main = async (event, context) => {
  try {
    console.log('=== ⚠️ 开始生成终评结果表（含地域均衡）===');
    
    // 1. 获取所有作品 - 从终评评分表读取（分批读取）
    const MAX_LIMIT = 100;
    let allWorks = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await db.collection('pottery_submissions_for_final')
        .where({
          qualification: db.command.neq(false)
        })
        .skip(skip)
        .limit(MAX_LIMIT)
        .get();
      
      allWorks = allWorks.concat(result.data);
      skip += MAX_LIMIT;
      hasMore = result.data.length === MAX_LIMIT;
      
      console.log(`已读取 ${allWorks.length} 件作品...`);
    }
    
    console.log('终评评分表作品总数:', allWorks.length);
    
    // 2. 分离港澳台和普通作品
    const hkMacauTaiwanWorks = [];
    const regularWorks = [];
    
    allWorks.forEach(item => {
      if (isHkMacauTaiwan(item.schoolProvinces)) {
        hkMacauTaiwanWorks.push(item);
      } else {
        regularWorks.push(item);
      }
    });
    
    console.log('普通作品数:', regularWorks.length);
    console.log('港澳台作品数:', hkMacauTaiwanWorks.length);
    
    // 3. 计算每个作品的终评总分（去最高最低分后的平均分）
    const worksWithScore = regularWorks.map(item => {
      const evals = item.evaluations || [];
      
      // 收集所有评委的分数
      const scores = evals.map(eval => eval.finalScore || eval.totalScore || 0);
      const themeFitScores = evals.map(eval => eval.themeFit || 0);
      const creativityScores = evals.map(eval => eval.creativity || 0);
      const craftsmanshipScores = evals.map(eval => eval.craftsmanship || 0);
      
      // 计算去最高最低分后的平均分
      const adjustedTotalScore = calculateAdjustedScore(scores);
      const adjustedThemeFit = calculateAdjustedScore(themeFitScores);
      const adjustedCreativity = calculateAdjustedScore(creativityScores);
      const adjustedCraftsmanship = calculateAdjustedScore(craftsmanshipScores);
      
      return {
        ...item,
        categoryKey: normalizeCategory(item.category),
        // 使用去最高最低分后的平均分
        totalScore: adjustedTotalScore,
        themeFitTotal: adjustedThemeFit,
        creativityTotal: adjustedCreativity,
        craftsmanshipTotal: adjustedCraftsmanship,
        evaluationCount: evals.length
      };
    });
    
    // 4. 统计评分表中各省份的总作品数（用于地域保护）
    console.log('=== 统计各省份在评分表中的作品数 ===');
    const provinceCountInSource = {};
    
    regularWorks.forEach(item => {
      const province = item.schoolProvinces || '未知';
      provinceCountInSource[province] = (provinceCountInSource[province] || 0) + 1;
    });
    
    // 识别需要完全保护的省份（<4件）
    const fullyProtectedProvinces = [];
    
    Object.keys(provinceCountInSource).forEach(province => {
      if (provinceCountInSource[province] < 4) {
        fullyProtectedProvinces.push(province);
        console.log(`保护省份：${province}（共${provinceCountInSource[province]}件，全部入围）`);
      }
    });
    
    console.log('需要完全保护的省份数:', fullyProtectedProvinces.length);
    
    // 5. 按类别分别筛选（终评目标：技艺91、文脉98、算法49、产业53）
    // 使用新的地域保护逻辑
    const categoryTargets = {
      technique: 91,
      culture: 98,
      algorithm: 49,
      industry: 53
    };
    
    const allRanked = []; // 所有排序后的作品
    let top291ByCategory = [];
    
    ['technique', 'culture', 'algorithm', 'industry'].forEach(category => {
      // 筛选该类别的所有作品
      const categoryWorks = worksWithScore.filter(item => item.categoryKey === category);
      
      console.log(`${category} 类筛选到 ${categoryWorks.length} 件作品`);
      
      // 排序（按规则：总分 → 主题契合度 → 创意表现力 → 工艺）
      categoryWorks.sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.themeFitTotal !== a.themeFitTotal) {
          return b.themeFitTotal - a.themeFitTotal;
        }
        if (b.creativityTotal !== a.creativityTotal) {
          return b.creativityTotal - a.creativityTotal;
        }
        return b.craftsmanshipTotal - a.craftsmanshipTotal;
      });
      
      // 添加类内排名
      categoryWorks.forEach((item, index) => {
        item.categoryRank = index + 1;
        if (!item.categoryKey) {
          item.categoryKey = category;
        }
      });
      
      allRanked.push(...categoryWorks);
      
      // 应用地域保护筛选
      // A. 保护省份的作品全部入围
      const protectedWorks = categoryWorks.filter(item => 
        fullyProtectedProvinces.includes(item.schoolProvinces)
      );
      
      // B. 非保护省份竞争剩余名额
      const competitiveWorks = categoryWorks.filter(item => 
        !fullyProtectedProvinces.includes(item.schoolProvinces)
      );
      
      // 已经排好序，直接取前N件
      const remainingSlots = categoryTargets[category] - protectedWorks.length;
      const topCompetitive = competitiveWorks.slice(0, remainingSlots);
      
      // C. 合并
      const selected = [...protectedWorks, ...topCompetitive];
      top291ByCategory.push(...selected);
      
      console.log(`${category} 类：保护${protectedWorks.length}件，竞争取${topCompetitive.length}件，共${selected.length}件`);
    });
    
    // 添加全局排名（用于显示）
    allRanked.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (b.themeFitTotal !== a.themeFitTotal) {
        return b.themeFitTotal - a.themeFitTotal;
      }
      if (b.creativityTotal !== a.creativityTotal) {
        return b.creativityTotal - a.creativityTotal;
      }
      return b.craftsmanshipTotal - a.craftsmanshipTotal;
    });
    
    allRanked.forEach((item, index) => {
      item.overallRank = index + 1; // 全局排名
    });
    
    console.log('按类别筛选完成，初步选出', top291ByCategory.length, '件作品');
    
    // 6. 二次保护：检查竞争后是否有省份不足4件
    let top291 = top291ByCategory;
    
    console.log('=== 第二轮地域保护：检查竞争后的省份分布 ===');
    
    // 统计前291中各省份的数量
    const provinceCountInTop291 = {};
    
    top291.forEach(item => {
      const province = item.schoolProvinces || '未知';
      provinceCountInTop291[province] = (provinceCountInTop291[province] || 0) + 1;
    });
    
    // 输出统计
    console.log('=== 各省份在前291中的入围情况 ===');
    Object.keys(provinceCountInTop291).forEach(province => {
      const count = provinceCountInTop291[province];
      const sourceCount = provinceCountInSource[province] || 0;
      const status = count >= 4 ? '✅' : '⚠️';
      console.log(`${status} ${province}: ${count}件 / 评分表共${sourceCount}件`);
    });
    
    // 找出竞争后仍不足4件的省份（排除完全保护省份）
    const needSecondProtection = [];
    
    Object.keys(provinceCountInTop291).forEach(province => {
      // 跳过完全保护的省份（已经全部入围）
      if (fullyProtectedProvinces.includes(province)) {
        return;
      }
      
      if (provinceCountInTop291[province] < 4) {
        needSecondProtection.push({
          province: province,
          current: provinceCountInTop291[province],
          needed: 4 - provinceCountInTop291[province],
          sourceCount: provinceCountInSource[province]
        });
      }
    });
    
    console.log('需要二次保护的省份数:', needSecondProtection.length);
    
    // 按省份名称拼音排序
    needSecondProtection.sort((a, b) => a.province.localeCompare(b.province, 'zh-CN'));
    
    // 执行二次保护递补
    const supplementRecords = [];
    
    for (const need of needSecondProtection) {
      console.log(`二次保护：${need.province}，当前${need.current}件，需要递补${need.needed}件`);
      
      // 从该省份所有作品中找未入围的，按分数排序
      const provinceWorks = allRanked.filter(item => 
        item.schoolProvinces === need.province
      );
      
      const notSelected = provinceWorks.filter(item => 
        !top291.some(selected => selected._id === item._id)
      );
      
      if (notSelected.length === 0) {
        console.log(`  ⚠️ ${need.province} 无未入围作品可递补`);
        continue;
      }
      
      // 按总分排序
      notSelected.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.themeFitTotal !== a.themeFitTotal) return b.themeFitTotal - a.themeFitTotal;
        if (b.creativityTotal !== a.creativityTotal) return b.creativityTotal - a.creativityTotal;
        return b.craftsmanshipTotal - a.craftsmanshipTotal;
      });
      
      // 取前N件未入围作品（需要递补的数量）
      const candidatesToAdd = notSelected.slice(0, need.needed);
      
      console.log(`  ${need.province} 未入围作品中最高分的${candidatesToAdd.length}件将被递补`);
      
      // 对每个候选作品，找对应类别排名最靠后的作品替换
      for (const candidate of candidatesToAdd) {
        const targetCategory = candidate.categoryKey;
        
        // 从前291中找该类别排名最靠后的作品（排除保护省份的）
        const replaceableWorks = top291.filter(item => 
          item.categoryKey === targetCategory &&
          !fullyProtectedProvinces.includes(item.schoolProvinces) &&  // 不替换完全保护省份的
          item.schoolProvinces !== need.province &&  // 不替换本省份的
          provinceCountInTop291[item.schoolProvinces] > 4 &&  // ⭐ 只替换超过4件的省份
          !supplementRecords.some(r => r.toReplace._id === item._id)  // 不重复替换
        );
        
        if (replaceableWorks.length === 0) {
          console.log(`  ⚠️ ${targetCategory} 类无可替换作品`);
          continue;
        }
        
        // 找类内排名最靠后的
        const toReplace = replaceableWorks.sort((a, b) => b.categoryRank - a.categoryRank)[0];
        
        supplementRecords.push({
          candidate: candidate,
          toReplace: toReplace,
          province: need.province,
          category: targetCategory
        });
        
        console.log(`  ✅ ${need.province} ${targetCategory}类第${candidate.categoryRank}名(${candidate.artworkName},${candidate.totalScore}分) 替换 ${toReplace.schoolProvinces} 类内第${toReplace.categoryRank}名(${toReplace.artworkName},${toReplace.totalScore}分)`);
      }
    }
    
    console.log('地域保护递补操作数:', supplementRecords.length);
    
    // 执行替换
    supplementRecords.forEach(record => {
      // 从top291中移除被替换的
      const removeIndex = top291.findIndex(item => item._id === record.toReplace._id);
      if (removeIndex >= 0) {
        top291.splice(removeIndex, 1);
      }
      
      // 添加递补的
      const supplementedItem = {
        ...record.candidate,
        isSupplemented: true,
        supplementReason: `地域均衡递补（${record.province}）`,
        originalCategoryRank: record.candidate.categoryRank,
        originalOverallRank: record.candidate.overallRank,
        replacedWork: {
          categoryRank: record.toReplace.categoryRank,
          overallRank: record.toReplace.overallRank,
          name: record.toReplace.artworkName,
          school: record.toReplace.school
        }
      };
      top291.push(supplementedItem);
    });
    
    console.log('地域均衡处理完成');
    
    // 最终入围：291件普通作品 + 所有港澳台作品（港澳台作品全部入围）
    const finalSelected = [...top291, ...hkMacauTaiwanWorks];
    
    console.log('=== 终评结果统计 ===');
    console.log('普通作品入围:', top291.length, '件');
    console.log('港澳台作品入围:', hkMacauTaiwanWorks.length, '件（全部入围）');
    console.log('地域递补作品:', supplementRecords.length, '件');
    console.log('最终入围总数:', finalSelected.length, '件（约311件）');
    
    // 写入终评结果表
    console.log('=== ⚠️ 清空并写入终评结果表 ===');
    
    // 先清空
    const existingResult = await db.collection('pottery_submissions_final')
      .limit(1000)
      .get();
    
    if (existingResult.data.length > 0) {
      console.log('清空旧的终评结果表:', existingResult.data.length, '条');
      const removePromises = existingResult.data.map(item => 
        db.collection('pottery_submissions_final').doc(item._id).remove()
      );
      await Promise.all(removePromises);
    }
    
    // 批量插入
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < finalSelected.length; i += batchSize) {
      const batch = finalSelected.slice(i, i + batchSize);
      const promises = batch.map(item => {
        const finalItem = {
          ...item,
          _generatedAt: new Date(),
          _sourceTable: 'pottery_submissions_preliminary'
        };
        delete finalItem._id;
        
        return db.collection('pottery_submissions_final').add({ data: finalItem });
      });
      
      await Promise.all(promises);
      insertedCount += batch.length;
      console.log(`已写入 ${insertedCount}/${finalSelected.length} 条数据`);
    }
    
    console.log('');
    console.log('=== ✅ 终评结果表生成完成 ===');
    console.log('表名：pottery_submissions_final');
    console.log('总数：', finalSelected.length, '件');
    console.log('可在云开发控制台查看');
    console.log('');
    
    return {
      success: true,
      message: `终评结果表生成成功！共${finalSelected.length}件作品（291普通+${hkMacauTaiwanWorks.length}港澳台，含${supplementRecords.length}件地域递补）`,
      data: {
        totalCount: finalSelected.length,
        regularCount: top291.length,
        hkMacauTaiwanCount: hkMacauTaiwanWorks.length,
        supplementedCount: supplementRecords.length,
        supplementRecords: supplementRecords.map(r => ({
          province: r.province,
          category: r.category,
          candidateCategoryRank: r.candidate.categoryRank,
          candidateOverallRank: r.candidate.overallRank,
          replacedCategoryRank: r.toReplace.categoryRank,
          replacedOverallRank: r.toReplace.overallRank,
          candidateName: r.candidate.artworkName,
          replacedName: r.toReplace.artworkName
        }))
      }
    };
    
  } catch (error) {
    console.error('生成终评最终排名失败:', error);
    return {
      success: false,
      message: '生成终评最终排名失败',
      error: error.message
    };
  }
}

