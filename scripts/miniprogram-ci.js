const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const mode = process.argv[2];
const projectPath = path.resolve(__dirname, '..');
const appid = process.env.MINIPROGRAM_APPID || 'wx7c60c191a0841a09';
const privateKeyPath = process.env.MINIPROGRAM_PRIVATE_KEY_PATH;
const desc = process.env.MINIPROGRAM_CI_DESC || '本地 CI 上传';

if (!['preview', 'upload'].includes(mode)) {
  throw new Error('用法：npm run ci:preview 或 npm run ci:upload');
}

if (!privateKeyPath) {
  throw new Error('请设置 MINIPROGRAM_PRIVATE_KEY_PATH，私钥路径不可写入仓库。');
}

if (!fs.existsSync(privateKeyPath)) {
  throw new Error(`找不到小程序上传私钥文件：${privateKeyPath}`);
}

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath,
  privateKeyPath,
  ignores: ['node_modules/**/*', '.ci/**/*'],
});

const setting = {
  es6: true,
  minify: true,
  autoPrefixWXSS: true,
};

async function main() {
  if (mode === 'preview') {
    const outputDir = path.join(projectPath, '.ci');
    fs.mkdirSync(outputDir, { recursive: true });
    const result = await ci.preview({
      project,
      desc,
      setting,
      qrcodeFormat: 'image',
      qrcodeOutputDest: path.join(outputDir, 'preview-qrcode.jpg'),
    });
    console.log(`预览成功，版本：${result.subPackageInfo?.pluginInfo || result}`);
    return;
  }

  const result = await ci.upload({ project, desc, setting });
  console.log(`上传成功：${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
