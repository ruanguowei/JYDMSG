const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { clearReviewTable } = require('../common/clearReviewTable');
const { resolveEdition } = require('../common/edition');
const {
  OPERATION_STATES,
  assertPassphrase,
  buildPreview,
  createConfirmationCode,
  createOperationId,
  hashConfirmationCode,
  normalizeEditionId,
  normalizeOperationName,
  validateConfirmationCode
} = require('../common/adminOperation');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

async function requireAdmin(db, event) {
  const admin = event.admin || {};
  if (!admin.account || !admin.id) {
    throw new Error('缺少管理员身份信息');
  }

  const result = await db.collection('admin').doc(admin.id).get();
  if (!result.data || result.data.account !== admin.account) {
    throw new Error('管理员身份校验失败');
  }

  return {
    id: result.data._id,
    account: result.data.account
  };
}

async function countCollection(db, collectionName) {
  if (!collectionName) return 0;
  try {
    const result = await db.collection(collectionName).count();
    return result.total || 0;
  } catch (error) {
    return 0;
  }
}

async function readCollectionSnapshot(db, collectionName) {
  const pageSize = 100;
  const rows = [];
  let skip = 0;
  while (true) {
    const result = await db.collection(collectionName).skip(skip).limit(pageSize).get();
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    skip += page.length;
  }
  return rows;
}

function stableJson(value) {
  return JSON.stringify(value, (key, item) => {
    if (item instanceof Date) return item.toISOString();
    return item;
  });
}

async function previewOperation(db, event) {
  const operationName = normalizeOperationName(event.operationName);
  const editionId = normalizeEditionId(event.editionId);
  const edition = await resolveEdition(db, { editionId, mode: 'write' });
  const preview = buildPreview({
    operationName,
    edition,
    environment: event.environment || 'unknown'
  });

  const counts = {};
  for (const collection of [...preview.sourceCollections, ...preview.targetCollections]) {
    counts[collection] = await countCollection(db, collection);
  }

  const operationId = createOperationId(operationName, edition.editionId);
  const previewSummary = buildPreview({
    operationName,
    edition,
    counts,
    environment: event.environment || 'unknown'
  });
  await db.collection('operation_logs').add({
    data: {
      operationId,
      operationName,
      editionId: edition.editionId,
      state: OPERATION_STATES.PREVIEWED,
      previewSummary,
      createdBy: (event.admin && event.admin.account) || 'unknown',
      createdAt: Date.now()
    }
  });

  return {
    operationId,
    state: OPERATION_STATES.PREVIEWED,
    preview: previewSummary
  };
}

async function createBackupManifest(db, event, admin) {
  const operationName = normalizeOperationName(event.operationName);
  const editionId = normalizeEditionId(event.editionId);
  const edition = await resolveEdition(db, { editionId, mode: 'write' });
  const previewData = buildPreview({
    operationName,
    edition,
    environment: event.environment || 'unknown'
  });
  const operationId = event.operationId || createOperationId(operationName, edition.editionId);
  const backupId = `${operationId}_backup`;
  const now = Date.now();

  const previewLog = await findLatestOperationLog(db, operationId, OPERATION_STATES.PREVIEWED);
  if (!previewLog || previewLog.editionId !== edition.editionId || previewLog.operationName !== operationName || previewLog.createdBy !== admin.account) {
    throw new Error('未找到预检记录，不能创建备份');
  }

  const existingBackup = await findLatestOperationLog(db, operationId, OPERATION_STATES.BACKED_UP);
  if (existingBackup && existingBackup.backupId === backupId) {
    const existing = await db.collection('data_backups').where({ backupId }).limit(1).get();
    return {
      operationId,
      state: OPERATION_STATES.BACKED_UP,
      backup: (existing.data && existing.data[0]) || existingBackup
    };
  }

  const counts = {};
  const snapshot = {};
  for (const collection of previewData.targetCollections) {
    const rows = await readCollectionSnapshot(db, collection);
    snapshot[collection] = rows;
    counts[collection] = rows.length;
  }

  const snapshotJson = stableJson({
    operationId,
    editionId: edition.editionId,
    operationName,
    createdAt: now,
    collections: snapshot
  });
  const fileHash = crypto.createHash('sha256').update(snapshotJson).digest('hex');
  const snapshotBuffer = Buffer.from(snapshotJson, 'utf8');
  const chunkSize = 4 * 1024 * 1024;
  const uploadedFiles = [];
  for (let offset = 0, index = 0; offset < snapshotBuffer.length; offset += chunkSize, index += 1) {
    const filePath = `backups/${edition.editionId}/${operationId}/snapshot-${String(index + 1).padStart(4, '0')}.json.part`;
    const uploadResult = await cloud.uploadFile({
      cloudPath: filePath,
      fileContent: snapshotBuffer.slice(offset, Math.min(offset + chunkSize, snapshotBuffer.length))
    });
    uploadedFiles.push({
      path: filePath,
      fileId: uploadResult.fileID,
      index: index + 1,
      sizeBytes: Math.min(chunkSize, snapshotBuffer.length - offset)
    });
  }

  const backupRecord = {
    backupId,
    operationId,
    operationName,
    editionId: edition.editionId,
    collections: previewData.targetCollections,
    counts,
    path: uploadedFiles[0] && uploadedFiles[0].path,
    fileId: uploadedFiles[0] && uploadedFiles[0].fileId,
    files: uploadedFiles,
    sizeBytes: snapshotBuffer.length,
    fileHash,
    status: 'exported',
    createdBy: admin.account,
    createdAt: now,
    restoreNote: '备份文件为 JSON 快照；恢复前必须单独完成预检、权限校验和人工确认。'
  };

  await db.collection('data_backups').add({ data: backupRecord });
  await db.collection('operation_logs').add({
    data: {
      operationId,
      operationName,
      editionId: edition.editionId,
      state: OPERATION_STATES.BACKED_UP,
      backupId,
      previewSummary: previewData,
      createdBy: admin.account,
      createdAt: now
    }
  });

  return {
    operationId,
    state: OPERATION_STATES.BACKED_UP,
    backup: backupRecord
  };
}

async function issueConfirmation(db, event, admin) {
  const operationName = normalizeOperationName(event.operationName);
  const editionId = normalizeEditionId(event.editionId);
  const edition = await resolveEdition(db, { editionId, mode: 'write' });
  const operationId = event.operationId || createOperationId(operationName, edition.editionId);
  const backupLog = await findLatestOperationLog(db, operationId, OPERATION_STATES.BACKED_UP);
  if (!backupLog || backupLog.editionId !== edition.editionId || backupLog.operationName !== operationName || backupLog.createdBy !== admin.account) {
    throw new Error('未找到备份记录，不能生成确认码');
  }
  const code = createConfirmationCode();
  const issuedAt = Date.now();

  await db.collection('operation_logs').add({
    data: {
      operationId,
      operationName,
      editionId: edition.editionId,
      state: OPERATION_STATES.CONFIRMED,
      confirmationHash: hashConfirmationCode(code),
      tieResolutionHash: crypto.createHash('sha256').update(JSON.stringify(event.tieResolution || null)).digest('hex'),
      confirmationIssuedAt: issuedAt,
      createdBy: admin.account,
      createdAt: issuedAt
    }
  });

  return {
    operationId,
    state: OPERATION_STATES.CONFIRMED,
    confirmationCode: code,
    expiresInSeconds: 600
  };
}

async function findLatestOperationLog(db, operationId, state) {
  const result = await db.collection('operation_logs')
    .where({ operationId, state })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return result.data && result.data[0];
}

async function executeOperation(db, event, admin) {
  const operationName = normalizeOperationName(event.operationName);
  const editionId = normalizeEditionId(event.editionId);
  const edition = await resolveEdition(db, { editionId, mode: 'write' });
  const operationId = event.operationId || '';
  if (!operationId) {
    throw new Error('缺少操作编号');
  }

  assertPassphrase(edition.editionId, event.passphrase);

  const backupLog = await findLatestOperationLog(db, operationId, OPERATION_STATES.BACKED_UP);
  if (!backupLog) {
    throw new Error('未找到备份记录，不能执行危险操作');
  }

  const confirmationLog = await findLatestOperationLog(db, operationId, OPERATION_STATES.CONFIRMED);
  if (!confirmationLog) {
    throw new Error('未找到确认码记录');
  }
  if (confirmationLog.tieResolutionHash !== crypto.createHash('sha256').update(JSON.stringify(event.tieResolution || null)).digest('hex')) {
    throw new Error('人工同分选择已改变，请重新生成确认码');
  }

  if (!validateConfirmationCode({
    code: event.confirmationCode,
    expectedHash: confirmationLog.confirmationHash,
    issuedAt: confirmationLog.confirmationIssuedAt
  })) {
    throw new Error('确认码无效或已过期');
  }

  if (confirmationLog.operationName !== operationName || confirmationLog.editionId !== edition.editionId || backupLog.editionId !== edition.editionId || backupLog.operationName !== operationName || confirmationLog.createdBy !== admin.account || backupLog.createdBy !== admin.account) {
    throw new Error('确认码与危险操作不匹配');
  }

  const existingSucceeded = await findLatestOperationLog(db, operationId, OPERATION_STATES.SUCCEEDED);
  if (existingSucceeded) return { operationId, operationName, editionId: edition.editionId, state: OPERATION_STATES.SUCCEEDED, message: '该操作已完成', result: existingSucceeded.result };
  const existingFailed = await findLatestOperationLog(db, operationId, OPERATION_STATES.FAILED);
  if (existingFailed) throw new Error('该操作已有失败记录，请使用新的预检编号重新开始');
  const existingRunning = await findLatestOperationLog(db, operationId, OPERATION_STATES.RUNNING);
  if (existingRunning) {
    return {
      operationId,
      operationName,
      editionId: edition.editionId,
      state: OPERATION_STATES.RUNNING,
      message: '该操作已在执行中，拒绝重复提交。'
    };
  }
  // A deterministic transaction lock prevents two clients executing the same confirmation.
  const lockId = 'run_' + crypto.createHash('sha256').update(operationId).digest('hex').slice(0, 24);
  await db.runTransaction(async transaction => {
    const lock = transaction.collection('operation_logs').doc(lockId);
    if ((await lock.get()).data) throw new Error('该操作已在执行中，拒绝重复提交');
    await lock.set({ data: {
      operationId,
      operationName,
      editionId: edition.editionId,
      state: OPERATION_STATES.RUNNING,
      backupId: backupLog.backupId,
      createdBy: admin.account,
      createdAt: Date.now()
    } });
  });

  const executors = {
    clearCleanTable: () => ({ main: () => clearReviewTable(db, 'clearCleanTable', edition) }),
    clearPreliminaryTable: () => ({ main: () => clearReviewTable(db, 'clearPreliminaryTable', edition) }),
    clearFinalScoringTable: () => ({ main: () => clearReviewTable(db, 'clearFinalScoringTable', edition) }),
    clearFinalResultsTable: () => ({ main: () => clearReviewTable(db, 'clearFinalResultsTable', edition) }),
    cleanSubmissionsData: () => require('../cleanSubmissionsData/index'),
    generatePreliminaryTable: () => require('../generatePreliminaryTable/index'),
    startFinalEvaluation: () => require('../startFinalEvaluation/index'),
    generateFinalRanking: () => require('../generateFinalRanking/index')
  };
  let result;
  try {
    if (!executors[operationName]) throw new Error('该操作尚未接入执行器');
    result = await executors[operationName]().main({ editionId: edition.editionId, tieResolution: event.tieResolution });
    if (!result.success) throw new Error(result.message || result.errMsg || '执行失败');
    await db.collection('operation_logs').add({ data: { operationId, operationName, editionId: edition.editionId, state: OPERATION_STATES.SUCCEEDED, result: result.data || {}, createdBy: admin.account, createdAt: Date.now() } });
    return { operationId, operationName, editionId: edition.editionId, state: OPERATION_STATES.SUCCEEDED, message: result.message, result: result.data };
  } catch (error) {
    await db.collection('operation_logs').add({ data: { operationId, operationName, editionId: edition.editionId, state: OPERATION_STATES.FAILED, message: error.message, createdBy: admin.account, createdAt: Date.now() } });
    return { operationId, operationName, editionId: edition.editionId, state: OPERATION_STATES.FAILED, message: error.message };
  }

};

exports.main = async (event = {}) => {
  const db = cloud.database({ throwOnNotFound: false });
  try {
    const admin = await requireAdmin(db, event);
    const action = event.action || 'preview';
    let data;
    if (action === 'rankingPreview') {
      const handlers = { generatePreliminaryTable: () => require('../generatePreliminaryTable/index'), generateFinalRanking: () => require('../generateFinalRanking/index') };
      if (!handlers[event.operationName]) throw new Error('该操作不支持同分确认');
      const result = await handlers[event.operationName]().main({ editionId: event.editionId, dryRun: true, tieResolution: event.tieResolution });
      return result;
    }
    if (action === 'preview') data = await previewOperation(db, event);
    else if (action === 'backup') data = await createBackupManifest(db, event, admin);
    else if (action === 'issueConfirmation') data = await issueConfirmation(db, event, admin);
    else if (action === 'execute') data = await executeOperation(db, event, admin);
    else throw new Error(`未知管理员操作：${action}`);
    return { success: true, data };
  } catch (error) {
    return { success: false, errMsg: error.message || '管理员操作失败' };
  }
};
