const fs = require('node:fs');
const path = require('node:path');

const pagesRoot = path.join(__dirname, '..', 'miniprogram', 'pages');
const errors = [];

for (const entry of fs.readdirSync(pagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(pagesRoot, entry.name, 'index.wxml');
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const stack = [];
  const tokens = source.match(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    const closing = /^<\//.test(token);
    const match = token.match(/^<\/?([A-Za-z][\w-]*)/);
    if (!match) continue;
    const tag = match[1];
    const selfClosing = /\/\s*>$/.test(token);
    if (closing) {
      const expected = stack.pop();
      if (expected !== tag) errors.push(`${entry.name}: 关闭标签 </${tag}> 与 <${expected || '无'}> 不匹配`);
    } else if (!selfClosing) {
      stack.push(tag);
    }
  }
  if (stack.length) errors.push(`${entry.name}: 未关闭标签 <${stack[stack.length - 1]}>`);
}

if (errors.length) throw new Error(`WXML 标签检查失败:\n${errors.join('\n')}`);
console.log('WXML 标签结构检查通过。');
