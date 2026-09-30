// Local file packaging only: never connects to CloudBase or deploys anything.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const common = path.join(root, 'cloudfunctions/quickstartFunctions/common');
function copy(source, target) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target); }
for (const target of ['cloudfunctions/common/rubric.js', 'cloudfunctions/quickstartFunctions/common/rubric.js', 'cloudfunctions/submitExpertScore/rubric.js', 'miniprogram/utils/evaluation-rubric.js']) {
  copy(path.join(common, 'evaluationRubric.js'), path.join(root, target));
}
for (const fn of ['submitExpertScore', 'fetchSubmissionDetail', 'fetchSubmissionsForEvaluation']) {
  for (const file of ['edition.js', 'evaluationRules.js', 'evaluationStorage.js', 'reviewOrientation.js']) copy(path.join(common, file), path.join(root, 'cloudfunctions', fn, file));
}
copy(path.join(common, 'evaluationRules.js'), path.join(root, 'miniprogram/utils/evaluation-rules.js'));
// The aggregate functions are canonical; standalone deployments must contain all imports.
for (const fn of ['submitExpertScore', 'fetchSubmissionsForEvaluation']) {
  let code = fs.readFileSync(path.join(root, 'cloudfunctions/quickstartFunctions', fn, 'index.js'), 'utf8');
  code = code.replace(/require\('\.\.\/common\//g, "require('./");
  fs.writeFileSync(path.join(root, 'cloudfunctions', fn, 'index.js'), code);
}
console.log('评审本地运行文件已同步（未连接云端）');
