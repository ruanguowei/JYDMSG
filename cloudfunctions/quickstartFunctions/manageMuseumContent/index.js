const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const COLLECTIONS = {
  collection: 'museum_collections',
  artist: 'museum_artists',
  catalog: 'catalog_links'
};

const REQUIRED_FIELDS = {
  collection: ['title'],
  artist: ['name'],
  catalog: ['title', 'url']
};

function normalizeType(contentType) {
  if (!COLLECTIONS[contentType]) {
    throw new Error('未知内容类型');
  }
  return contentType;
}

function now() {
  return Date.now();
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '');
}

function normalizeStatus(value) {
  return value === 'published' ? 'published' : 'draft';
}

function validateUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

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

function normalizeContent(contentType, rawData) {
  const data = rawData || {};
  const normalized = {
    status: normalizeStatus(data.status),
    sortOrder: Number(data.sortOrder || 0),
    updatedAt: now()
  };

  if (contentType === 'artist') {
    normalized.artistId = trimString(data.artistId) || `artist-${slug(data.name)}-${now()}`;
    normalized.name = trimString(data.name);
    normalized.avatar = trimString(data.avatar) || '';
    normalized.intro = trimString(data.intro) || '';
    normalized.biography = trimString(data.biography) || '';
    normalized.representativeWorks = Array.isArray(data.representativeWorks) ? data.representativeWorks : [];
  }

  if (contentType === 'collection') {
    normalized.title = trimString(data.title);
    normalized.artistId = trimString(data.artistId) || '';
    normalized.artistName = trimString(data.artistName) || '';
    normalized.period = trimString(data.period) || '';
    normalized.category = trimString(data.category) || '';
    normalized.material = trimString(data.material) || '';
    normalized.size = trimString(data.size) || '';
    normalized.intro = trimString(data.intro) || '';
    normalized.coverImage = trimString(data.coverImage) || '';
    normalized.detailImages = Array.isArray(data.detailImages) ? data.detailImages : [];
  }

  if (contentType === 'catalog') {
    normalized.title = trimString(data.title);
    normalized.cover = trimString(data.cover) || '';
    normalized.year = data.year ? Number(data.year) : '';
    normalized.editionId = trimString(data.editionId) || '';
    normalized.editionNumber = data.editionNumber ? Number(data.editionNumber) : '';
    normalized.description = trimString(data.description) || '';
    normalized.url = trimString(data.url);
    normalized.publishedAt = data.publishedAt || now();
  }

  for (const field of REQUIRED_FIELDS[contentType]) {
    if (!normalized[field]) {
      throw new Error(`缺少必填字段: ${field}`);
    }
  }

  if (contentType === 'catalog' && !validateUrl(normalized.url)) {
    throw new Error('电子画册 URL 必须为 HTTPS 链接');
  }

  return normalized;
}

function importKey(contentType, data) {
  if (contentType === 'artist') return data.artistId;
  if (contentType === 'catalog') return data.url;
  return data.title;
}

function importQuery(contentType, data) {
  if (contentType === 'artist') return { artistId: data.artistId };
  if (contentType === 'catalog') return { url: data.url };
  return { title: data.title };
}

async function listContent(db, event) {
  const contentType = normalizeType(event.contentType);
  const result = await db.collection(COLLECTIONS[contentType])
    .where({})
    .orderBy('sortOrder', 'asc')
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();

  return result.data || [];
}

async function saveContent(db, event, admin) {
  const contentType = normalizeType(event.contentType);
  const data = normalizeContent(contentType, event.data);
  const collection = db.collection(COLLECTIONS[contentType]);

  if (event.id) {
    await collection.doc(event.id).update({
      data: {
        ...data,
        updatedBy: admin.account
      }
    });
    return {
      id: event.id,
      operation: 'updated'
    };
  }

  const result = await collection.add({
    data: {
      ...data,
      createdAt: now(),
      createdBy: admin.account,
      updatedBy: admin.account
    }
  });

  return {
    id: result._id,
    operation: 'created'
  };
}

async function updateStatus(db, event, admin) {
  const contentType = normalizeType(event.contentType);
  if (!event.id) {
    throw new Error('缺少内容 ID');
  }

  const status = normalizeStatus(event.status);
  await db.collection(COLLECTIONS[contentType]).doc(event.id).update({
    data: {
      status,
      updatedAt: now(),
      updatedBy: admin.account
    }
  });

  return {
    id: event.id,
    status
  };
}

async function previewImport(db, event) {
  const contentType = normalizeType(event.contentType);
  const rows = Array.isArray(event.rows) ? event.rows : [];
  const seen = new Set();
  const failures = [];
  const validRows = [];
  let wouldCreate = 0;
  let wouldUpdate = 0;
  let unchanged = 0;

  for (const [index, row] of rows.entries()) {
    try {
      const normalized = normalizeContent(contentType, row);
      const key = importKey(contentType, normalized);
      if (seen.has(key)) {
        failures.push({ row: index + 1, reason: '导入数据内部重复', key });
        continue;
      }
      seen.add(key);

      const existing = await db.collection(COLLECTIONS[contentType])
        .where(importQuery(contentType, normalized))
        .limit(1)
        .get();
      const existingItem = existing.data && existing.data[0];

      if (existingItem) {
        wouldUpdate += 1;
      } else {
        wouldCreate += 1;
      }
      validRows.push({
        row: index + 1,
        key,
        operation: existingItem ? 'update' : 'create',
        id: existingItem && existingItem._id,
        data: normalized
      });
    } catch (error) {
      failures.push({ row: index + 1, reason: error.message });
    }
  }

  return {
    total: rows.length,
    valid: validRows.length,
    failed: failures.length,
    wouldCreate,
    wouldUpdate,
    unchanged,
    failures,
    preview: validRows.slice(0, 10)
  };
}

async function importContent(db, event, admin) {
  const report = await previewImport(db, event);
  if (report.failed > 0) {
    throw new Error('导入数据存在失败行，请先修正后再导入');
  }

  const contentType = normalizeType(event.contentType);
  const collection = db.collection(COLLECTIONS[contentType]);
  const rows = report.preview.length === report.valid
    ? report.preview
    : [];

  if (rows.length !== report.valid) {
    const normalizedRows = [];
    for (const row of event.rows || []) {
      const data = normalizeContent(contentType, row);
      const existing = await collection.where(importQuery(contentType, data)).limit(1).get();
      const existingItem = existing.data && existing.data[0];
      normalizedRows.push({
        operation: existingItem ? 'update' : 'create',
        id: existingItem && existingItem._id,
        data
      });
    }
    return importNormalizedRows(collection, normalizedRows, admin);
  }

  return importNormalizedRows(collection, rows, admin);
}

async function importNormalizedRows(collection, rows, admin) {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (row.operation === 'update' && row.id) {
      await collection.doc(row.id).update({
        data: {
          ...row.data,
          updatedAt: now(),
          updatedBy: admin.account
        }
      });
      updated += 1;
    } else {
      await collection.add({
        data: {
          ...row.data,
          createdAt: now(),
          createdBy: admin.account,
          updatedBy: admin.account
        }
      });
      created += 1;
    }
  }

  return {
    created,
    updated,
    total: created + updated
  };
}

exports.main = async (event) => {
  const db = cloud.database();
  const action = event.action || 'list';

  try {
    const needsAdmin = ['save', 'updateStatus', 'previewImport', 'importContent'].includes(action);
    const admin = needsAdmin ? await requireAdmin(db, event) : null;
    let data;

    switch (action) {
    case 'list':
      data = await listContent(db, event);
      break;
    case 'save':
      data = await saveContent(db, event, admin);
      break;
    case 'updateStatus':
      data = await updateStatus(db, event, admin);
      break;
    case 'previewImport':
      data = await previewImport(db, event);
      break;
    case 'importContent':
      data = await importContent(db, event, admin);
      break;
    default:
      throw new Error(`未知内容管理操作: ${action}`);
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('内容管理失败:', error);
    return {
      success: false,
      errMsg: error.message || '内容管理失败'
    };
  }
};
