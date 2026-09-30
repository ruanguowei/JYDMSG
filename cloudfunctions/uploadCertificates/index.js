// cloudfunctions/uploadCertificates/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云存储环境ID前缀
const CLOUD_ENV_PREFIX = 'cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268'

// 证书根路径
const CERT_ROOT = '证书/第二届/大陶展证书'

// 目标数据表
const TARGET_COLLECTION = 'pottery_submissions_final'

/**
 * 主入口：接收证书文件列表JSON，匹配并更新到数据库
 * 
 * 输入格式:
 * {
 *   "shortlisted": [{ "province", "school", "name", "fileName", "fileID" }],
 *   "award": [{ "awardFolder", "school", "name", "fileName", "fileID" }]
 * }
 */
exports.main = async (event, context) => {
  console.log('=== 证书匹配云函数 ===')
  
  try {
    // 检查是否传入了证书列表
    const { shortlisted, award } = event
    
    if (!shortlisted && !award) {
      return {
        success: false,
        message: '请传入证书文件列表JSON，格式: { shortlisted: [...], award: [...] }'
      }
    }
    
    const cloudFiles = {
      shortlisted: shortlisted || [],
      award: award || []
    }
    
    console.log(`收到 ${cloudFiles.shortlisted.length} 个入围证书, ${cloudFiles.award.length} 个获奖证书`)
    
    // 获取数据库记录
    console.log('获取数据库记录...')
    const dbRecords = await getAllRecordsFromDB()
    console.log(`数据库共有 ${dbRecords.length} 条记录`)
    
    // 匹配并更新
    console.log('开始匹配...')
    const result = await matchAndUpdateCertificates(cloudFiles, dbRecords)
    
    return result
    
  } catch (err) {
    console.error('处理失败:', err)
    return {
      success: false,
      message: '处理失败: ' + err.message
    }
  }
}

/**
 * 从 certificate_files 集合获取所有证书文件
 */
async function scanCloudStorageFiles() {
  const shortlistedFiles = []
  const awardFiles = []
  
  try {
    const filesCollection = db.collection('certificate_files')
    const countResult = await filesCollection.count().catch(() => ({ total: 0 }))
    
    if (countResult.total === 0) {
      console.log('❌ certificate_files 集合为空!')
      console.log('请先运行本地扫描脚本 scan-certificates.js')
      console.log('然后将生成的 certificate_files_db_import.json 导入到 certificate_files 集合')
      return { shortlisted: [], award: [] }
    }
    
    console.log(`certificate_files 集合共有 ${countResult.total} 条记录`)
    
    const MAX_LIMIT = 100
    const batchTimes = Math.ceil(countResult.total / MAX_LIMIT)
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(filesCollection.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get())
    }
    
    const results = await Promise.all(tasks)
    const allFiles = results.reduce((acc, cur) => acc.concat(cur.data), [])
    
    for (const file of allFiles) {
      if (file.type === 'shortlisted') {
        shortlistedFiles.push(file)
      } else if (file.type === 'award') {
        awardFiles.push(file)
      }
    }
    
  } catch (err) {
    console.error('获取文件索引失败:', err.message)
  }
  
  return {
    shortlisted: shortlistedFiles,
    award: awardFiles
  }
}

/**
 * 文本标准化：用于模糊匹配
 */
function normalizeText(text) {
  if (!text) return ''
  return text
    .trim()
    .toLowerCase()
    // 繁体转简体常见字符
    .replace(/陳/g, '陈')
    .replace(/張/g, '张')
    .replace(/劉/g, '刘')
    .replace(/學/g, '学')
    .replace(/術/g, '术')
    .replace(/藝/g, '艺')
    .replace(/國/g, '国')
    .replace(/設/g, '设')
    .replace(/計/g, '计')
    .replace(/師/g, '师')
    .replace(/範/g, '范')
    .replace(/華/g, '华')
    .replace(/東/g, '东')
    .replace(/廣/g, '广')
    .replace(/業/g, '业')
    // 移除空格和特殊字符
    .replace(/\s+/g, '')
    .replace(/[()（）·\-_]/g, '')
}

/**
 * 计算相似度 (简单的字符匹配)
 */
function similarity(str1, str2) {
  const s1 = normalizeText(str1)
  const s2 = normalizeText(str2)
  
  if (s1 === s2) return 1.0
  if (!s1 || !s2) return 0
  
  // 检查是否包含
  if (s1.includes(s2) || s2.includes(s1)) return 0.9
  
  // 计算公共字符比例
  let common = 0
  for (const char of s1) {
    if (s2.includes(char)) common++
  }
  
  return common / Math.max(s1.length, s2.length)
}

/**
 * 匹配证书到数据库记录并更新
 */
async function matchAndUpdateCertificates(cloudFiles, dbRecords) {
  const matchResults = {
    shortlisted: { matched: [], unmatched: [] },
    award: { matched: [], unmatched: [] }
  }
  
  let updatedCount = 0
  let failedCount = 0
  
  // 1. 匹配入围证书
  console.log('\n--- 匹配入围证书 ---')
  for (const file of cloudFiles.shortlisted) {
    const fileName = file.name
    const fileSchool = file.school
    
    // 查找匹配的数据库记录
    let bestMatch = null
    let bestScore = 0
    
    for (const record of dbRecords) {
      // 姓名必须匹配
      const nameScore = similarity(fileName, record.name)
      if (nameScore < 0.8) continue
      
      // 学校匹配
      const schoolScore = similarity(fileSchool, record.school)
      
      const totalScore = nameScore * 0.6 + schoolScore * 0.4
      
      if (totalScore > bestScore && totalScore >= 0.7) {
        bestScore = totalScore
        bestMatch = record
      }
    }
    
    if (bestMatch) {
      // 更新数据库
      try {
        await db.collection(TARGET_COLLECTION).doc(bestMatch._id).update({
          data: {
            shortlistedCertificate: file.fileID,
            _certificateUpdatedAt: db.serverDate()
          }
        })
        
        matchResults.shortlisted.matched.push({
          file: `${file.province}/${file.school}/${file.fileName}`,
          matchedTo: `${bestMatch.name} - ${bestMatch.school}`,
          score: bestScore.toFixed(2)
        })
        updatedCount++
      } catch (err) {
        matchResults.shortlisted.unmatched.push({
          file: `${file.province}/${file.school}/${file.fileName}`,
          reason: '更新失败: ' + err.message
        })
        failedCount++
      }
    } else {
      matchResults.shortlisted.unmatched.push({
        file: `${file.province}/${file.school}/${file.fileName}`,
        name: fileName,
        school: fileSchool,
        reason: '未找到匹配记录'
      })
      failedCount++
    }
  }
  
  // 2. 匹配获奖证书
  console.log('\n--- 匹配获奖证书 ---')
  for (const file of cloudFiles.award) {
    const fileName = file.name
    const fileSchool = file.school
    
    let bestMatch = null
    let bestScore = 0
    
    for (const record of dbRecords) {
      // 姓名必须匹配
      const nameScore = similarity(fileName, record.name)
      if (nameScore < 0.8) continue
      
      // 学校匹配
      const schoolScore = similarity(fileSchool, record.school)
      
      const totalScore = nameScore * 0.6 + schoolScore * 0.4
      
      if (totalScore > bestScore && totalScore >= 0.7) {
        bestScore = totalScore
        bestMatch = record
      }
    }
    
    if (bestMatch) {
      try {
        await db.collection(TARGET_COLLECTION).doc(bestMatch._id).update({
          data: {
            awardCertificate: file.fileID,
            _certificateUpdatedAt: db.serverDate()
          }
        })
        
        matchResults.award.matched.push({
          file: `${file.awardCategory}/${file.fileName}`,
          matchedTo: `${bestMatch.name} - ${bestMatch.school}`,
          score: bestScore.toFixed(2)
        })
        updatedCount++
      } catch (err) {
        matchResults.award.unmatched.push({
          file: `${file.awardCategory}/${file.fileName}`,
          reason: '更新失败: ' + err.message
        })
        failedCount++
      }
    } else {
      matchResults.award.unmatched.push({
        file: `${file.awardCategory}/${file.fileName}`,
        name: fileName,
        school: fileSchool,
        reason: '未找到匹配记录'
      })
      failedCount++
    }
  }
  
  // 3. 生成精简报告（只返回未匹配的）
  const report = {
    success: failedCount === 0,
    message: `匹配完成：成功 ${updatedCount} 个，失败 ${failedCount} 个`,
    summary: {
      total: cloudFiles.shortlisted.length + cloudFiles.award.length,
      updated: updatedCount,
      failed: failedCount,
      shortlisted: `${matchResults.shortlisted.matched.length}/${cloudFiles.shortlisted.length}`,
      award: `${matchResults.award.matched.length}/${cloudFiles.award.length}`
    },
    unmatched: {
      shortlisted: matchResults.shortlisted.unmatched,
      award: matchResults.award.unmatched
    }
  }
  
  console.log('\n========================================')
  console.log('匹配结果报告')
  console.log('========================================')
  console.log(`入围证书: ${matchResults.shortlisted.matched.length}/${cloudFiles.shortlisted.length} 匹配成功`)
  console.log(`获奖证书: ${matchResults.award.matched.length}/${cloudFiles.award.length} 匹配成功`)
  
  if (matchResults.shortlisted.unmatched.length > 0) {
    console.log('\n未匹配的入围证书:')
    matchResults.shortlisted.unmatched.slice(0, 10).forEach(u => {
      console.log(`  - ${u.file}: ${u.reason}`)
    })
    if (matchResults.shortlisted.unmatched.length > 10) {
      console.log(`  ... 还有 ${matchResults.shortlisted.unmatched.length - 10} 个`)
    }
  }
  
  if (matchResults.award.unmatched.length > 0) {
    console.log('\n未匹配的获奖证书:')
    matchResults.award.unmatched.slice(0, 10).forEach(u => {
      console.log(`  - ${u.file}: ${u.reason}`)
    })
    if (matchResults.award.unmatched.length > 10) {
      console.log(`  ... 还有 ${matchResults.award.unmatched.length - 10} 个`)
    }
  }
  
  return report
}

/**
 * 获取数据库中所有记录
 */
async function getAllRecordsFromDB() {
  const MAX_LIMIT = 100
  
  try {
    const countResult = await db.collection(TARGET_COLLECTION).count()
    const total = countResult.total
    console.log(`${TARGET_COLLECTION} 表共有 ${total} 条记录`)
    
    if (total === 0) {
      console.log(`警告: ${TARGET_COLLECTION} 表为空`)
      return []
    }
    
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection(TARGET_COLLECTION)
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .field({ _id: true, name: true, school: true, schoolProvinces: true, status: true })
          .get()
      )
    }
    
    const results = await Promise.all(tasks)
    const allRecords = results.reduce((acc, cur) => acc.concat(cur.data), [])
    
    // 打印第一条记录看看字段名称
    if (allRecords.length > 0) {
      console.log('第一条记录示例:', JSON.stringify(allRecords[0]))
    }
    
    return allRecords
  } catch (err) {
    console.error('获取数据库记录失败:', err)
    return []
  }
}

/**
 * 获取获奖记录
 */
async function getAwardRecordsFromDB() {
  const allRecords = await getAllRecordsFromDB()
  const awardStatuses = ['卓越创作奖', '优秀潜力奖', '新锐突破奖']
  
  return allRecords.filter(record => 
    record.status && awardStatuses.some(s => record.status.includes(s))
  )
}

/**
 * 手动更新证书
 */
async function updateCertificatesManual(certificates) {
  console.log(`=== 开始更新证书，共 ${certificates.length} 条 ===`)

  const results = []
  let succeeded = 0
  let failed = 0

  for (let i = 0; i < certificates.length; i++) {
    const cert = certificates[i]
    const { name, school, certificateUrl, type } = cert

    if (!name || !certificateUrl || !type) {
      results.push({
        index: i + 1,
        success: false,
        name,
        school,
        type,
        error: '缺少必要字段'
      })
      failed++
      continue
    }

    try {
      // 更新字段
      const updateField = type === 'award' ? 'awardCertificate' : 'shortlistedCertificate'
      
      // 如果已有 recordId，直接更新
      if (cert.recordId) {
        await db.collection(TARGET_COLLECTION).doc(cert.recordId).update({
          data: {
            [updateField]: certificateUrl,
            _certificateUpdatedAt: db.serverDate()
          }
        })
        
        results.push({
          index: i + 1,
          success: true,
          name,
          school,
          type,
          matchedCount: 1,
          recordIds: [cert.recordId]
        })
        succeeded++
        console.log(`✅ [${i + 1}/${certificates.length}] ${name} - ${school} (${type}) 直接更新成功`)
        continue
      }
      
      // 否则通过姓名和学校查找
      const query = { name: name }
      if (school) {
        query.school = school
      }

      // 查找匹配的记录
      let findResult = await db.collection(TARGET_COLLECTION)
        .where(query)
        .get()

      if (findResult.data.length === 0 && school) {
        // 尝试模糊匹配学校名称
        const fuzzyResult = await db.collection(TARGET_COLLECTION)
          .where({
            name: name,
            school: db.RegExp({
              regexp: school.replace(/[()（）]/g, ''),
              options: 'i'
            })
          })
          .get()
        
        if (fuzzyResult.data.length > 0) {
          findResult = fuzzyResult
        }
      }

      if (findResult.data.length === 0) {
        results.push({
          index: i + 1,
          success: false,
          name,
          school,
          type,
          error: `未找到匹配记录: ${name} - ${school || '未知学校'}`
        })
        failed++
        continue
      }

      // 如果找到多条记录，全部更新
      for (const record of findResult.data) {
        await db.collection(TARGET_COLLECTION).doc(record._id).update({
          data: {
            [updateField]: certificateUrl,
            _certificateUpdatedAt: db.serverDate()
          }
        })
      }

      results.push({
        index: i + 1,
        success: true,
        name,
        school,
        type,
        matchedCount: findResult.data.length,
        recordIds: findResult.data.map(r => r._id)
      })
      succeeded++

      console.log(`✅ [${i + 1}/${certificates.length}] ${name} - ${school} (${type}) 更新成功`)

    } catch (err) {
      results.push({
        index: i + 1,
        success: false,
        name,
        school,
        type,
        error: err.message
      })
      failed++
      console.error(`❌ [${i + 1}/${certificates.length}] ${name} 更新失败:`, err.message)
    }
  }

  const message = `证书更新完成：成功 ${succeeded} 条，失败 ${failed} 条`
  console.log(message)

  return {
    success: failed === 0,
    message,
    data: {
      total: certificates.length,
      succeeded,
      failed,
      results
    }
  }
}
