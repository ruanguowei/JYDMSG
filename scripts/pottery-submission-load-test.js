const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ENV_ID = 'jdzyzdmsg-5g4rgrjl2008796f';
const COLLECTION = 'pottery_submissions_2026';
const FUNCTION_NAME = 'quickstartFunctions';
const BATCH_ID = 'LOADTEST_20260722_CODEX20_A7C9';
const LOAD_TEST_TOKEN = 'lt_9e81c54b72f640a3b9d805db36f2b4ca';
const STORAGE_FILE_ID_PREFIX = 'cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268/';
const DEFAULT_MEDIA_DIR = 'C:\\Users\\Ruan\\Desktop\\景德镇艺术职业大学美术馆\\第三界大陶展\\测试信息\\图片';
const USER_COUNT = 20;
const REGULAR_USER_COUNT = 10;
const STAGE_ROOT = path.join(os.tmpdir(), 'pottery-submission-load-test', BATCH_ID);
const REPORT_DIR = path.resolve(__dirname, '..', 'outputs', 'load-tests');
const REPORT_FILE = path.join(REPORT_DIR, `${BATCH_ID}.json`);

function printUsage() {
  console.log(`
第三届大陶展20并发报名测试

用法：
  node scripts/pottery-submission-load-test.js run [媒体目录]
  node scripts/pottery-submission-load-test.js prepare [媒体目录]
  node scripts/pottery-submission-load-test.js upload [媒体目录]
  node scripts/pottery-submission-load-test.js submit
  node scripts/pottery-submission-load-test.js verify
  node scripts/pottery-submission-load-test.js cleanup

说明：
  run      准备素材、上传、20并发提交、核验，并自动清理云端测试数据和文件。
  prepare  只在系统临时目录生成20套测试素材，不写云端。
  upload   准备并上传20套素材，不提交报名。
  submit   使用已经上传的素材并发提交20条报名，不自动清理。
  verify   查询本批次报名记录。
  cleanup  精确删除本批次20个测试OpenID的记录和云存储目录。

生产环境：${ENV_ID}
批次号：${BATCH_ID}
默认媒体目录：${DEFAULT_MEDIA_DIR}
`);
}

function testOpenId(index) {
  return `loadtest:${BATCH_ID}:user-${String(index).padStart(2, '0')}`;
}

function userName(index) {
  return `压测用户${String(index).padStart(2, '0')}`;
}

function userCloudRoot(index) {
  return `load-tests/${BATCH_ID}/user-${String(index).padStart(2, '0')}`;
}

function cloudFileId(cloudPath) {
  return `${STORAGE_FILE_ID_PREFIX}${cloudPath}`;
}

function detectImageFormat(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const bytes = Buffer.alloc(12);
  try {
    fs.readSync(fd, bytes, 0, bytes.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return 'unsupported';
}

function resolveMedia(mediaDir) {
  if (!fs.existsSync(mediaDir)) throw new Error(`媒体目录不存在：${mediaDir}`);
  const files = fs.readdirSync(mediaDir)
    .map(name => path.join(mediaDir, name))
    .filter(filePath => fs.statSync(filePath).isFile());

  const images = files
    .map(filePath => ({
      filePath,
      size: fs.statSync(filePath).size,
      format: detectImageFormat(filePath)
    }))
    .filter(item => ['jpeg', 'png'].includes(item.format) && item.size <= 5 * 1024 * 1024)
    .sort((a, b) => a.size - b.size);

  const videos = files
    .filter(filePath => path.extname(filePath).toLowerCase() === '.mp4')
    .map(filePath => ({ filePath, size: fs.statSync(filePath).size }))
    .filter(item => item.size <= 100 * 1024 * 1024)
    .sort((a, b) => a.size - b.size);

  if (images.length < 3) throw new Error('至少需要3张真实格式为JPG/PNG且不超过5MB的图片');
  if (!videos.length) throw new Error('没有找到100MB以内的MP4视频');
  return { images: images.slice(0, 3), video: videos[0] };
}

function assertSafeStageRoot() {
  const expectedParent = path.join(os.tmpdir(), 'pottery-submission-load-test');
  const relative = path.relative(expectedParent, STAGE_ROOT);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`拒绝操作不安全的临时目录：${STAGE_ROOT}`);
  }
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function prepareMedia(mediaDir) {
  const selected = resolveMedia(mediaDir);
  assertSafeStageRoot();
  fs.rmSync(STAGE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(STAGE_ROOT, { recursive: true });

  const regularNames = [
    'perspective', 'front', 'right', 'back', 'left', 'top-bottom', 'detail'
  ];

  for (let index = 1; index <= USER_COUNT; index += 1) {
    const userDir = path.join(STAGE_ROOT, `user-${String(index).padStart(2, '0')}`);
    copyFile(selected.images[0].filePath, path.join(userDir, `personal.${selected.images[0].format === 'jpeg' ? 'jpg' : 'png'}`));

    if (index <= REGULAR_USER_COUNT) {
      regularNames.forEach((name, slotIndex) => {
        const image = selected.images[slotIndex % selected.images.length];
        const extension = image.format === 'jpeg' ? 'jpg' : 'png';
        copyFile(image.filePath, path.join(userDir, `${name}.${extension}`));
      });
    } else {
      copyFile(selected.video.filePath, path.join(userDir, 'video.mp4'));
    }
  }

  const manifest = {
    batchId: BATCH_ID,
    envId: ENV_ID,
    createdAt: new Date().toISOString(),
    mediaDir,
    selected,
    stageRoot: STAGE_ROOT,
    users: Array.from({ length: USER_COUNT }, (_, offset) => ({
      index: offset + 1,
      openid: testOpenId(offset + 1),
      workType: offset < REGULAR_USER_COUNT ? 'regular' : 'video',
      cloudRoot: userCloudRoot(offset + 1)
    }))
  };
  fs.writeFileSync(path.join(STAGE_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`已准备20套素材：${STAGE_ROOT}`);
  console.log(`图片：${selected.images.map(item => path.basename(item.filePath)).join('、')}`);
  console.log(`视频：${path.basename(selected.video.filePath)}（${selected.video.size}字节）`);
  return manifest;
}

function loadManifest() {
  const manifestPath = path.join(STAGE_ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('尚未准备测试素材，请先运行 prepare 或 upload');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function tcbCliInvocation() {
  const configuredPath = process.env.TCB_CLI_PATH;
  if (process.platform !== 'win32') {
    return { command: configuredPath || 'tcb', prefixArgs: [] };
  }

  const npmBinDir = configuredPath
    ? path.dirname(configuredPath)
    : path.join(process.env.APPDATA || 'C:\\Users\\Ruan\\AppData\\Roaming', 'npm');
  const cliEntry = path.join(npmBinDir, 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb');
  return { command: process.execPath, prefixArgs: [cliEntry] };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      windowsHide: true,
      cwd: options.cwd || process.cwd()
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      const result = { code, stdout, stderr, elapsedMs: Date.now() - startedAt };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(stderr || stdout || `命令退出码：${code}`), { result }));
    });
  });
}

function runTcb(args) {
  const cli = tcbCliInvocation();
  return runProcess(cli.command, [...cli.prefixArgs, ...args, '-e', ENV_ID]);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function uploadMedia() {
  const manifest = loadManifest();
  console.log('开始上传20套测试素材（最多4个用户目录并行）...');
  await mapLimit(manifest.users, 4, async user => {
    const localDir = path.join(STAGE_ROOT, `user-${String(user.index).padStart(2, '0')}`);
    const result = await runTcb(['storage', 'upload', localDir, user.cloudRoot, '--times', '3', '--interval', '1000', '--json']);
    console.log(`素材上传完成 user-${String(user.index).padStart(2, '0')}，${result.elapsedMs}ms`);
    return result;
  });
  console.log(`全部素材已上传至：load-tests/${BATCH_ID}/`);
}

function stagedFileName(index, baseName) {
  const userDir = path.join(STAGE_ROOT, `user-${String(index).padStart(2, '0')}`);
  const match = fs.readdirSync(userDir).find(name => path.parse(name).name === baseName);
  if (!match) throw new Error(`user-${index} 缺少文件：${baseName}`);
  return match;
}

function createSubmissionPayload(index) {
  const isRegular = index <= REGULAR_USER_COUNT;
  const cloudRoot = userCloudRoot(index);
  const personalName = stagedFileName(index, 'personal');
  const baseData = {
    name: userName(index),
    gender: index % 2 ? '男' : '女',
    school: `压测学校${String(index).padStart(2, '0')}`,
    schoolProvinces: '江西省',
    grade: '大二',
    birthDate: `200${index % 5}-0${(index % 9) + 1}-15`,
    major: '陶瓷艺术设计',
    phone: `1880000${String(index).padStart(4, '0')}`,
    email: `loadtest${String(index).padStart(2, '0')}@example.com`,
    idNumber: `36020320000101${String(index).padStart(4, '0')}`,
    teacher: `压测指导老师${String(index).padStart(2, '0')}`,
    teacherPhone: `1890000${String(index).padStart(4, '0')}`,
    address: `江西省景德镇市压测地址${String(index).padStart(2, '0')}`,
    photoUrl: cloudFileId(`${cloudRoot}/${personalName}`),
    workType: isRegular ? 'regular' : 'video',
    artworkName: `${BATCH_ID}-并发作品-${String(index).padStart(2, '0')}`,
    createYear: '2026',
    dimensions: [{ length: '20', width: '20', height: '30' }],
    category: '传统·匠心传承',
    craftMaterial: isRegular ? '陶瓷综合材料' : '',
    artworkDescription: `${BATCH_ID} 第${String(index).padStart(2, '0')}名模拟用户并发报名测试数据`,
    specialDisplay: '',
    videoDuration: '',
    videoResolution: '',
    videoAspectRatio: '',
    shootingTechnique: '',
    baiduCloudLink: '',
    baiduCloudPassword: ''
  };

  if (isRegular) {
    const names = ['perspective', 'front', 'right', 'back', 'left', 'top-bottom', 'detail'];
    const ids = names.map(name => cloudFileId(`${cloudRoot}/${stagedFileName(index, name)}`));
    return {
      ...baseData,
      perspectiveImage: ids[0],
      fourViewImages: ids.slice(1, 4),
      detailImages: ids.slice(4, 7),
      video: {
        fileId: '', fileName: '', sizeBytes: 0, format: '', durationSeconds: 0,
        width: 0, height: 0, aspectRatio: '', uploadStatus: 'ready', uploadedAt: null
      }
    };
  }

  const videoPath = path.join(STAGE_ROOT, `user-${String(index).padStart(2, '0')}`, 'video.mp4');
  return {
    ...baseData,
    perspectiveImage: '',
    fourViewImages: [],
    detailImages: [],
    videoDuration: '5.06秒',
    videoResolution: '1280x720',
    videoAspectRatio: '16:9',
    shootingTechnique: '压测视频素材',
    video: {
      fileId: cloudFileId(`${cloudRoot}/video.mp4`),
      fileName: 'video.mp4',
      sizeBytes: fs.statSync(videoPath).size,
      format: 'mp4',
      durationSeconds: 5.06195,
      width: 1280,
      height: 720,
      aspectRatio: '1280:720',
      uploadStatus: 'uploaded',
      uploadedAt: Date.now()
    }
  };
}

function extractBusinessResult(rawOutput) {
  const normalizedOutput = String(rawOutput || '').trim();
  const firstBrace = normalizedOutput.indexOf('{');
  const lastBrace = normalizedOutput.lastIndexOf('}');
  const candidates = [];
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(normalizedOutput.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(...normalizedOutput.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(candidates[index]);
      const queue = [parsed];
      while (queue.length) {
        const value = queue.shift();
        if (typeof value === 'string' && value.trim().startsWith('{')) {
          try { queue.push(JSON.parse(value)); } catch (error) { /* 忽略非JSON字符串 */ }
        } else if (value && typeof value === 'object') {
          if (typeof value.success === 'boolean' && (value.data || value.errMsg)) return value;
          queue.push(...Object.values(value));
        }
      }
    } catch (error) {
      // CLI可能在JSON前输出版本提示，继续向前寻找。
    }
  }
  return null;
}

async function submitOne(index) {
  const payload = {
    type: 'createPotterySubmission',
    editionId: 'pottery-2026',
    loadTestBatchId: BATCH_ID,
    loadTestToken: LOAD_TEST_TOKEN,
    testOpenid: testOpenId(index),
    data: createSubmissionPayload(index)
  };
  const payloadDir = path.join(STAGE_ROOT, 'payloads');
  fs.mkdirSync(payloadDir, { recursive: true });
  const payloadPath = path.join(payloadDir, `user-${String(index).padStart(2, '0')}.json`);
  fs.writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
  const result = await runTcb(['fn', 'invoke', FUNCTION_NAME, '-d', `@${payloadPath}`, '--json']);
  const business = extractBusinessResult(result.stdout);
  return {
    index,
    openid: testOpenId(index),
    elapsedMs: result.elapsedMs,
    cliSuccess: true,
    businessSuccess: Boolean(business && business.success),
    submissionId: business && business.data ? business.data.submissionId : '',
    workCode: business && business.data ? business.data.workCode : '',
    errMsg: business && business.errMsg ? business.errMsg : '',
    rawOutput: business ? undefined : result.stdout
  };
}

async function submitAll() {
  loadManifest();
  console.log('同时启动20个正式 createPotterySubmission 调用...');
  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    Array.from({ length: USER_COUNT }, (_, offset) => submitOne(offset + 1))
  );
  const results = settled.map((item, offset) => item.status === 'fulfilled'
    ? item.value
    : {
        index: offset + 1,
        openid: testOpenId(offset + 1),
        cliSuccess: false,
        businessSuccess: false,
        errMsg: item.reason && item.reason.message ? item.reason.message : String(item.reason)
      });
  const successCount = results.filter(item => item.businessSuccess).length;
  const workCodes = results.map(item => item.workCode).filter(Boolean);
  const duplicateWorkCodes = workCodes.length - new Set(workCodes).size;
  const report = {
    batchId: BATCH_ID,
    envId: ENV_ID,
    completedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    successCount,
    failureCount: USER_COUNT - successCount,
    duplicateWorkCodes,
    results
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.table(results.map(item => ({
    用户: item.index,
    成功: item.businessSuccess,
    作品编号: item.workCode,
    耗时ms: item.elapsedMs || '',
    错误: item.errMsg || ''
  })));
  console.log(`汇总：成功 ${successCount}/20，重复作品编号 ${duplicateWorkCodes}，总耗时 ${report.elapsedMs}ms`);
  console.log(`报告：${REPORT_FILE}`);
  return report;
}

function databaseCommand(commandType, command) {
  return JSON.stringify([{
    TableName: COLLECTION,
    CommandType: commandType,
    Command: JSON.stringify(command)
  }]);
}

async function verifyRecords() {
  const openids = Array.from({ length: USER_COUNT }, (_, offset) => testOpenId(offset + 1));
  const command = databaseCommand('QUERY', {
    find: COLLECTION,
    filter: { _openid: { $in: openids } },
    projection: { _id: 1, _openid: 1, workCode: 1, artworkName: 1, workType: 1 },
    limit: 100
  });
  const result = await runTcb(['db', 'nosql', 'execute', '--command', command, '--json']);
  console.log('本批次数据库查询完成：');
  console.log(result.stdout.trim());
  return result.stdout;
}

async function cleanup() {
  const openids = Array.from({ length: USER_COUNT }, (_, offset) => testOpenId(offset + 1));
  console.log('清理前查询本批次数据库记录...');
  await verifyRecords();

  const deleteCommand = databaseCommand('DELETE', {
    delete: COLLECTION,
    deletes: [{ q: { _openid: { $in: openids } }, limit: 0 }]
  });
  const dbResult = await runTcb(['db', 'nosql', 'execute', '--command', deleteCommand, '--json']);
  console.log('数据库清理结果：');
  console.log(dbResult.stdout.trim());

  const cloudDirectory = `load-tests/${BATCH_ID}/`;
  console.log('云存储删除预览：');
  const preview = await runTcb(['storage', 'rm', cloudDirectory, '--dir', '--dry-run', '--json']);
  console.log(preview.stdout.trim());
  const storageResult = await runTcb(['storage', 'rm', cloudDirectory, '--dir', '--force', '--json']);
  console.log('云存储清理结果：');
  console.log(storageResult.stdout.trim());

  console.log('清理后再次查询数据库，应返回0条测试记录：');
  await verifyRecords();
}

async function main() {
  const action = String(process.argv[2] || 'help').toLowerCase();
  const mediaDir = process.argv[3] || DEFAULT_MEDIA_DIR;
  if (['help', '-h', '--help'].includes(action)) {
    printUsage();
    return;
  }

  if (action === 'prepare') {
    prepareMedia(mediaDir);
    return;
  }
  if (action === 'upload') {
    prepareMedia(mediaDir);
    await uploadMedia();
    return;
  }
  if (action === 'submit') {
    await submitAll();
    return;
  }
  if (action === 'verify') {
    await verifyRecords();
    return;
  }
  if (action === 'cleanup') {
    await cleanup();
    return;
  }
  if (action === 'run') {
    let cloudResourcesCreated = false;
    try {
      prepareMedia(mediaDir);
      cloudResourcesCreated = true;
      await uploadMedia();
      const report = await submitAll();
      await verifyRecords();
      if (report.successCount !== USER_COUNT || report.duplicateWorkCodes > 0) {
        process.exitCode = 1;
      }
    } finally {
      if (cloudResourcesCreated) {
        console.log('开始自动清理本批次生产测试数据...');
        await cleanup();
      }
    }
    return;
  }
  throw new Error(`未知操作：${action}`);
}

main().catch(error => {
  console.error('压测脚本执行失败：', error.message);
  if (error.result) {
    if (error.result.stdout) console.error(error.result.stdout);
    if (error.result.stderr) console.error(error.result.stderr);
  }
  console.error(`如已上传或提交，请运行清理命令：node scripts/pottery-submission-load-test.js cleanup`);
  process.exitCode = 1;
});
