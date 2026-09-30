const cloud = require('wx-server-sdk');
const { resolveEdition } = require('../common/edition');
const {
  OPERATION_STATES,
  assertPassphrase,
  validateConfirmationCode
} = require('../common/adminOperation');
const {
  CERTIFICATE_TYPES,
  buildCertificateRecord,
  parseWorkCodeFromFileName
} = require('../../common/certificate');

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

function normalizeCertificateType(value) {
  if (value === CERTIFICATE_TYPES.SHORTLISTED || value === CERTIFICATE_TYPES.AWARD) {
    return value;
  }
  throw new Error('证书类型必须是 shortlisted 或 award');
}

async function fetchExistingWorks(db, collectionName, workCodes) {
  const validWorkCodes = [...new Set(workCodes.filter(Boolean))];
  if (validWorkCodes.length === 0) return {};

  const _ = db.command;
  const result = await db.collection(collectionName)
    .where({ workCode: _.in(validWorkCodes) })
    .field({
      _id: true,
      workCode: true,
      artworkName: true,
      title: true,
      name: true,
      phone: true,
      status: true
    })
    .limit(100)
    .get();

  const map = {};
  for (const item of result.data || []) {
    if (!map[item.workCode]) {
      map[item.workCode] = [];
    }
    map[item.workCode].push(item);
  }
  return map;
}

async function fetchExistingCertificates(db, editionId, workCodes, certificateType) {
  const validWorkCodes = [...new Set(workCodes.filter(Boolean))];
  if (validWorkCodes.length === 0) return [];

  const _ = db.command;
  const result = await db.collection('certificate_records')
    .where({
      editionId,
      workCode: _.in(validWorkCodes),
      certificateType
    })
    .field({
      _id: true,
      certificateId: true,
      workCode: true,
      certificateType: true,
      fileId: true,
      fileName: true,
      version: true,
      status: true
    })
    .limit(100)
    .get();

  return result.data || [];
}

async function findLatestOperationLog(db, operationId, state) {
  const result = await db.collection('operation_logs')
    .where({ operationId, state })
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return result.data && result.data[0];
}

async function assertCertificateSafetyGate(db, event, editionId) {
  const operationId = event.operationId || '';
  if (!operationId) {
    throw new Error('证书批处理缺少安全流水线操作编号');
  }

  assertPassphrase(editionId, event.passphrase);

  const backupLog = await findLatestOperationLog(db, operationId, OPERATION_STATES.BACKED_UP);
  if (!backupLog) {
    throw new Error('未找到证书批处理备份记录');
  }

  const confirmationLog = await findLatestOperationLog(db, operationId, OPERATION_STATES.CONFIRMED);
  if (!confirmationLog) {
    throw new Error('未找到证书批处理确认码记录');
  }

  if (confirmationLog.operationName !== 'uploadCertificates') {
    throw new Error('确认码不属于证书批处理操作');
  }

  if (!validateConfirmationCode({
    code: event.confirmationCode,
    expectedHash: confirmationLog.confirmationHash,
    issuedAt: confirmationLog.confirmationIssuedAt
  })) {
    throw new Error('证书批处理确认码无效或已过期');
  }

  return { operationId };
}

async function previewCertificates(db, event) {
  const edition = await resolveEdition(db, {
    editionId: event.editionId || 'pottery-2026',
    mode: 'write'
  });
  const certificateType = normalizeCertificateType(event.certificateType || CERTIFICATE_TYPES.SHORTLISTED);
  const files = Array.isArray(event.files) ? event.files : [];
  const rows = files.map((file, index) => ({
    row: index + 1,
    fileId: file.fileId || '',
    fileName: file.fileName || file.name || '',
    workCode: file.workCode || parseWorkCodeFromFileName(file.fileName || file.name || '')
  }));

  const workMap = await fetchExistingWorks(
    db,
    edition.collectionMap.finalResults || 'pottery_submissions_final_2026',
    rows.map(row => row.workCode)
  );
  const existingCertificates = await fetchExistingCertificates(
    db,
    edition.editionId,
    rows.map(row => row.workCode),
    certificateType
  );

  const reportRows = [];
  const summary = {
    total: rows.length,
    matched: 0,
    unmatched: 0,
    duplicateMatched: 0,
    invalidFile: 0,
    willCreate: 0,
    willReplace: 0
  };

  for (const row of rows) {
    const matches = workMap[row.workCode] || [];
    const existingForWork = existingCertificates.filter(record => record.workCode === row.workCode);
    const activeExisting = existingForWork.find(record => record.status === 'active');
    const errors = [];

    if (!row.fileId) errors.push('缺少 fileId');
    if (!row.fileName) errors.push('缺少文件名');
    if (!row.workCode) errors.push('文件名未包含作品编号');
    if (matches.length === 0 && row.workCode) errors.push('作品编号无匹配结果');
    if (matches.length > 1) errors.push('作品编号匹配到多条结果');

    if (errors.length > 0) {
      if (!row.fileId || !row.fileName || !row.workCode) summary.invalidFile += 1;
      if (matches.length === 0 && row.workCode) summary.unmatched += 1;
      if (matches.length > 1) summary.duplicateMatched += 1;
      reportRows.push({ ...row, status: 'failed', errors });
      continue;
    }

    const record = buildCertificateRecord({
      editionId: edition.editionId,
      workCode: row.workCode,
      certificateType,
      awardStatus: matches[0].status || '',
      fileId: row.fileId,
      fileName: row.fileName,
      existingRecords: existingForWork,
      createdBy: event.admin && event.admin.account
    });

    summary.matched += 1;
    if (activeExisting) {
      summary.willReplace += 1;
    } else {
      summary.willCreate += 1;
    }

    reportRows.push({
      ...row,
      status: activeExisting ? 'willReplace' : 'willCreate',
      matchedWork: {
        id: matches[0]._id,
        workCode: matches[0].workCode,
        artworkName: matches[0].artworkName || matches[0].title || ''
      },
      certificateRecord: record
    });
  }

  return {
    edition: {
      editionId: edition.editionId,
      title: edition.title,
      readOnly: !!edition.readOnly
    },
    certificateType,
    summary,
    rows: reportRows
  };
}

async function markExistingCertificateReplaced(db, existingRecord, replacementRecord, adminAccount) {
  if (!existingRecord || (!existingRecord.certificateId && !existingRecord._id)) {
    return 0;
  }

  const now = Date.now();
  const updateData = {
    status: 'replaced',
    replacedAt: now,
    replacedByCertificateId: replacementRecord.certificateId,
    updatedBy: adminAccount,
    updatedAt: now
  };
  let result;

  if (existingRecord._id) {
    result = await db.collection('certificate_records')
      .doc(existingRecord._id)
      .update({ data: updateData });
  } else {
    result = await db.collection('certificate_records')
      .where({
        certificateId: existingRecord.certificateId,
        status: 'active'
      })
      .update({ data: updateData });
  }

  return result.stats && result.stats.updated ? result.stats.updated : 0;
}

async function syncLegacyCertificateField(db, collectionName, row, certificateType) {
  if (!collectionName || !row || !row.workCode || !row.certificateRecord) {
    return 0;
  }

  const fieldName = certificateType === CERTIFICATE_TYPES.AWARD ? 'awardCertificate' : 'shortlistedCertificate';
  const data = {};
  data[fieldName] = row.certificateRecord.fileId;

  const result = await db.collection(collectionName)
    .where({ workCode: row.workCode })
    .update({ data });

  return result.stats && result.stats.updated ? result.stats.updated : 0;
}

async function applyCertificates(db, event, admin) {
  const preview = await previewCertificates(db, event);
  const editionId = preview.edition.editionId;
  const safety = await assertCertificateSafetyGate(db, event, editionId);
  const failedRows = preview.rows.filter(row => row.status === 'failed');
  if (failedRows.length > 0) {
    throw new Error('证书预检存在失败项，不能执行批处理');
  }

  const edition = await resolveEdition(db, { editionId, mode: 'write' });
  const finalResultsCollection = edition.collectionMap.finalResults || 'pottery_submissions_final_2026';
  const appliedRows = [];
  const summary = {
    created: 0,
    replaced: 0,
    legacySynced: 0,
    skipped: 0
  };
  const now = Date.now();

  for (const row of preview.rows) {
    const record = row.certificateRecord;
    if (!record) {
      summary.skipped += 1;
      continue;
    }

    const existingRecords = await fetchExistingCertificates(
      db,
      editionId,
      [row.workCode],
      preview.certificateType
    );
    const activeExisting = existingRecords.find(item => item.status === 'active');

    if (activeExisting) {
      const updated = await markExistingCertificateReplaced(db, activeExisting, record, admin.account);
      if (updated > 0) {
        summary.replaced += 1;
      }
    }

    await db.collection('certificate_records').add({ data: record });
    summary.created += 1;

    if (event.syncLegacyFields !== false) {
      summary.legacySynced += await syncLegacyCertificateField(db, finalResultsCollection, row, preview.certificateType);
    }

    await db.collection('certificate_match_logs').add({
      data: {
        operationId: safety.operationId,
        editionId,
        workCode: row.workCode,
        certificateType: preview.certificateType,
        certificateId: record.certificateId,
        matchMethod: 'workCode',
        action: activeExisting ? 'replace' : 'create',
        previousCertificateId: activeExisting ? (activeExisting.certificateId || activeExisting._id || '') : '',
        fileId: record.fileId,
        fileName: record.fileName,
        createdBy: admin.account,
        createdAt: now
      }
    });

    appliedRows.push({
      workCode: row.workCode,
      certificateId: record.certificateId,
      action: activeExisting ? 'replace' : 'create'
    });
  }

  await db.collection('operation_logs').add({
    data: {
      operationId: safety.operationId,
      operationName: 'uploadCertificates',
      editionId,
      state: OPERATION_STATES.SUCCEEDED,
      affectedCount: summary.created,
      summary,
      createdBy: admin.account,
      createdAt: Date.now()
    }
  });

  return {
    operationId: safety.operationId,
    edition: preview.edition,
    certificateType: preview.certificateType,
    summary,
    rows: appliedRows
  };
}

exports.main = async (event) => {
  const db = cloud.database();
  const action = event.action || 'preview';

  try {
    const admin = await requireAdmin(db, event);

    if (action === 'preview') {
      return {
        success: true,
        data: await previewCertificates(db, event)
      };
    }

    if (action === 'apply') {
      return {
        success: true,
        data: await applyCertificates(db, event, admin)
      };
    }

    return {
      success: false,
      errMsg: '未知证书管理动作'
    };
  } catch (error) {
    console.error('证书管理失败:', error);
    return {
      success: false,
      errMsg: error.message || '证书管理失败'
    };
  }
};
