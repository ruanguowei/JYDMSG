const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const dest = path.join(root, '.deploy-review-2026/live-review/reviewProbe0912a');
fs.mkdirSync(dest, { recursive: true });
const copied = new Map();
function copy(file) {
  file = require.resolve(file);
  if (copied.has(file)) return copied.get(file);
  const out = path.join(dest, 'business', path.relative(path.join(root, 'cloudfunctions'), file));
  copied.set(file, out);
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/require\(['"]([^'"]+)['"]\)/g, (match, name) => {
    let target;
    if (name === 'wx-server-sdk') target = path.join(dest, 'sdk.js');
    else if (name.startsWith('.')) target = copy(path.resolve(path.dirname(file), name));
    else return match;
    let relative = path.relative(path.dirname(out), target).replace(/\\/g, '/');
    if (!relative.startsWith('.')) relative = './' + relative;
    return `require(${JSON.stringify(relative)})`;
  });
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, source);
  return out;
}
for (const name of ['expertLogin', 'signPledge', 'reviewOrientation']) copy(path.join(root, 'cloudfunctions/quickstartFunctions', name, 'index.js'));
for (const name of ['fetchSubmissionsForEvaluation', 'fetchSubmissionDetail', 'submitExpertScore']) copy(path.join(root, 'cloudfunctions', name, 'index.js'));
for (const name of ['sdk.js','index.js']) fs.copyFileSync(path.join(__dirname, name), path.join(dest, name));
fs.writeFileSync(path.join(dest, 'config-test.json'), JSON.stringify({ expiresAt: Date.now() + 7200000 }));
fs.writeFileSync(path.join(dest, 'package.json'), JSON.stringify({ name: 'review-probe', version: '1.0.0', dependencies: { 'wx-server-sdk': '~2.6.3' } }));
fs.writeFileSync(path.join(dest, 'source-manifest.json'), JSON.stringify([...copied.keys()].map(file => ({ file: path.relative(root, file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })), null, 2));
console.log(JSON.stringify({ dest, businessFiles: copied.size }));
