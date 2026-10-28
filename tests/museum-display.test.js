const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../cloudfunctions/museumDisplay/service');
const {listPage,detailPage,fetchContent,navigate,previewImages}=require('../miniprogram/utils/museum-display');

function database(tables,reads=[]){
  const matches=(row,q)=>q.and?q.and.every(x=>matches(row,x)):q.or?q.or.some(x=>matches(row,x)):Object.entries(q).every(([k,v])=>v instanceof RegExp?v.test(row[k]||''):v&&v.in?v.in.includes(row[k]):row[k]===v);
  return {command:{and:and=>({and}),or:or=>({or}),in:values=>({in:values})},RegExp:({regexp,options})=>new RegExp(regexp,options),collection(name){
    let q={},fields=null,offset=0,limit=100,sort=[];
    const chain={where(v){q=v;return this;},field(v){fields=v;return this;},orderBy(k,d){sort.push([k,d]);return this;},skip(v){offset=v;return this;},limit(v){limit=v;return this;},async get(){
      reads.push({collection:name,query:q,fields,offset,limit,sort});
      if(!tables[name])throw Error('missing collection');
      const rows=tables[name].filter(r=>matches(r,q)).sort((a,b)=>{for(const [k,d]of sort){const n=a[k]<b[k]?-1:a[k]>b[k]?1:0;if(n)return d==='asc'?n:-n;}return 0;}).slice(offset,offset+limit);
      return {data:rows.map(r=>fields?Object.fromEntries(Object.keys(fields).filter(k=>k in r).map(k=>[k,r[k]])):{...r})};
    }};return chain;
  }};
}
function fixture(){return {museum_collections:[...Array.from({length:24},(_,i)=>({_id:'w'+String(i).padStart(2,'0'),title:'作品 '+i,artistId:'a',artistName:'旧姓名',sortOrder:i,status:'published',coverImage:'cloud://env/work.jpg',privateNote:'secret'})),{_id:'hidden',artistId:'a',status:'draft',title:'隐藏'}],museum_artists:[{_id:'artist-doc',artistId:'a',name:'作者甲',status:'published',avatar:'cloud://env/author.jpg',intro:'简介',phone:'private',biography:'not public',representativeWorks:['hidden','w00',{title:'独立作品',image:'https://example.com/work.jpg',phone:'secret'}]}]};}
test('展示接口只返回已发布数据和公开字段，不能通过 includeOffline 越权',async()=>{
 const main=createHandler(database(fixture()));const r=await main({action:'listCollections',includeOffline:true,limit:40});assert.equal(r.data.items.length,24);assert.equal(JSON.stringify(r).includes('secret'),false);
 assert.equal((await main({action:'collectionDetail',id:'hidden',includeOffline:true})).success,false);
 assert.equal((await main({action:'delete',id:'w00'})).success,false);
});
test('搜索转义与分页边界，作品作者准确关联',async()=>{
 const main=createHandler(database(fixture()));const first=await main({action:'listCollections',limit:20});assert.equal(first.data.hasMore,true);
 const last=await main({action:'listCollections',offset:20,limit:20});assert.equal(last.data.items.length,4);assert.equal(last.data.hasMore,false);
 assert.equal((await main({action:'listCollections',keyword:'.*'})).data.items.length,0);
 const d=await main({action:'collectionDetail',id:'w00'});assert.equal(d.data.artistDocumentId,'artist-doc');assert.equal(d.data.artistName,'作者甲');
 assert.equal(d.data.artistAvatar,'cloud://env/author.jpg');
});
test('艺术家详情支持档案 ID、业务 ID 和代表作品，隐藏作品不透出',async()=>{
 const main=createHandler(database(fixture()));for(const input of [{id:'artist-doc'},{artistId:'a'},{artistId:'artist-doc'}]){
 const r=await main({action:'artistDetail',...input});assert.equal(r.success,true);assert.equal(r.data.representativeWorks.length,2);assert.equal(r.data.relatedCollections.length,3);assert.equal(r.data.biography,undefined);assert.equal(r.data.phone,undefined);
 }
 assert.equal((await main({action:'listCollections',artistId:'missing'})).data.items.length,0);
});
test('搜索特殊字符按字面匹配，中文和英文作品名均可查询',async()=>{
 const tables=fixture();tables.museum_collections[0].title='青釉（测试）.[1]+?';tables.museum_collections[1].title='Study A';
 const main=createHandler(database(tables));
 const literal=await main({action:'listCollections',keyword:'.[1]+?'});assert.deepEqual(literal.data.items.map(x=>x._id),['w00']);
 assert.deepEqual((await main({action:'listCollections',keyword:'study'})).data.items.map(x=>x._id),['w01']);
 assert.equal((await main({action:'listCollections',keyword:'('})).data.items.length,0);
});
test('相同排序号按文档编号稳定翻页，非法分页参数不会扩大返回范围',async()=>{
 const tables=fixture();tables.museum_collections.forEach(row=>row.sortOrder=7);tables.museum_collections.reverse();
 const main=createHandler(database(tables));
 const first=await main({action:'listCollections',limit:3});
 const next=await main({action:'listCollections',offset:3,limit:3});
 assert.deepEqual(first.data.items.map(x=>x._id),['w00','w01','w02']);assert.deepEqual(next.data.items.map(x=>x._id),['w03','w04','w05']);
 assert.equal((await main({action:'listCollections',limit:0})).data.items.length,1);
 assert.equal((await main({action:'listCollections',limit:1000000,offset:-3})).data.items.length,24);
 assert.equal((await main({action:'listCollections',limit:'invalid',offset:'invalid'})).data.items.length,20);
});
test('作品作者使用档案或业务编号均能关联，未发布或不存在的作者不可点击',async()=>{
 const tables=fixture();tables.museum_collections[1].artistId='artist-doc';
 tables.museum_artists.push({_id:'draft-doc',artistId:'draft',name:'未发布作者',status:'draft',avatar:'https://example.com/private.jpg'});
 tables.museum_collections.push({_id:'draft-author-work',title:'已公开作品',artistId:'draft',artistName:'存档姓名',status:'published'});
 const main=createHandler(database(tables));
 assert.equal((await main({action:'collectionDetail',id:'w01'})).data.artistDocumentId,'artist-doc');
 for(const artistId of ['a','artist-doc'])assert.equal((await main({action:'listCollections',artistId,limit:40})).data.items.length,24);
 const unlinked=await main({action:'collectionDetail',id:'draft-author-work'});
 assert.equal(unlinked.data.artistName,'存档姓名');assert.equal(unlinked.data.artistDocumentId,'');assert.equal(unlinked.data.artistAvatar,'');
 assert.equal((await main({action:'artistDetail',artistId:'draft'})).success,false);
 assert.deepEqual((await main({action:'listCollections',artistId:'draft'})).data,{items:[],hasMore:false});
 assert.equal((await main({action:'listArtists',includeOffline:true})).data.items.length,1);
});
test('文档编号与其他业务编号相同时优先关联明确文档',async()=>{
 const tables=fixture();tables.museum_artists.unshift({_id:'other-doc',artistId:'artist-doc',name:'其他作者',status:'published'});
 tables.museum_collections[0].artistId='artist-doc';
 const main=createHandler(database(tables));const result=await main({action:'collectionDetail',id:'w00'});
 assert.equal(result.data.artistDocumentId,'artist-doc');assert.equal(result.data.artistName,'作者甲');
});
test('业务编号碰撞其他文档时，关联馆藏、代表作品和返回筛选编号均归于当前档案',async()=>{
 const tables={museum_artists:[
  {_id:'doc-a',artistId:'doc-b',name:'甲',status:'published',representativeWorks:['work-a','work-b','work-b-business']},
  {_id:'doc-b',artistId:'biz-b',name:'乙',status:'published',representativeWorks:['work-b','work-b-business','work-a']}
 ],museum_collections:[
  {_id:'work-a',artistId:'doc-a',title:'甲的作品',sortOrder:2,status:'published'},
  {_id:'work-b',artistId:'doc-b',title:'乙的文档关联作品',sortOrder:0,status:'published'},
  {_id:'work-b-business',artistId:'biz-b',title:'乙的业务关联作品',sortOrder:1,status:'published'}
 ]};
 const main=createHandler(database(tables));
 const a=await main({action:'artistDetail',id:'doc-a'});assert.equal(a.data.artistId,'doc-a');
 assert.deepEqual(a.data.relatedCollections.map(x=>x._id),['work-a']);assert.deepEqual(a.data.representativeWorks.map(x=>x._id),['work-a']);
 assert.deepEqual((await main({action:'listCollections',artistId:a.data.artistId})).data.items.map(x=>x._id),['work-a']);
 for(const artistId of ['doc-b','biz-b']){
  const b=await main({action:'artistDetail',artistId});assert.equal(b.data._id,'doc-b');
  assert.deepEqual(b.data.relatedCollections.map(x=>x._id),['work-b','work-b-business']);assert.deepEqual(b.data.representativeWorks.map(x=>x._id),['work-b','work-b-business']);
  assert.deepEqual((await main({action:'listCollections',artistId})).data.items.map(x=>x._id),['work-b','work-b-business']);
 }
 assert.equal((await main({action:'collectionDetail',id:'work-b'})).data.artistDocumentId,'doc-b');
});
test('重复业务编号只归于按解析规则确定的档案，不让另一档案带入作品',async()=>{
 const tables={museum_artists:[{_id:'doc-b',artistId:'shared',name:'乙',status:'published',representativeWorks:['own-b','shared-work']},{_id:'doc-a',artistId:'shared',name:'甲',status:'published'}],museum_collections:[
  {_id:'own-b',artistId:'doc-b',title:'乙作品',status:'published',sortOrder:1},
  {_id:'shared-work',artistId:'shared',title:'业务编号作品',status:'published',sortOrder:0}
 ]};
 const main=createHandler(database(tables));const b=await main({action:'artistDetail',id:'doc-b'});
 assert.equal(b.data.artistId,'doc-b');assert.deepEqual(b.data.relatedCollections.map(x=>x._id),['own-b']);assert.deepEqual(b.data.representativeWorks.map(x=>x._id),['own-b']);
 const a=await main({action:'artistDetail',artistId:'shared'});assert.equal(a.data._id,'doc-a');assert.deepEqual(a.data.relatedCollections.map(x=>x._id),['shared-work']);
});
test('只填写文档编号的艺术家档案兼容关联馆藏和代表作品',async()=>{
 const tables=fixture();delete tables.museum_artists[0].artistId;tables.museum_collections.forEach(row=>row.artistId='artist-doc');
 const main=createHandler(database(tables));const detail=await main({action:'artistDetail',id:'artist-doc'});
 assert.equal(detail.data.artistId,'artist-doc');assert.equal(detail.data.relatedCollections.length,3);assert.equal(detail.data.representativeWorks[0]._id,'w00');
 assert.equal((await main({action:'listCollections',artistId:'artist-doc',limit:40})).data.items.length,24);
});
test('代表作品批量读取且保留配置顺序，只链接同一艺术家的公开馆藏',async()=>{
 const tables=fixture();tables.museum_collections[1].artistId='artist-doc';
 tables.museum_collections.push({_id:'other-work',artistId:'another',title:'其他作者作品',status:'published',sortOrder:0});
 tables.museum_artists[0].representativeWorks=['w03','other-work','hidden','w00','w03',{collectionId:'w01'},
   {title:'独立作品',image:'https://example.com/standalone.jpg',privateNote:'secret'},
   {title:'危险地址',image:'javascript:alert(1)'}];
 const reads=[];const main=createHandler(database(tables,reads));const result=await main({action:'artistDetail',id:'artist-doc'});
 assert.deepEqual(result.data.representativeWorks.map(x=>x._id),['w03','w00','w01','']);
 assert.deepEqual(result.data.relatedCollections.map(x=>x._id),['w00','w01','w02']);
 assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.ok(reads.filter(x=>x.collection==='museum_collections').length<=2,'代表作品不应随配置数量增加逐条云数据库请求');
 assert.ok(reads.filter(x=>x.collection==='museum_artists').length<=3,'业务别名验证只做一次有界查找，不随代表作品数量重复查询');
});
test('所有配置代表作品失效时回退到自己的已发布关联馆藏',async()=>{
 const tables=fixture();tables.museum_artists[0].representativeWorks=['hidden','missing',{title:'空图'}];
 const main=createHandler(database(tables));const result=await main({action:'artistDetail',id:'artist-doc'});
 assert.deepEqual(result.data.representativeWorks.map(x=>x._id),['w00','w01','w02']);
});
test('公开详情清理不支持的图片和私人字段，兼容旧介绍字段',async()=>{
 const tables=fixture();Object.assign(tables.museum_collections[0],{coverImage:'data:image/png;base64,secret',detailImages:['ftp://example.com/work.jpg','https://example.com/detail.jpg',null,{url:'https://example.com/hidden.jpg'}],intro:'',description:'旧版介绍',phone:'secret'});
 tables.museum_artists[0].avatar='javascript:alert(1)';
 const main=createHandler(database(tables));const result=await main({action:'collectionDetail',id:'w00'});
 assert.equal(result.data.coverImage,'');assert.equal(result.data.artistAvatar,'');assert.deepEqual(result.data.detailImages,['https://example.com/detail.jpg']);assert.equal(result.data.intro,'旧版介绍');
 assert.equal(result.data.phone,undefined);assert.equal(result.data.privateNote,undefined);
});
test('缺失 ID 与数据库异常返回可展示错误，不泄漏后台错误',async()=>{
 const main=createHandler(database({}));assert.equal((await main({action:'collectionDetail'})).success,false);const r=await main({action:'listArtists'});assert.equal(r.success,false);assert.equal(r.errMsg.includes('missing'),false);
});
function page(spec){return Object.assign(spec,{data:JSON.parse(JSON.stringify(spec.data)),updates:[],setData(values){
 this.updates.push(values);
 for(const [key,value]of Object.entries(values)){
  const path=key.replace(/\[(\d+)\]/g,'.$1').split('.');let target=this.data;
  path.slice(0,-1).forEach((part,index)=>{if(!target[part])target[part]=/^\d+$/.test(path[index+1])?[]:{};target=target[part];});
  target[path[path.length-1]]=value;
 }
}});}
test('前端迟到搜索响应不会覆盖新搜索；分页失败能保留内容重试',async()=>{
 const pending=[];global.wx={cloud:{callFunction:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}};
 const p=page(listPage('listCollections','collections'));p._version=0;p._artistId='';
 const old=p.fetchList(true);p.data.keyword='new';const latest=p.fetchList(true);
 pending[1].resolve({result:{success:true,data:{items:[{_id:'new'}],hasMore:true}}});await latest;
 pending[0].resolve({result:{success:true,data:{items:[{_id:'old'}],hasMore:false}}});await old;assert.equal(p.data.collections[0]._id,'new');
 const more=p.loadMore();pending[2].reject(Error('offline'));await more;assert.equal(p.data.collections.length,1);assert.equal(p.data.loadingMore,false);
 const retry=p.retry();pending[3].resolve({result:{success:true,data:{items:[{_id:'next'}],hasMore:false}}});await retry;assert.equal(p.data.collections.length,2);
});
test('详情缺失参数结束加载，作者链接使用对应文档 ID 并编码',async()=>{
 const urls=[];global.wx={navigateTo:({url})=>urls.push(url)};
 const p=page(detailPage('collectionDetail','item'));await p.onLoad({});assert.equal(p.data.loading,false);assert.ok(p.data.error);
 p.data.item={artistDocumentId:'name/&id'};p.openArtist();assert.ok(urls[0].endsWith('name%2F%26id'));
 p.data.item={artistId:'hidden'};p.openArtist();assert.equal(urls.length,1);
});
test('关联馆藏导航使用当前档案文档编号，业务别名碰撞不跳到另一位艺术家',()=>{
 const urls=[];global.wx={navigateTo:({url})=>urls.push(url)};global.getCurrentPages=()=>[];
 const p=page(detailPage('artistDetail','artist'));p.data.artist={_id:'doc-a',artistId:'doc-b',name:'甲'};
 p.showCollections();
 const query=new URL('https://test.invalid'+urls[0]).searchParams;
 assert.equal(query.get('artistId'),'doc-a');assert.equal(query.get('artistName'),'甲');
 delete global.getCurrentPages;
});
test('列表和详情卸载后，迟到响应不再写入已销毁页面',async()=>{
 const pending=[];global.wx={cloud:{callFunction:()=>new Promise(resolve=>pending.push(resolve))}};
 const list=page(listPage('listCollections','collections'));const loadingList=list.onLoad({});
 const detail=page(detailPage('collectionDetail','item'));const loadingDetail=detail.onLoad({id:'w00'});
 list.onUnload();detail.onUnload();const writes=[list.updates.length,detail.updates.length];
 pending[0]({result:{success:true,data:{items:[{_id:'late'}],hasMore:false}}});
 pending[1]({result:{success:true,data:{_id:'late',coverImage:'https://example.com/work.jpg'}}});
 await Promise.all([loadingList,loadingDetail]);
 assert.deepEqual([list.updates.length,detail.updates.length],writes);assert.deepEqual(list.data.collections,[]);assert.equal(detail.data.item,null);
});
test('分页去重按原始返回条数推进游标，重复数据不会导致下一页倒退',async()=>{
 const requests=[];const responses=[{items:[{_id:'a'},{_id:'b'}],hasMore:true},{items:[{_id:'b'},{_id:'c'}],hasMore:true},{items:[{_id:'d'}],hasMore:false}];
 global.wx={cloud:{callFunction:async({data})=>{requests.push(data);return{result:{success:true,data:responses.shift()}};}}};
 const p=page(listPage('listCollections','collections'));await p.onLoad({});await p.loadMore();await p.loadMore();
 assert.deepEqual(requests.map(x=>x.offset),[0,2,4]);assert.deepEqual(p.data.collections.map(x=>x._id),['a','b','c','d']);assert.equal(p._offset,5);assert.equal(p.data.hasMore,false);
});
test('深链接只传内容编号，调用动作不能被额外参数覆盖',async()=>{
 const requests=[];global.wx={cloud:{callFunction:async request=>{requests.push(request);return{result:{success:true,data:{_id:'w00',detailImages:['https://example.com/detail.jpg','javascript:alert(1)','https://example.com/detail.jpg']}}};}}};
 const p=page(detailPage('collectionDetail','item'));await p.onLoad({id:'w00',action:'delete',includeOffline:true,headers:'secret'});
 assert.deepEqual(requests[0].data,{id:'w00',artistId:'',action:'collectionDetail'});assert.deepEqual(p.data.images,['https://example.com/detail.jpg']);
 await fetchContent('listArtists',{action:'delete'});assert.equal(requests[1].data.action,'listArtists');
});
test('云图片成功转换后仅用 HTTPS 预览，重复图片只出现一次',async()=>{
 const previews=[],lookups=[];global.wx={cloud:{getTempFileURL:async({fileList})=>{lookups.push(fileList);return{fileList:fileList.map((fileID,index)=>({fileID,status:0,tempFileURL:'https://example.com/cloud-'+index+'.jpg'}))};}},previewImage:options=>previews.push(options)};
 await previewImages(['cloud://env/a.jpg','cloud://env/a.jpg','https://example.com/b.jpg','ftp://example.com/c.jpg'],'cloud://env/a.jpg');
 assert.deepEqual(lookups,[['cloud://env/a.jpg']]);assert.deepEqual(previews,[{current:'https://example.com/cloud-0.jpg',urls:['https://example.com/cloud-0.jpg','https://example.com/b.jpg']}]);
});
test('部分云图片失效时可预览其余图片；当前云图失效时明确提示且不交原始 ID',async()=>{
 const previews=[],toasts=[];global.wx={cloud:{getTempFileURL:async()=>({fileList:[{fileID:'cloud://env/a.jpg',status:-502005,tempFileURL:'https://example.com/expired.jpg'},{fileID:'cloud://env/b.jpg',status:0,tempFileURL:'http://example.com/unsafe.jpg'}]})},previewImage:options=>previews.push(options),showToast:options=>toasts.push(options)};
 await previewImages(['cloud://env/a.jpg','https://example.com/good.jpg'],'https://example.com/good.jpg');
 assert.deepEqual(previews[0],{current:'https://example.com/good.jpg',urls:['https://example.com/good.jpg']});
 const p=page(detailPage('collectionDetail','item'));p.data.images=['cloud://env/a.jpg','https://example.com/good.jpg'];
 await p.previewImage({currentTarget:{dataset:{url:'cloud://env/a.jpg'}}});
 assert.equal(previews.length,1);assert.equal(toasts.length,1);assert.equal(p.data.previewing,false);
});
test('离开详情页后，迟到的云图转换不弹出大图也不提示或写已销毁页面',async()=>{
 for(const failed of [false,true]){
  let resolveLookup,rejectLookup;const previews=[],toasts=[];
  global.wx={cloud:{getTempFileURL:()=>new Promise((resolve,reject)=>{resolveLookup=resolve;rejectLookup=reject;})},previewImage:options=>previews.push(options),showToast:options=>toasts.push(options)};
  const p=page(detailPage('collectionDetail','item'));p._version=0;p._unloaded=false;p.data.images=['cloud://env/a.jpg'];
  const loading=p.previewImage({currentTarget:{dataset:{url:'cloud://env/a.jpg'}}});p.onUnload();const writes=p.updates.length;
  if(failed)rejectLookup(Error('offline'));else resolveLookup({fileList:[{fileID:'cloud://env/a.jpg',status:0,tempFileURL:'https://example.com/a.jpg'}]});
  await loading;assert.equal(previews.length,0);assert.equal(toasts.length,0);assert.equal(p.updates.length,writes);
 }
});
test('独立代表作品点击图片预览，关联代表作品进入对应馆藏详情',async()=>{
 const previews=[],urls=[];global.wx={previewImage:options=>previews.push(options),navigateTo:options=>urls.push(options.url)};global.getCurrentPages=()=>[];
 const p=page(detailPage('artistDetail','artist'));
 await p.openCollection({currentTarget:{dataset:{id:'',url:'https://example.com/independent.jpg'}}});
 assert.equal(urls.length,0);assert.equal(previews[0].current,'https://example.com/independent.jpg');
 p.openCollection({currentTarget:{dataset:{id:'linked/&id',url:'https://example.com/linked.jpg'}}});
 assert.ok(urls[0].endsWith('linked%2F%26id'));delete global.getCurrentPages;
});
test('模块切换不累积导航栈，循环查看接近十层时使用重定向',()=>{
 const navigations=[],redirects=[];global.wx={navigateTo:options=>navigations.push(options.url),redirectTo:options=>redirects.push(options.url)};global.getCurrentPages=()=>[];
 const p=page(listPage('listCollections','collections'));p.switchModule({currentTarget:{dataset:{module:'artists'}}});
 assert.deepEqual(redirects,['/pages/museum-artists/index']);p.switchModule({currentTarget:{dataset:{module:'collections'}}});assert.equal(redirects.length,1);
 navigate('museum-collection-detail','id','w00');assert.equal(navigations.length,1);
 global.getCurrentPages=()=>Array(9).fill({});navigate('museum-artist-detail','id','artist-doc');assert.equal(redirects.length,2);assert.equal(navigations.length,1);delete global.getCurrentPages;
});
test('照片失败状态定位到相应图片，不影响其他馆藏或艺术家',()=>{
 const list=page(listPage('listCollections','collections'));list.data.collections=[{_id:'a'},{_id:'b'}];list.onListImageError({currentTarget:{dataset:{index:1}}});
 assert.equal(list.data.collections[0].imageFailed,undefined);assert.equal(list.data.collections[1].imageFailed,true);
 const p=page(detailPage('artistDetail','artist'));p.data.artist={representativeWorks:[{_id:'a'},{_id:'b'}]};p.onWorkImageError({currentTarget:{dataset:{index:0}}});
 assert.equal(p.data.artist.representativeWorks[0].imageFailed,true);assert.equal(p.data.artist.representativeWorks[1].imageFailed,undefined);
 p.onAuthorImageError();p.onAvatarError();assert.equal(p.data.authorImageFailed,true);assert.equal(p.data.avatarFailed,true);
});
