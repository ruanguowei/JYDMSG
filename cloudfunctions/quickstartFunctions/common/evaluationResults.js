const { normalizeCategory, eligible } = require('./evaluationRules');
const { collectionName, publicEdition, resolveEdition } = require('./edition')

async function loadExpertResults(db, options = {}) {
  const edition = await resolveEdition(db, {
    editionId: options.editionId,
    useCurrent: !options.editionId,
    mode: 'read'
  })
  const expertId = options.expertId
  if (!expertId) {
    const error = new Error('缺少专家身份')
    error.code = 'MISSING_EXPERT_ID'
    throw error
  }

  const expertResult = await db.collection('experts').doc(expertId).get()
  const expert = expertResult.data
  if (!expert) {
    const error = new Error('专家信息不存在')
    error.code = 'EXPERT_NOT_FOUND'
    throw error
  }

  const targetCollection = collectionName(
    edition,
    expert.expertType === 'final' ? 'finalScoring' : 'cleaned'
  )
  const works = []
  const pageSize = 100
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const result = await db.collection(targetCollection)
      .skip(skip)
      .limit(pageSize)
      .get()
    works.push(...(result.data || []))
    skip += pageSize
    hasMore = (result.data || []).length === pageSize
  }

  const expertCode = expert.expertCode
  const results = []
  for (const item of works) {
    if (!eligible(item)) continue;
    const evaluations = Array.isArray(item.evaluations) ? item.evaluations : []
    const evaluation = evaluations.find(record =>
      record && (record.expertId === expertId || (expertCode && record.expertCode === expertCode))
    )
    if (!evaluation) continue

    results.push({
      id: item._id,
      title: item.artworkName || item.title || '',
      category: normalizeCategory(item.category).key,
      categoryName: normalizeCategory(item.category).name,
      imageUrl: item.perspectiveImage || item.imageUrl || '',
      description: item.artworkDescription || item.description || '',
      baseScore: evaluation.baseScore ?? evaluation.rawTotalScore ?? evaluation.totalScore ?? 0,
      deductionScore: evaluation.deductionScore ?? 0,
      totalScore: evaluation.finalScore ?? evaluation.totalScore ?? 0,
      evaluationTime: evaluation.evaluationTime || null
    })
  }

  return {
    edition,
    expert,
    targetCollection,
    results
  }
}

module.exports = {
  loadExpertResults,
  publicEdition
}
