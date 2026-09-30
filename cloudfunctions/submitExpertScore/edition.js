const DEFAULT_CURRENT_EDITION_ID = 'pottery-2026';
const DEFAULT_SCHEMA_VERSION = 2;

const DEFAULT_EDITIONS = {
  'pottery-2026': {
    editionId: 'pottery-2026',
    year: 2026,
    editionNumber: 3,
    title: '第三届全国大学生陶艺作品展',
    status: 'preparing',
    isCurrent: true,
    publicVisible: true,
    readOnly: false,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    collectionMap: {
      submissions: 'pottery_submissions_2026',
      cleaned: 'pottery_submissions_clean_2026',
      preliminary: 'pottery_submissions_preliminary_2026',
      finalScoring: 'pottery_submissions_for_final_2026',
      finalResults: 'pottery_submissions_final_2026',
      deliveries: 'artwork_deliveries_2026',
      catalog: 'secondWorks_2026'
    },
    featureFlags: {
      registration: false,
      delivery: false,
      expertEvaluation: false,
      shortlistedQuery: false,
      awardQuery: false,
      catalog: false,
      videoUpload: false
    }
  },
  'pottery-2025': {
    editionId: 'pottery-2025',
    year: 2025,
    editionNumber: 2,
    title: '第二届全国大学生陶艺作品展',
    status: 'archived',
    isCurrent: false,
    publicVisible: true,
    readOnly: true,
    schemaVersion: 1,
    collectionMap: {
      submissions: 'pottery_submissions',
      cleaned: 'pottery_submissions_clean',
      preliminary: 'pottery_submissions_preliminary',
      finalScoring: 'pottery_submissions_for_final',
      finalResults: 'pottery_submissions_final',
      deliveries: 'artwork_deliveries',
      catalog: 'secondWorks'
    },
    featureFlags: {
      registration: false,
      delivery: false,
      expertEvaluation: false,
      shortlistedQuery: true,
      awardQuery: true,
      catalog: true,
      videoUpload: false
    }
  }
};

function normalizeFeatureFlags(rawFlags) {
  if (typeof rawFlags === 'string') {
    try {
      return JSON.parse(rawFlags);
    } catch (error) {
      console.warn('[edition] featureFlags 不是有效 JSON，使用默认开关');
      return {};
    }
  }
  return rawFlags && typeof rawFlags === 'object' ? rawFlags : {};
}

function controlsToFeatureFlags(controls = {}) {
  controls = controls || {};
  const fieldMap = {
    registrationEnabled: 'registration',
    deliveryEnabled: 'delivery',
    expertEvaluationEnabled: 'expertEvaluation',
    shortlistedQueryEnabled: 'shortlistedQuery',
    awardQueryEnabled: 'awardQuery',
    catalogEnabled: 'catalog'
  };
  return Object.keys(fieldMap).reduce((flags, field) => {
    if (typeof controls[field] === 'boolean') {
      flags[fieldMap[field]] = controls[field];
    }
    return flags;
  }, {});
}

function normalizeEdition(doc, controls) {
  const fallback = DEFAULT_EDITIONS[doc && doc.editionId] || {};
  return {
    ...fallback,
    ...doc,
    collectionMap: {
      ...(fallback.collectionMap || {}),
      ...((doc && doc.collectionMap) || {})
    },
    featureFlags: {
      ...(fallback.featureFlags || {}),
      ...normalizeFeatureFlags(doc && doc.featureFlags),
      ...controlsToFeatureFlags(controls)
    },
    runtimeControls: controls || null
  };
}

async function fetchEditionFromDb(db, editionId) {
  if (!db || !editionId) {
    return null;
  }

  try {
    const result = await db.collection('exhibition_editions')
      .where({ editionId })
      .limit(1)
      .get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn('[edition] 读取 exhibition_editions 失败，使用内置配置:', error.message);
    return null;
  }
}

async function fetchCurrentEditionFromDb(db) {
  if (!db) {
    return null;
  }

  try {
    const result = await db.collection('exhibition_editions')
      .where({ isCurrent: true })
      .limit(1)
      .get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    console.warn('[edition] 读取当前届次失败，使用内置当前届:', error.message);
    return null;
  }
}

async function fetchEditionControlsFromDb(db, editionId) {
  if (!db || !editionId) return null;
  try {
    const result = await db.collection('edition_controls')
      .where({ editionId })
      .limit(1)
      .get();
    return result.data && result.data[0] ? result.data[0] : null;
  } catch (error) {
    // 控制模型尚未创建或暂不可用时，继续兼容既有 exhibition_editions 配置。
    console.warn('[edition] 读取 edition_controls 失败，使用届次原有配置:', error.message);
    return null;
  }
}

async function resolveEdition(db, options = {}) {
  const mode = options.mode || 'read';
  let editionId = options.editionId || DEFAULT_CURRENT_EDITION_ID;
  let editionDoc = null;

  if (options.useCurrent || !options.editionId) {
    editionDoc = await fetchCurrentEditionFromDb(db);
    editionId = (editionDoc && editionDoc.editionId) || editionId;
  }

  if (!editionDoc) {
    editionDoc = await fetchEditionFromDb(db, editionId);
  }

  const controls = await fetchEditionControlsFromDb(db, editionId);
  const edition = normalizeEdition(editionDoc || DEFAULT_EDITIONS[editionId], controls);

  if (!edition || !edition.editionId) {
    const error = new Error(`未知届次: ${editionId}`);
    error.code = 'UNKNOWN_EDITION';
    throw error;
  }

  if (mode === 'write' && edition.readOnly) {
    const error = new Error(`届次 ${edition.editionId} 为历史只读届次，禁止写入`);
    error.code = 'READONLY_EDITION';
    throw error;
  }

  return edition;
}

function publicEdition(edition) {
  return {
    editionId: edition.editionId,
    year: edition.year,
    editionNumber: edition.editionNumber,
    title: edition.title,
    status: edition.status,
    isCurrent: !!edition.isCurrent,
    publicVisible: !!edition.publicVisible,
    readOnly: !!edition.readOnly,
    featureFlags: edition.featureFlags || {}
  };
}

function collectionName(edition, key) {
  const name = edition.collectionMap && edition.collectionMap[key];
  if (!name) {
    const error = new Error(`届次 ${edition.editionId} 缺少集合映射: ${key}`);
    error.code = 'MISSING_COLLECTION_MAP';
    throw error;
  }
  return name;
}

function buildEditionFields(edition) {
  return {
    editionId: edition.editionId,
    schemaVersion: edition.schemaVersion || DEFAULT_SCHEMA_VERSION
  };
}

function categoryCode(category) {
  const value = String(category || '').trim().toLowerCase();
  if (value.includes('传统') || value.includes('匠心传承')) return 'CT';
  if (value.includes('当代') || value.includes('当代表达')) return 'DD';
  if (value.includes('数字') || value.includes('数字传媒')) return 'SZ';
  if (value.includes('国际') || value.includes('全球视野')) return 'GJ';
  if (value.includes('技艺') || value.includes('technique')) return 'JY';
  if (value.includes('文脉') || value.includes('culture')) return 'WM';
  if (value.includes('算法') || value.includes('algorithm')) return 'SF';
  if (value.includes('产业') || value.includes('industry')) return 'CY';
  if (value.includes('视界') || value.includes('vision')) return 'SJ';
  return 'QT';
}

async function generateWorkCode(db, edition, category) {
  const prefix = `POT${edition.year}-${categoryCode(category)}-`;
  const collection = db.collection(collectionName(edition, 'submissions'));
  const countResult = await collection.where({
    editionId: edition.editionId,
    workCode: db.RegExp({
      regexp: `^${prefix}`,
      options: ''
    })
  }).count();
  let sequenceNumber = countResult.total || 0;
  // 计数只用于产生可读的起始序号；提交并发时再逐个检查候选编号，避免
  // “count + 1” 直接造成明显重复。若连续碰撞，则使用同格式随机序号。
  for (let attempt = 0; attempt < 10; attempt += 1) {
    sequenceNumber += 1;
    const candidate = `${prefix}${String(sequenceNumber).padStart(6, '0')}`;
    const existing = await collection.where({ workCode: candidate }).limit(1).get();
    if (!existing.data || existing.data.length === 0) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const randomSequence = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const candidate = `${prefix}${randomSequence}`;
    const existing = await collection.where({ workCode: candidate }).limit(1).get();
    if (!existing.data || existing.data.length === 0) {
      return candidate;
    }
  }

  throw new Error('作品编号生成失败，请稍后重试');
}

module.exports = {
  DEFAULT_CURRENT_EDITION_ID,
  DEFAULT_EDITIONS,
  DEFAULT_SCHEMA_VERSION,
  buildEditionFields,
  collectionName,
  generateWorkCode,
  publicEdition,
  resolveEdition
};
