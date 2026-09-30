const real=require('wx-server-sdk');
real.init({env:real.DYNAMIC_CURRENT_ENV});
let metrics, expert;
const allowed=new Set(['exhibition_editions','edition_controls','pottery_submissions_clean_2026','pottery_submissions_for_final_2026']);
function wrap(query,name){
  return new Proxy({}, {get(_,key){
    if(['where','field','orderBy','skip','limit','doc'].includes(key)) return (...args)=>wrap(query[key](...args),name);
    if(key==='get')return async()=>{const result=await query.get();const count=Array.isArray(result.data)?result.data.length:result.data?1:0;
      metrics.calls++;metrics.rows+=count;metrics.byTable[name]=(metrics.byTable[name]||0)+count;return result;};
    throw Error('READ_ONLY_METHOD: '+String(key));
  }});
}
const db=real.database();
module.exports={init(){},DYNAMIC_CURRENT_ENV:real.DYNAMIC_CURRENT_ENV,
  reset(code,stage){metrics={calls:0,rows:0,byTable:{}};expert={_id:code,expertCode:code,expertType:stage,status:'active',editionId:'pottery-2026',pledgeSigned:true,
    reviewOrientations:{['pottery-2026_'+stage]:{version:'orientation-total-v1',pledgeStamp:'null',completedAt:1}}};},
  metrics:()=>metrics,
  database:()=>({command:db.command,collection(name){
    if(name==='experts')return{where(){return{get:async()=>({data:[expert]})};}};
    if(!allowed.has(name))throw Error('PROTECTED_COLLECTION');return wrap(db.collection(name),name);
  }})};
