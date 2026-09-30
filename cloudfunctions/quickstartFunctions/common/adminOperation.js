const crypto = require('crypto');
const { TARGETS, resolveClearTarget } = require('./clearReviewTable');

const OPERATION_STATES = {
  DRAFT: 'DRAFT',
  PREVIEWED: 'PREVIEWED',
  BACKED_UP: 'BACKED_UP',
  CONFIRMED: 'CONFIRMED',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED'
};

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

const DANGEROUS_OPERATIONS = {
  cleanSubmissionsData: {
    label: '数据清洗',
    sourceKeys: ['submissions'],
    targetKeys: ['cleaned'],
    impact: '会重建清洗表，可能影响已有初评评分'
  },
  generatePreliminaryTable: {
    label: '生成初评结果表',
    sourceKeys: ['cleaned'],
    targetKeys: ['preliminary'],
    impact: '会按类别名额和每校至少1件重建初评结果表；先核对终评名额能否覆盖所有院校，无可行名单时不覆盖结果表'
  },
  startFinalEvaluation: {
    label: '开始终评',
    sourceKeys: ['cleaned', 'preliminary'],
    targetKeys: ['finalScoring'],
    impact: '会先核对院校覆盖与终评类别名额，再重建终评评分表；已有终评分数时禁止覆盖'
  },
  generateFinalRanking: {
    label: '生成终评结果表',
    sourceKeys: ['cleaned', 'finalScoring'],
    targetKeys: ['finalResults'],
    impact: '会按类别名额和每校至少1件重建终评结果及排名；无可行名单时不覆盖结果表，获奖名额仍由人工确定'
  },
  clearCleanTable: {
    label: '清空清洗表',
    sourceKeys: [],
    targetKeys: ['cleaned'],
    impact: '删除初评清洗表全部作品、评分及取消资格记录；后续阶段不会自动清空，关联可能失效。原始报名表不变。'
  },
  clearPreliminaryTable: {
    label: '清空初评结果表', sourceKeys: [], targetKeys: ['preliminary'],
    impact: '删除初评结果名单；终评评分表不会自动清空。初评分数及原始报名表不变。'
  },
  clearFinalScoringTable: {
    label: '清空终评评分表', sourceKeys: [], targetKeys: ['finalScoring'],
    impact: '删除终评作品和评分；最终结果不会自动清空。前面阶段及原始报名表不变。'
  },
  clearFinalResultsTable: {
    label: '清空终评结果表', sourceKeys: [], targetKeys: ['finalResults'],
    impact: '删除最终名单、奖项状态和证书关联；入围及获奖查询受影响。前面阶段及原始报名表不变，云存储证书文件不删除。'
  },
  copyFullTable: {
    label: '全表复制',
    sourceKeys: [],
    targetKeys: [],
    impact: '会批量复制或覆盖目标表'
  },
  replaceQualifiedWorks: {
    label: '替换入围作品',
    sourceKeys: ['finalResults'],
    targetKeys: ['finalResults'],
    impact: '会替换入围作品状态'
  },
  removeDuplicates: {
    label: '去重',
    sourceKeys: [],
    targetKeys: [],
    impact: '会批量删除或标记重复记录'
  },
  updateAwardStatus: {
    label: '批量更新奖项',
    sourceKeys: ['finalResults'],
    targetKeys: ['finalResults'],
    impact: '会批量修改获奖状态'
  },
  uploadCertificates: {
    label: '批量上传或替换证书',
    sourceKeys: ['finalResults'],
    targetKeys: ['finalResults'],
    impact: '会批量新增或替换证书记录'
  },
  clearTestData: {
    label: '清空测试数据',
    sourceKeys: [],
    targetKeys: ['submissions', 'cleaned', 'preliminary', 'finalScoring', 'finalResults', 'deliveries'],
    impact: '会批量清空当前届测试业务数据'
  },
  clearAllData: {
    label: '清空全部业务数据',
    sourceKeys: [],
    targetKeys: ['submissions', 'cleaned', 'preliminary', 'finalScoring', 'finalResults', 'deliveries', 'catalog'],
    impact: '会批量清空当前届核心业务数据，风险极高'
  },
  fixDateFormat: {
    label: '批量修复日期格式',
    sourceKeys: ['submissions', 'deliveries'],
    targetKeys: ['submissions', 'deliveries'],
    impact: '会批量更新报名和送件记录中的日期字段'
  },
  swapEvaluations: {
    label: '交换评审数据',
    sourceKeys: ['cleaned', 'finalScoring'],
    targetKeys: ['cleaned', 'finalScoring'],
    impact: '会批量调整作品评审记录，可能影响排名结果'
  },
  convertImageLinks: {
    label: '转换图片链接',
    sourceKeys: ['submissions', 'cleaned', 'preliminary', 'finalScoring', 'finalResults'],
    targetKeys: ['submissions', 'cleaned', 'preliminary', 'finalScoring', 'finalResults'],
    impact: '会批量改写作品图片链接字段'
  },
  clearCloudStorageFiles: {
    label: '清理云存储文件',
    sourceKeys: [],
    targetKeys: [],
    impact: '会批量删除或移动云存储文件，必须先导出存储清单并单独确认'
  }
};

function normalizeOperationName(operationName) {
  if (!DANGEROUS_OPERATIONS[operationName]) {
    throw new Error('未知危险操作');
  }
  return operationName;
}

function normalizeEditionId(editionId) {
  return editionId || 'pottery-2026';
}

function assertWritableEdition(edition) {
  if (!edition || !edition.editionId) {
    throw new Error('缺少届次配置');
  }
  if (edition.readOnly) {
    throw new Error('历史只读届次不允许执行危险操作');
  }
}

function collectionNamesForOperation(operationName, edition) {
  if (Object.prototype.hasOwnProperty.call(TARGETS, operationName)) resolveClearTarget(operationName, edition);
  const definition = DANGEROUS_OPERATIONS[operationName];
  const collectionMap = edition.collectionMap || {};
  return {
    sourceCollections: definition.sourceKeys.map(key => collectionMap[key]).filter(Boolean),
    targetCollections: definition.targetKeys.map(key => collectionMap[key]).filter(Boolean)
  };
}

function createOperationId(operationName, editionId, now = Date.now()) {
  const random = crypto.randomBytes(4).toString('hex');
  return `${editionId}_${operationName}_${now}_${random}`;
}

function createConfirmationCode() {
  const value = crypto.randomInt(100000, 1000000).toString();
  return value;
}

function hashConfirmationCode(code) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

function validateConfirmationCode({ code, expectedHash, issuedAt, now = Date.now() }) {
  if (!code || !expectedHash || !issuedAt) {
    return false;
  }
  if (now - Number(issuedAt) > CONFIRMATION_TTL_MS) {
    return false;
  }
  return hashConfirmationCode(code) === expectedHash;
}

function assertPassphrase(editionId, phrase) {
  if (phrase !== editionId) {
    throw new Error('届次口令错误');
  }
}

function buildPreview({ operationName, edition, counts = {}, environment = 'unknown' }) {
  const name = normalizeOperationName(operationName);
  assertWritableEdition(edition);
  const definition = DANGEROUS_OPERATIONS[name];
  const collections = collectionNamesForOperation(name, edition);
  const sourceRecordCount = collections.sourceCollections.reduce((sum, collection) => sum + Number(counts[collection] || 0), 0);
  const targetRecordCount = collections.targetCollections.reduce((sum, collection) => sum + Number(counts[collection] || 0), 0);

  return {
    operationName: name,
    operationLabel: definition.label,
    environment,
    editionId: edition.editionId,
    sourceCollections: collections.sourceCollections,
    targetCollections: collections.targetCollections,
    sourceRecordCount,
    targetRecordCount,
    estimatedImpact: definition.impact,
    warnings: targetRecordCount > 0 ? ['目标集合已有数据，执行前必须备份'] : [],
    nextRequiredAction: 'BACKUP'
  };
}

module.exports = {
  CONFIRMATION_TTL_MS,
  DANGEROUS_OPERATIONS,
  OPERATION_STATES,
  assertPassphrase,
  assertWritableEdition,
  buildPreview,
  collectionNamesForOperation,
  createConfirmationCode,
  createOperationId,
  hashConfirmationCode,
  normalizeEditionId,
  normalizeOperationName,
  validateConfirmationCode
};
