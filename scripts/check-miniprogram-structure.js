const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const miniprogramRoot = path.join(root, 'miniprogram');

function readJson(relativePath) {
  const file = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const app = readJson('miniprogram/app.json');
assert(Array.isArray(app.pages) && app.pages.length > 0, 'app.json 未注册页面');

for (const page of app.pages) {
  const pageBase = path.join(miniprogramRoot, page);
  assert(fs.existsSync(`${pageBase}.js`), `页面缺少 JS 文件: ${page}`);
  assert(fs.existsSync(`${pageBase}.wxml`), `页面缺少 WXML 文件: ${page}`);
  assert(fs.existsSync(`${pageBase}.wxss`), `页面缺少 WXSS 文件: ${page}`);
  assert(fs.existsSync(`${pageBase}.json`), `页面缺少 JSON 文件: ${page}`);
  JSON.parse(fs.readFileSync(`${pageBase}.json`, 'utf8'));
}

assert(Array.isArray(app.tabBar && app.tabBar.list), 'app.json 缺少 TabBar');
for (const item of app.tabBar.list) {
  assert(item.pagePath && app.pages.includes(item.pagePath), `TabBar 页面未注册: ${item.pagePath}`);
  for (const iconKey of ['iconPath', 'selectedIconPath']) {
    assert(item[iconKey] && fs.existsSync(path.join(miniprogramRoot, item[iconKey])), `TabBar 图标不存在: ${item[iconKey]}`);
  }
}

for (const file of fs.readdirSync(miniprogramRoot)) {
  if (file.endsWith('.json')) JSON.parse(fs.readFileSync(path.join(miniprogramRoot, file), 'utf8'));
}

console.log(`小程序结构检查通过：${app.pages.length} 个页面，${app.tabBar.list.length} 个 TabBar 入口。`);
