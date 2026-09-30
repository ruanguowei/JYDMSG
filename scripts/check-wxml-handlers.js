const fs = require('node:fs');
const path = require('node:path');

const pagesRoot = path.join(__dirname, '..', 'miniprogram', 'pages');
const missing = [];

for (const entry of fs.readdirSync(pagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pageRoot = path.join(pagesRoot, entry.name);
  const wxmlPath = path.join(pageRoot, 'index.wxml');
  const jsPath = path.join(pageRoot, 'index.js');
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) continue;

  const wxml = fs.readFileSync(wxmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  const handlers = [...wxml.matchAll(/(?:bind|catch)[A-Za-z]+="([A-Za-z_$][\w$]*)"/g)]
    .map(match => match[1]);

  for (const handler of new Set(handlers)) {
    const exists = js.includes(`${handler}:`)
      || js.includes(`${handler}(`)
      || js.includes(`function ${handler}`)
      || js.includes(`${handler} =`);
    if (!exists) missing.push(`${entry.name}: ${handler}`);
  }
}

if (missing.length) {
  throw new Error(`发现未定义的 WXML 事件处理器:\n${missing.join('\n')}`);
}

console.log('WXML 事件处理器检查通过。');
