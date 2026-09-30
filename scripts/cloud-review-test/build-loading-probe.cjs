const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
const dest = path.join(root, '.deploy-review-2026/loading-probe/stage/reviewLoadingProbe');
fs.mkdirSync(dest, {recursive:true});
for(const name of ['index.js','edition.js','reviewOrientation.js','evaluationRules.js']) {
  const source=fs.readFileSync(path.join(root,'cloudfunctions/fetchSubmissionsForEvaluation',name),'utf8');
  fs.writeFileSync(path.join(dest,name==='index.js'?'business.js':name),source.replace(/require\('wx-server-sdk'\)/g,"require('./sdk')"));
}
for(const [source,target] of [['loading-probe.js','index.js'],['loading-sdk.js','sdk.js']]) fs.copyFileSync(path.join(__dirname,source),path.join(dest,target));
fs.writeFileSync(path.join(dest,'config.json'),JSON.stringify({expiresAt:Date.now()+3600000}));
fs.writeFileSync(path.join(dest,'package.json'),JSON.stringify({name:'loading-probe',version:'1.0.0',dependencies:{'wx-server-sdk':'~2.6.3'}}));
console.log(dest);
