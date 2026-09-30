const CERTIFICATE_TYPES = {
  SHORTLISTED: 'shortlisted',
  AWARD: 'award'
};

function normalizeCertificate(record, fallbackFileId = '') {
  if (record) {
    return {
      certificateId: record.certificateId || record._id || '',
      certificateType: record.certificateType || '',
      fileId: record.fileId || '',
      fileName: record.fileName || '',
      version: record.version || 1,
      status: record.status || 'active',
      matchMethod: record.matchMethod || 'workCode'
    };
  }

  if (!fallbackFileId) {
    return null;
  }

  return {
    certificateId: '',
    certificateType: '',
    fileId: fallbackFileId,
    fileName: '',
    version: 1,
    status: 'active',
    matchMethod: 'legacy-field'
  };
}

function buildCertificateMap(records = []) {
  const map = {};

  for (const record of records) {
    if (!record || !record.workCode || record.status === 'replaced') {
      continue;
    }

    const key = `${record.workCode}:${record.certificateType}`;
    const existing = map[key];
    if (!existing || Number(record.version || 1) > Number(existing.version || 1)) {
      map[key] = record;
    }
  }

  return map;
}

function parseWorkCodeFromFileName(fileName = '') {
  const text = String(fileName || '');
  const match = text.match(/POT2026-[A-Z]{2}-\d{6}/i) || text.match(/POT\d{4}-[A-Z]{2}-\d{6}/i);
  return match ? match[0].toUpperCase() : '';
}

function nextCertificateVersion(existingRecords = [], workCode, certificateType) {
  const versions = existingRecords
    .filter(record => record.workCode === workCode && record.certificateType === certificateType)
    .map(record => Number(record.version || 1));
  return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}

function buildCertificateRecord({
  editionId,
  workCode,
  certificateType,
  awardStatus = '',
  fileId,
  fileName,
  existingRecords = [],
  createdBy = '',
  now = Date.now()
}) {
  if (!editionId) throw new Error('缺少届次');
  if (!workCode) throw new Error('缺少作品编号');
  if (!Object.values(CERTIFICATE_TYPES).includes(certificateType)) {
    throw new Error('证书类型无效');
  }
  if (!fileId) throw new Error('缺少证书文件');

  const version = nextCertificateVersion(existingRecords, workCode, certificateType);
  const activeExisting = existingRecords.find(record =>
    record.workCode === workCode &&
    record.certificateType === certificateType &&
    record.status === 'active'
  );

  return {
    certificateId: `${editionId}_${workCode}_${certificateType}_v${version}`,
    editionId,
    workCode,
    certificateType,
    awardStatus,
    fileId,
    fileName: fileName || '',
    version,
    status: 'active',
    issuedAt: now,
    replacedAt: null,
    replacedByCertificateId: null,
    matchMethod: 'workCode',
    createdBy,
    createdAt: now,
    replacesCertificateId: activeExisting ? (activeExisting.certificateId || activeExisting._id || '') : ''
  };
}

async function fetchActiveCertificates(db, editionId, workCodes) {
  const validWorkCodes = [...new Set((workCodes || []).filter(Boolean))];
  if (validWorkCodes.length === 0) {
    return {};
  }

  try {
    const _ = db.command;
    const result = await db.collection('certificate_records')
      .where({
        editionId,
        workCode: _.in(validWorkCodes),
        status: 'active'
      })
      .field({
        certificateId: true,
        editionId: true,
        workCode: true,
        certificateType: true,
        awardStatus: true,
        fileId: true,
        fileName: true,
        version: true,
        status: true,
        matchMethod: true
      })
      .limit(100)
      .get();

    return buildCertificateMap(result.data || []);
  } catch (error) {
    console.warn('读取 certificate_records 失败，将使用结果表旧字段兼容:', error.message);
    return {};
  }
}

module.exports = {
  CERTIFICATE_TYPES,
  buildCertificateMap,
  buildCertificateRecord,
  fetchActiveCertificates,
  nextCertificateVersion,
  normalizeCertificate,
  parseWorkCodeFromFileName
};
