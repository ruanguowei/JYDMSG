const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { awardList, mode = 'best-effort' } = event
  
  if (!awardList || typeof awardList !== 'object') {
    return {
      success: false,
      message: '参数错误：缺少 awardList 或格式不正确',
      error: { code: 'INVALID_PARAMS' }
    }
  }

  const categories = ['技艺类', '文脉类', '算法类', '产业类']
  const results = []
  const categoryStats = {}
  let totalSucceeded = 0
  let totalFailed = 0
  let globalIndex = 0

  for (const category of categories) {
    const works = awardList[category]
    if (!Array.isArray(works)) {
      categoryStats[category] = { total: 0, succeeded: 0, failed: 0 }
      continue
    }

    categoryStats[category] = { total: works.length, succeeded: 0, failed: 0 }

    for (const work of works) {
      globalIndex++
      const { 排名: rank, 作品名称: workName, 作者姓名: authorName, 获奖情况: awardStatus } = work

      if (!workName || !awardStatus) {
        const errorResult = {
          index: globalIndex,
          success: false,
          category,
          rank,
          workName,
          authorName,
          awardStatus,
          error: '缺少作品名称或获奖情况'
        }
        results.push(errorResult)
        categoryStats[category].failed++
        totalFailed++

        if (mode === 'stop-on-error') {
          return buildErrorResponse(mode, globalIndex, totalSucceeded, totalFailed, categoryStats, results, '遇到错误，停止执行')
        }
        if (mode === 'all-or-nothing') {
          continue
        }
        continue
      }

      try {
        // 查找作品：先按作品名称查找
        let matchResult = await findWork(workName, authorName)

        if (!matchResult.success) {
          const errorResult = {
            index: globalIndex,
            success: false,
            category,
            rank,
            workName,
            authorName,
            awardStatus,
            error: matchResult.error
          }
          results.push(errorResult)
          categoryStats[category].failed++
          totalFailed++

          if (mode === 'stop-on-error') {
            return buildErrorResponse(mode, globalIndex, totalSucceeded, totalFailed, categoryStats, results, '遇到错误，停止执行')
          }
          continue
        }

        // 更新 status 字段
        const record = matchResult.record
        const oldStatus = record.status || ''

        await db.collection('pottery_submissions_final').doc(record._id).update({
          data: {
            status: awardStatus,
            _awardUpdatedAt: db.serverDate()
          }
        })

        const successResult = {
          index: globalIndex,
          success: true,
          category,
          rank,
          workName,
          authorName,
          awardStatus,
          recordId: record._id,
          oldStatus
        }
        results.push(successResult)
        categoryStats[category].succeeded++
        totalSucceeded++

      } catch (err) {
        const errorResult = {
          index: globalIndex,
          success: false,
          category,
          rank,
          workName,
          authorName,
          awardStatus,
          error: err.message || '更新失败'
        }
        results.push(errorResult)
        categoryStats[category].failed++
        totalFailed++

        if (mode === 'stop-on-error') {
          return buildErrorResponse(mode, globalIndex, totalSucceeded, totalFailed, categoryStats, results, '遇到错误，停止执行')
        }
      }
    }
  }

  // all-or-nothing 模式：如果有失败的，不执行任何更新
  if (mode === 'all-or-nothing' && totalFailed > 0) {
    return {
      success: false,
      message: `匹配失败，取消所有更新（${totalFailed}件有问题）`,
      error: {
        mode,
        total: globalIndex,
        matchErrors: results.filter(r => !r.success)
      }
    }
  }

  const total = totalSucceeded + totalFailed
  let message = ''
  if (totalFailed === 0) {
    message = `获奖状态更新完成：${total}件全部成功`
  } else {
    message = `获奖状态更新完成：成功${totalSucceeded}件，失败${totalFailed}件`
  }

  return {
    success: totalFailed === 0,
    message,
    data: {
      mode,
      total,
      succeeded: totalSucceeded,
      failed: totalFailed,
      categoryStats,
      results,
      operationTime: new Date().toISOString()
    }
  }
}

// 查找作品
async function findWork(workName, authorName) {
  const db = cloud.database()
  const _ = db.command

  // 清理作品名称（去除书名号等）
  const cleanWorkName = workName.replace(/[《》「」『』【】]/g, '').trim()
  
  // 尝试多种匹配方式
  let records = []

  // 1. 精确匹配 artworkName
  let res = await db.collection('pottery_submissions_final')
    .where({ artworkName: workName })
    .get()
  records = res.data

  // 2. 如果没找到，尝试匹配清理后的名称
  if (records.length === 0 && cleanWorkName !== workName) {
    res = await db.collection('pottery_submissions_final')
      .where({ artworkName: cleanWorkName })
      .get()
    records = res.data
  }

  // 3. 尝试匹配 title 字段
  if (records.length === 0) {
    res = await db.collection('pottery_submissions_final')
      .where({ title: workName })
      .get()
    records = res.data
  }

  if (records.length === 0 && cleanWorkName !== workName) {
    res = await db.collection('pottery_submissions_final')
      .where({ title: cleanWorkName })
      .get()
    records = res.data
  }

  // 4. 使用正则模糊匹配
  if (records.length === 0) {
    res = await db.collection('pottery_submissions_final')
      .where({
        artworkName: db.RegExp({
          regexp: cleanWorkName,
          options: 'i'
        })
      })
      .get()
    records = res.data
  }

  if (records.length === 0) {
    return {
      success: false,
      error: `未找到作品: "${workName}"`
    }
  }

  // 如果只有一条记录，直接返回
  if (records.length === 1) {
    return { success: true, record: records[0] }
  }

  // 多条记录时，通过作者姓名进一步匹配
  if (!authorName) {
    return {
      success: false,
      error: `找到${records.length}条同名作品，但缺少作者姓名无法区分`
    }
  }

  // 解析作者姓名（支持多作者）
  const authorNames = authorName.split(/[、,，\s]+/).map(n => n.trim()).filter(n => n)

  for (const record of records) {
    const recordAuthor = record.authorName || record.author || ''
    const recordAuthors = recordAuthor.split(/[、,，\s]+/).map(n => n.trim()).filter(n => n)

    // 检查是否有任意一个作者匹配
    const hasMatch = authorNames.some(name => 
      recordAuthors.some(rName => rName.includes(name) || name.includes(rName))
    )

    if (hasMatch) {
      return { success: true, record }
    }
  }

  return {
    success: false,
    error: `找到${records.length}条同名作品，但作者姓名不匹配: "${authorName}"`
  }
}

function buildErrorResponse(mode, total, succeeded, failed, categoryStats, results, message) {
  return {
    success: false,
    message,
    error: {
      mode,
      total,
      succeeded,
      failed,
      categoryStats,
      results,
      operationTime: new Date().toISOString()
    }
  }
}
