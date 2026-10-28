// Only public display fields leave this function. No write actions are exposed.
const WORK = { _id: true, title: true, artistId: true, artistName: true, period: true, coverImage: true, detailImages: true, intro: true, description: true };
const ARTIST = { _id: true, artistId: true, name: true, avatar: true, intro: true, representativeWorks: true };
const text = value => typeof value === 'string' ? value.trim() : '';
const image = value => /^(cloud:\/\/|https:\/\/)/.test(text(value)) ? text(value) : '';
function work(row) {
  return { _id: text(row._id), title: text(row.title), artistId: text(row.artistId), artistName: text(row.artistName), period: text(row.period), coverImage: image(row.coverImage), detailImages: (Array.isArray(row.detailImages) ? row.detailImages : []).map(image).filter(Boolean).slice(0,20), intro: text(row.intro) || text(row.description) };
}
function artist(row) {
  return { _id: text(row._id), artistId: text(row.artistId) || text(row._id), name: text(row.name), avatar: image(row.avatar), intro: text(row.intro) };
}
function integer(value, fallback, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : fallback;
}
function createHandler(db) {
  async function findArtist(id, byDocument) {
    if (!id) return null;
    // Document IDs take precedence if a legacy business ID has the same value.
    const byId = await db.collection('museum_artists').where({ _id:id, status:'published' }).field(ARTIST).limit(1).get();
    if (byId.data.length || byDocument) return byId.data[0] || null;
    const byArtistId = await db.collection('museum_artists').where({ artistId:id, status:'published' })
      .field(ARTIST).orderBy('_id','asc').limit(1).get();
    return byArtistId.data[0] || null;
  }
  async function belongsToArtist(a, resolvedId) {
    const documentId = text(a._id);
    const businessId = text(a.artistId);
    const ids = [documentId];
    if (businessId && businessId !== documentId) {
      // Apply the same document-ID precedence as collectionDetail. An alias
      // belonging to another document must never broaden this artist's works.
      const owner = businessId === resolvedId ? a : await findArtist(businessId,false);
      if (owner && text(owner._id) === documentId) ids.push(businessId);
    }
    return {
      artistId: ids.includes(businessId) ? businessId : documentId,
      where: ids.length === 1 ? {artistId:documentId} : db.command.or(ids.map(artistId => ({artistId})))
    };
  }
  async function list(event, isArtist, resolvedArtist, resolvedAssociation) {
    const conditions = [{ status: 'published' }];
    const keyword = text(event.keyword).slice(0,80);
    if (keyword) {
      const re = db.RegExp({regexp:keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),options:'i'});
      conditions.push(db.command.or(isArtist ? [{name:re},{intro:re}] : [{title:re},{artistName:re}]));
    }
    if (!isArtist && text(event.artistId)) {
      const a = resolvedArtist || await findArtist(text(event.artistId), false);
      if (!a) return {items:[],hasMore:false};
      const association = resolvedAssociation || await belongsToArtist(a,text(event.artistId));
      conditions.push(association.where);
    }
    const limit = Math.max(1,integer(event.limit,20,40));
    const result = await db.collection(isArtist?'museum_artists':'museum_collections')
      .where(db.command.and(conditions)).field(isArtist?ARTIST:WORK)
      .orderBy('sortOrder','asc').orderBy('_id','asc')
      .skip(integer(event.offset,0,10000)).limit(limit+1).get();
    return {items:result.data.slice(0,limit).map(isArtist?artist:work),hasMore:result.data.length>limit};
  }
  return async (event = {}) => {
    try {
      let data;
      if (event.action === 'listCollections' || event.action === 'listArtists') {
        data = await list(event,event.action==='listArtists');
      } else if (event.action === 'collectionDetail') {
        const id = text(event.id);
        if (!id) return {success:false,errMsg:'缺少作品编号'};
        const result = await db.collection('museum_collections').where({_id:id,status:'published'}).field(WORK).limit(1).get();
        if (!result.data.length) return {success:false,errMsg:'作品不存在或暂未开放'};
        data = work(result.data[0]);
        const a = await findArtist(data.artistId,false);
        data.artistDocumentId = a ? a._id : '';
        data.artistAvatar = a ? image(a.avatar) : '';
        if (a) data.artistName = text(a.name) || data.artistName;
      } else if (event.action === 'artistDetail') {
        const a = await findArtist(text(event.id) || text(event.artistId),!!text(event.id));
        if (!a) return {success:false,errMsg:'艺术家档案不存在或暂未开放'};
        data = artist(a);
        const association = await belongsToArtist(a,text(event.id) || text(event.artistId));
        // The returned filter identifier must route back to this same profile.
        data.artistId = association.artistId;
        const related = await list({artistId:data.artistId,limit:3},false,a,association);
        data.relatedCollections = related.items;
        // One bounded query replaces per-entry reads. Only this artist's published
        // works can be linked; standalone images retain their separate behavior.
        const entries = (Array.isArray(a.representativeWorks)?a.representativeWorks:[]).slice(0,12);
        const entryId = entry => typeof entry === 'string' ? text(entry) : text(entry && entry.collectionId);
        const ids = [...new Set(entries.map(entryId).filter(Boolean))];
        let linked = new Map();
        if (ids.length) {
          const result = await db.collection('museum_collections')
            .where(db.command.and([{status:'published'},association.where,{_id:db.command.in(ids)}]))
            .field(WORK).limit(ids.length).get();
          linked = new Map(result.data.map(row => [text(row._id),work(row)]));
        }
        data.representativeWorks = [];
        const used = new Set();
        for (const entry of entries) {
          const id = entryId(entry);
          if (id) {
            if (linked.has(id) && !used.has(id)) {
              data.representativeWorks.push(linked.get(id));
              used.add(id);
            }
          } else if (entry && image(entry.image || entry.coverImage)) {
            data.representativeWorks.push({_id:'',title:text(entry.title),coverImage:image(entry.image || entry.coverImage)});
          }
        }
        if (!data.representativeWorks.length) data.representativeWorks = related.items;
      } else return {success:false,errMsg:'不支持的展示操作'};
      return {success:true,data};
    } catch (error) {
      console.error('museumDisplay failed', error.errCode || error.code || 'UNKNOWN');
      return {success:false,errMsg:'内容暂时无法加载，请稍后重试'};
    }
  };
}
module.exports = { createHandler };
