const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function pageSize(value) {
  const parsed = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function textRegExp(db, keyword) {
  const value = String(keyword || '').trim();
  if (!value) return null;
  return db.RegExp({
    regexp: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    options: 'i'
  });
}

function isPublishedQuery(event) {
  return event.includeOffline === true ? {} : { status: 'published' };
}

async function listCollections(db, event) {
  const _ = db.command;
  const filters = isPublishedQuery(event);
  const keyword = textRegExp(db, event.keyword);
  const and = [];

  if (keyword) {
    and.push(_.or([
      { title: keyword },
      { artistName: keyword },
      { intro: keyword }
    ]));
  }

  if (event.category) filters.category = event.category;
  if (event.artistId) filters.artistId = event.artistId;
  if (event.period) filters.period = event.period;

  const where = and.length > 0 ? _.and([filters, ...and]) : filters;
  const result = await db.collection('museum_collections')
    .where(where)
    .field({
      title: true,
      artistId: true,
      artistName: true,
      period: true,
      category: true,
      material: true,
      size: true,
      coverImage: true,
      sortOrder: true,
      status: true
    })
    .orderBy('sortOrder', 'asc')
    .orderBy('updatedAt', 'desc')
    .skip(Number(event.offset || 0))
    .limit(pageSize(event.limit))
    .get();

  return result.data || [];
}

async function collectionDetail(db, event) {
  if (!event.id) {
    throw new Error('缺少馆藏作品 ID');
  }

  const result = await db.collection('museum_collections').doc(event.id).get();
  const item = result.data;
  if (!item || (item.status !== 'published' && event.includeOffline !== true)) {
    throw new Error('馆藏作品不存在或未发布');
  }

  return item;
}

async function listArtists(db, event) {
  const _ = db.command;
  const filters = isPublishedQuery(event);
  const keyword = textRegExp(db, event.keyword);
  const where = keyword
    ? _.and([filters, _.or([{ name: keyword }, { intro: keyword }, { biography: keyword }])])
    : filters;

  const result = await db.collection('museum_artists')
    .where(where)
    .field({
      artistId: true,
      name: true,
      avatar: true,
      intro: true,
      sortOrder: true,
      status: true
    })
    .orderBy('sortOrder', 'asc')
    .orderBy('updatedAt', 'desc')
    .skip(Number(event.offset || 0))
    .limit(pageSize(event.limit))
    .get();

  return result.data || [];
}

async function artistDetail(db, event) {
  if (!event.id && !event.artistId) {
    throw new Error('缺少艺术家 ID');
  }

  let result;
  if (event.id) {
    result = await db.collection('museum_artists').doc(event.id).get();
  } else {
    result = await db.collection('museum_artists')
      .where({ artistId: event.artistId })
      .limit(1)
      .get();
    result = { data: result.data && result.data[0] };
  }

  const artist = result.data;
  if (!artist || (artist.status !== 'published' && event.includeOffline !== true)) {
    throw new Error('艺术家不存在或未发布');
  }

  const works = await db.collection('museum_collections')
    .where({
      artistId: artist.artistId,
      status: 'published'
    })
    .field({
      title: true,
      coverImage: true,
      category: true,
      period: true,
      artistId: true,
      artistName: true
    })
    .orderBy('sortOrder', 'asc')
    .limit(20)
    .get();

  return {
    ...artist,
    relatedCollections: works.data || []
  };
}

async function listCatalogLinks(db, event) {
  const result = await db.collection('catalog_links')
    .where(isPublishedQuery(event))
    .field({
      title: true,
      cover: true,
      year: true,
      editionId: true,
      editionNumber: true,
      description: true,
      url: true,
      sortOrder: true,
      status: true,
      publishedAt: true
    })
    .orderBy('sortOrder', 'asc')
    .orderBy('publishedAt', 'desc')
    .limit(pageSize(event.limit))
    .get();

  return result.data || [];
}

exports.main = async (event) => {
  const db = cloud.database();
  const action = event.action || 'listCollections';

  try {
    let data;
    switch (action) {
    case 'listCollections':
      data = await listCollections(db, event);
      break;
    case 'collectionDetail':
      data = await collectionDetail(db, event);
      break;
    case 'listArtists':
      data = await listArtists(db, event);
      break;
    case 'artistDetail':
      data = await artistDetail(db, event);
      break;
    case 'listCatalogLinks':
      data = await listCatalogLinks(db, event);
      break;
    default:
      throw new Error(`未知内容操作: ${action}`);
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('获取美术馆内容失败:', error);
    return {
      success: false,
      errMsg: error.message || '获取内容失败'
    };
  }
};
