const cloud = require('wx-server-sdk'), crypto = require('crypto'), assert = require('assert');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database(), prefix = 'review_probe_0912a_';
const login = require('./business/quickstartFunctions/expertLogin').main;
const pledge = require('./business/quickstartFunctions/signPledge').main;
const preview = require('./business/quickstartFunctions/reviewOrientation').main;
const list = require('./business/fetchSubmissionsForEvaluation').main;
const detail = require('./business/fetchSubmissionDetail').main;
const submit = require('./business/submitExpertScore').main;
const categories = ['technique','culture','algorithm','industry'];
const tables = ['experts','config','controls','logs','clean','final','meta'];
const ref = name => { assert(tables.includes(name)); return db.collection(prefix + name); };
const stable = value => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
async function readAll(collection) {
  const rows = [];
  for (let skip = 0;; skip += 100) {
    const batch = (await collection.orderBy('_id', 'asc').skip(skip).limit(100).get()).data;
    rows.push(...batch); if (batch.length < 100) return rows;
  }
}
async function originalSnapshot() {
  // This reference is only ever passed to the read-only scanner.
  const rows = await readAll(db.collection('pottery_submissions_2026'));
  return { count: rows.length, hash: crypto.createHash('sha256').update(JSON.stringify(stable(rows))).digest('hex'),
    images: rows.map(w => w.perspectiveImage).filter(url => typeof url === 'string' && /^(cloud|https?):\/\//.test(url)).slice(0, 60) };
}
const identity = (phase, judge) => ({ expertId: `${phase}-${judge}`, expertCode: `liveprobe-${phase}-${judge}`, expertName: `测试评委${phase}-${judge}`, editionId: 'pottery-2026' });
function ok(result) { assert(result && result.success, result && result.message || '业务调用失败'); return result; }
const percentile = (rows, q) => rows.length ? rows.slice().sort((a,b) => a-b)[Math.min(rows.length-1, Math.floor(rows.length*q))] : 0;
exports.main = async (event = {}) => {
  const context = cloud.getWXContext();
  if (context.OPENID || context.APPID || Date.now() > require('./config-test.json').expiresAt) throw new Error('PROBE_NOT_AVAILABLE');
  const start = Date.now(), timings = {};
  async function measured(name, fn) { const t = Date.now(); const value = await fn(); (timings[name] || (timings[name] = [])).push(Date.now()-t); return value; }
  const phase = event.phase;
  if (['prepareJudge','scoreJudge'].includes(event.action)) {
    assert(['preliminary','final'].includes(phase)); assert(Number.isInteger(event.judge) && event.judge >= 0 && event.judge < (phase === 'final' ? 11 : 7));
  }
  let result;
  if (['prepareAll', 'scoreAll'].includes(event.action)) {
    assert(['preliminary','final'].includes(phase));
    const action = event.action === 'prepareAll' ? 'prepareJudge' : 'scoreJudge';
    const count = phase === 'final' ? 11 : 7;
    const reports = await Promise.all(Array.from({length:count}, async (_,judge) => {
      try { return await exports.main({action,phase,judge}); }
      catch(error) { return {success:false,judge,error:error.message}; }
    }));
    result={phase,concurrentJudges:count,reports};
  } else if (event.action === 'seed') {
    assert.equal((await ref('clean').count()).total, 0, '已有测试数据，禁止覆盖');
    const snapshot = await originalSnapshot(); assert(snapshot.images.length >= 30, '主视图不足');
    await ref('meta').doc('baseline').set({ data: { count: snapshot.count, hash: snapshot.hash } });
    const sdk = require('./business/submitExpertScore/edition');
    await ref('config').doc('edition').set({ data: sdk.DEFAULT_EDITIONS['pottery-2026'] });
    for (const stage of ['preliminary','final']) for (let i=0;i<(stage==='final'?11:7);i++) {
      const who = identity(stage,i);
      await ref('experts').doc(who.expertId).set({ data: { ...who, expertType: stage, status:'active', pledgeSigned: false } });
    }
    for (let batch=0;batch<600;batch+=20) await Promise.all(Array.from({length:20}, async (_,j) => {
      const i=batch+j, row={ artworkName:`测试作品${i}`, school:`测试院校${i%60}`, schoolProvinces:'江西', category:categories[i%4], perspectiveImage:snapshot.images[i%snapshot.images.length], qualification:true, evaluations:[], workType:'image' };
      await ref('clean').doc(`work-${String(i).padStart(4,'0')}`).set({data:row});
      await ref('final').doc(`work-${String(i).padStart(4,'0')}`).set({data:row});
    }));
    result={originalCount:snapshot.count,originalHash:snapshot.hash,testWorks:600,judges:18};
  } else if (event.action === 'prepareJudge') {
    const who = identity(phase,event.judge);
    ok(await measured('login',()=>login(who,{})));
    ok(await pledge({...who,dateRange:'云端隔离测试',signTime:'2026-09-12T00:00:00Z'},{}));
    assert.equal((await list(who)).code,'ORIENTATION_REQUIRED');
    const first=ok(await measured('preview',()=>preview(who))).data;
    const ids=new Set();
    assert.equal(first.total,30);
    assert.equal((await preview({...who,action:'complete',sessionId:first.sessionId})).success,false);
    for(let batchIndex=0;batchIndex<5;batchIndex++) {
      const b=ok(await measured('preview',()=>preview({...who,batchIndex}))).data;
      b.batch.forEach(w=>{ assert(w.thumbnail,'缩略图地址为空'); ids.add(w.id); });
      ok(await preview({...who,action:'viewed',sessionId:first.sessionId,viewedIds:b.batch.map(w=>w.id)}));
    }
    ok(await preview({...who,action:'complete',sessionId:first.sessionId})); assert.equal(ids.size,30);
    result={phase,judge:event.judge,previewed:ids.size};
  } else if(event.action === 'scoreJudge') {
    const who=identity(phase,event.judge); let submitted=0;
    // Each expert rates 40 works through eight five-work batches across all four categories.
    for(const category of categories) for(let batch=0;batch<2;batch++) {
      const pending=ok(await measured('list',()=>list({...who,category})));
      assert.equal(pending.data.length,5);
      for(const work of pending.data) {
        ok(await measured('detail',()=>detail({...who,submissionId:work.id,category},{})));
        const i=Number(work.id.slice(5)), baseScore=((i*7+event.judge*13)%101)/10;
        const deductions={aiNotLabeled:i%13===0,missingCreativeStatement:i%17===0};
        ok(await measured('submit',()=>submit({...who,submissionId:work.id,baseScore,deductions,finalScore:999})));
        submitted++;
      }
    }
    result={phase,judge:event.judge,submitted};
  } else if(event.action === 'resetScores') {
    let reset=0;
    for(const table of ['clean','final']) {
      const rows=(await readAll(ref(table))).filter(w=>(w.evaluations||[]).length);
      for(let i=0;i<rows.length;i+=20) await Promise.all(rows.slice(i,i+20).map(w=>ref(table).doc(w._id).update({data:{evaluations:[],qualification:true}})));
      reset+=rows.length;
    }
    result={reset};
  } else if(event.action === 'edgeCases') {
    const who=identity('final',0), submissionId='work-0599';
    assert.equal((await submit({...who,submissionId,baseScore:0.01})).success,false);
    ok(await submit({...who,submissionId,baseScore:0,deductions:{aiNotLabeled:true}}));
    ok(await submit({...who,submissionId,baseScore:0,deductions:{aiNotLabeled:true}}));
    const row=(await ref('final').doc(submissionId).get()).data;
    assert.equal(row.evaluations.length,1); assert.equal(row.evaluations[0].finalScore,0);
    ok(await submit({...who,submissionId,disqualify:true}));
    assert.equal((await submit({...identity('final',1),submissionId,baseScore:10})).success,false);
    assert.equal((await ref('clean').doc(submissionId).get()).data.qualification,false);
    assert.equal((await detail({...who,submissionId},{})).success,false);
    result={invalidRejected:true,zeroValid:true,retryNoDuplicate:true,vetoBlocks:true};
  } else if(event.action === 'verify') {
    const counts={};
    for(const stage of ['clean','final']) {
      const works=await readAll(ref(stage)); let scores=0;
      for(const work of works) {
        const es=work.evaluations||[]; assert.equal(new Set(es.map(e=>e.expertCode)).size,es.length);
        for(const e of es) {
          const expected=Math.max(0,Math.round((e.baseScore-(e.deductions.aiNotLabeled?2:0)-(e.deductions.missingCreativeStatement?1:0))*10)/10);
          assert.equal(e.finalScore,expected); scores++;
        }
      }
      counts[stage]={works:works.length,scores};
    }
    assert.equal(counts.clean.scores,280); assert.equal(counts.final.scores,441);
    const baseline=(await ref('meta').doc('baseline').get()).data, after=await originalSnapshot();
    assert.equal(after.count,baseline.count); assert.equal(after.hash,baseline.hash,'原始报名表校验值发生变化');
    result={counts,originalUnchanged:true,originalCount:after.count,originalHash:after.hash};
  } else if(event.action === 'cleanup') {
    // Only collections in this fixed test namespace are ever removed.
    const counts={};
    for(const name of tables) { const rows=await readAll(ref(name)); for(let i=0;i<rows.length;i+=20) await Promise.all(rows.slice(i,i+20).map(w=>ref(name).doc(w._id).remove())); counts[name]=rows.length; }
    result={removed:counts};
  } else throw new Error('UNKNOWN_TEST_ACTION');
  const metrics=Object.fromEntries(Object.entries(timings).map(([name,values])=>[name,{count:values.length,p50:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values),over3s:values.filter(v=>v>3000).length}]));
  return {success:true,action:event.action,result,metrics,durationMs:Date.now()-start};
};
