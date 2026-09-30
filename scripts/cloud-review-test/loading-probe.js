const real=require('wx-server-sdk'),assert=require('assert');
const sdk=require('./sdk'),business=require('./business');
exports.main=async(event={})=>{
  const context=real.getWXContext();
  if(context.OPENID||context.APPID||Date.now()>require('./config.json').expiresAt)throw Error('PROBE_UNAVAILABLE');
  const category=event.category,stage=event.stage||'preliminary';
  assert(['technique','culture','algorithm','industry'].includes(category));
  assert(['preliminary','final'].includes(stage));
  // Existing simulation ID checks the all-scored case without reactivating it.
  const code=event.scored?'simulation-20260914-preliminary-0':'readonly-loading-probe';
  const result={category,stage,scored:!!event.scored,runs:[]};
  for(let round=0;round<3;round++){
    const samples={};
    for(const batchOnly of round%2?[true,false]:[false,true]){
      sdk.reset(code,stage);const start=Date.now();
      const response=await business.main({expertCode:code,editionId:'pottery-2026',category,batchOnly});
      assert(response.success,response.message);samples[batchOnly?'optimized':'original']={ms:Date.now()-start,...sdk.metrics(),ids:response.data.map(w=>w.id)};
    }
    assert.deepStrictEqual(samples.optimized.ids,samples.original.ids,'作品或顺序不一致');
    result.runs.push(samples);
  }
  return {success:true,...result};
};
