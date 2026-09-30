// One explicitly authorized simulation. No write reference to the original table.
const cloud=require('wx-server-sdk'),crypto=require('crypto'),assert=require('assert');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database(),meta=db.collection('review_full_20260913'),clean='pottery_submissions_clean_2026';
const submit=require('./business/submitExpertScore').main;
const preview=require('./business/quickstartFunctions/reviewOrientation').main;
const rules=require('./business/submitExpertScore/evaluationRules');
const prefix='simulation-20260913-preliminary-';
const who=i=>({expertId:prefix+i,expertCode:prefix+i,editionId:'pottery-2026'});
const stable=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
async function all(name){const out=[];for(let skip=0;;skip+=100){const rows=(await db.collection(name).orderBy('_id','asc').skip(skip).limit(100).get()).data;out.push(...rows);if(rows.length<100)return out;}}
async function original(){const rows=await all('pottery_submissions_2026');return{count:rows.length,hash:hash(rows)};}
function score(id,j){const seed=parseInt(hash([id,j]).slice(0,8),16);return{baseScore:(40+seed%61)/10,deductions:{aiNotLabeled:seed%53===0,missingCreativeStatement:seed%47===0}};}
function eligible(w){const p=rules.prepareWork(w);return rules.eligible(w)&&p.participantGroup==='domestic';}
const ok=r=>{assert(r&&r.success,r&&r.message||'调用失败');return r;};
exports.main=async(event={})=>{
 const ctx=cloud.getWXContext();if(ctx.OPENID||ctx.APPID||Date.now()>require('./config-test.json').expiresAt)throw Error('SIMULATION_UNAVAILABLE');
 if(event.action==='prepare'){
  assert.equal((await meta.count()).total,0,'已准备，不得重建');
  const rows=await all(clean);assert(rows.every(w=>!(w.evaluations||[]).length),'已有评分，停止');
  const baseline=await original(),works=rows.filter(eligible);
  await meta.doc('baseline').set({data:{raw:baseline,ids:works.map(w=>w._id),cleanCount:rows.length,cleanNonScoreHash:hash(rows.map(w=>{const r={...w};delete r.evaluations;return r;}))}});
  for(let i=0;i<7;i++)await db.collection('experts').doc(prefix+i).set({data:{...who(i),expertName:`模拟初评评委${i+1}`,expertType:'preliminary',status:'active',pledgeSigned:true,pledgeSignTime:'2026-09-13T00:00:00Z',simulationBatch:'review_full_20260913'}});
  return{success:true,baseline,eligibleCount:works.length,excluded:rows.length-works.length};
 }
 if(event.action==='preview'){
  const j=event.judge;assert(Number.isInteger(j)&&j>=0&&j<7);const identity=who(j);
  const first=ok(await preview(identity)).data;if(first.completed)return{success:true,alreadyComplete:true};
  for(let batchIndex=0;batchIndex<first.batchCount;batchIndex++){
   const batch=ok(await preview({...identity,batchIndex})).data;
   ok(await preview({...identity,action:'viewed',sessionId:first.sessionId,viewedIds:batch.batch.map(w=>w.id)}));
  }
  ok(await preview({...identity,action:'complete',sessionId:first.sessionId}));return{success:true,judge:j,previewed:first.total};
 }
 if(event.action==='batch'){
  const offset=event.offset,count=event.count||30;assert(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=50);
  const baseline=(await meta.doc('baseline').get()).data,ids=baseline.ids.slice(offset,offset+count);assert(ids.length);
  const report={offset,works:ids.length,submitted:0,skipped:0,errors:[],startedAt:Date.now(),maxMs:0};
  // Different starting points model reviewers progressing at different speeds.
  await Promise.all(Array.from({length:7},async(_,j)=>{
   for(let k=0;k<ids.length;k++){
    const id=ids[(k+j*3)%ids.length],row=(await db.collection(clean).doc(id).get()).data;
    if((row.evaluations||[]).some(e=>e.expertCode===prefix+j)){report.skipped++;continue;}
    const t=Date.now();let result;
    try{result=await submit({...who(j),submissionId:id,...score(id,j)});}catch(error){result={success:false,message:error.message};}
    report.maxMs=Math.max(report.maxMs,Date.now()-t);
    if(result.success)report.submitted++;else report.errors.push({id,judge:j,message:result.message});
   }
  }));
  report.finishedAt=Date.now();await meta.doc('batch-'+offset).set({data:report});return{success:!report.errors.length,...report};
 }
 if(event.action==='verify'){
  const baseline=(await meta.doc('baseline').get()).data,rows=await all(clean),byId=new Map(rows.map(w=>[w._id,w]));let records=0;const errors=[];
  for(const id of baseline.ids){const row=byId.get(id),es=row?.evaluations||[];if(es.length!==7)errors.push({id,count:es.length});
   for(let j=0;j<7;j++){const found=es.filter(e=>e.expertCode===prefix+j),expected=score(id,j);if(found.length!==1){errors.push({id,judge:j,duplicatesOrMissing:found.length});continue;}
    const e=found[0],final=Math.max(0,Math.round((expected.baseScore-(expected.deductions.aiNotLabeled?2:0)-(expected.deductions.missingCreativeStatement?1:0))*10)/10);
    if(e.baseScore!==expected.baseScore||e.finalScore!==final)errors.push({id,judge:j,scoreMismatch:true});records++;
   }
  }
  assert.equal(hash(rows.map(w=>{const r={...w};delete r.evaluations;return r;})),baseline.cleanNonScoreHash,'清洗表非评分字段变化');
  const raw=await original();assert.deepStrictEqual(raw,baseline.raw,'原始报名表校验变化');
  const result={success:!errors.length,works:baseline.ids.length,records,errors,rawUnchanged:true,raw};await meta.doc('verification').set({data:result});return result;
 }
 throw Error('UNKNOWN_ACTION');
};
