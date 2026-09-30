const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkFiles() {
  const requiredFiles = [
    'miniprogram/envList.js',
    'cloudfunctions/quickstartFunctions/common/edition.js',
    'cloudfunctions/quickstartFunctions/common/video.js',
    'cloudfunctions/quickstartFunctions/common/adminOperation.js',
    'cloudfunctions/common/rubric.js',
    'cloudfunctions/common/certificate.js',
    'cloudfunctions/quickstartFunctions/manageAdminOperation/index.js',
    'cloudfunctions/quickstartFunctions/manageCertificates/index.js',
    'cloudfunctions/fetchSubmissionsForEvaluation/index.js',
    'tests/helpers/stage8FlowSimulator.js',
    'tests/README.md'
  ];

  for (const file of requiredFiles) {
    assert(exists(file), `缺少升级关键文件：${file}`);
  }
}

function checkEnvironmentRouting() {
  const envList = read('miniprogram/envList.js');
  assert(envList.includes('jdzyzdmsg-5g4rgrjl2008796f'), '缺少生产环境 ID');
  assert(!envList.includes('jdzyzdmsg-test-4gx2v0bw182af653'), '不可见测试环境 ID 不应继续作为当前联调环境');
  assert(envList.includes("case 'release'") || envList.includes('release'), '环境选择应区分 release');
}

function checkRoutes() {
  const router = read('cloudfunctions/quickstartFunctions/index.js');
  for (const route of [
    'getCurrentEdition',
    'fetchMuseumContent',
    'manageMuseumContent',
    'confirmSubmissionVideo',
    'manageAdminOperation',
    'manageCertificates',
    'fetchAllDeliveries'
  ]) {
    assert(router.includes(`case '${route}'`), `聚合云函数缺少路由：${route}`);
  }
}

function checkSafety() {
  const adminOperation = read('cloudfunctions/quickstartFunctions/common/adminOperation.js');
  assert(adminOperation.includes('历史只读届次不允许执行危险操作'), '危险操作缺少历史届只读保护');
  assert(adminOperation.includes('CONFIRMATION_TTL_MS'), '危险操作缺少确认码有效期');

  const router = read('cloudfunctions/quickstartFunctions/index.js');
  const adminOperationModule = require('../cloudfunctions/quickstartFunctions/common/adminOperation');
  assert(router.includes('rejectUnsafeDirectOperation'), '聚合云函数缺少危险旧路由拒绝函数');
  assert(router.includes('buildSafeEventSummary'), '聚合云函数日志必须使用脱敏事件摘要');
  for (const unsafeType of [
    'cleanSubmissionsData',
    'generatePreliminaryTable',
    'startFinalEvaluation',
    'generateFinalRanking',
    'clearCleanTable',
    'clearTestData',
    'clearAllData',
    'fixDateFormat',
    'swapEvaluations',
    'convertImageLinks',
    'clearCloudStorageFiles'
  ]) {
    assert(router.includes(`case '${unsafeType}'`), `缺少危险旧路由保护分支：${unsafeType}`);
    assert(
      adminOperationModule.DANGEROUS_OPERATIONS[unsafeType],
      `安全流水线缺少危险操作定义：${unsafeType}`,
    );
  }

  const manageAdminOperation = read('cloudfunctions/quickstartFunctions/manageAdminOperation/index.js');
  assert(manageAdminOperation.includes('危险操作执行器尚未接入'), '真实危险执行器不应在本地阶段开放');
  assert(manageAdminOperation.includes('cloud.uploadFile'), '备份步骤必须导出云存储快照');
  assert(manageAdminOperation.includes('snapshot-'), '备份快照必须支持分片文件');
  assert(manageAdminOperation.includes('findLatestOperationLog'), '执行确认必须从服务端审计记录读取确认码哈希');

  const adminPage = read('miniprogram/pages/admin-panel/index.wxml');
  assert(adminPage.includes('执行器仍处于保护接入阶段'), '管理员页面应明确真实危险执行尚未开放');
  assert(adminPage.includes('创建备份清单'), '管理员页面缺少备份清单步骤');
  assert(adminPage.includes('生成 10 分钟确认码'), '管理员页面缺少确认码步骤');
  assert(adminPage.includes('验证受保护执行链路'), '管理员页面缺少受保护执行步骤');
}

function checkTests() {
  const packageJson = JSON.parse(read('package.json'));
  for (const scriptName of ['test:static', 'test:unit', 'test:integration:local', 'test:smoke', 'test:structure', 'test:handlers', 'test:wxml']) {
    assert(packageJson.scripts && packageJson.scripts[scriptName], `package.json 缺少 ${scriptName}`);
  }
}

function checkCertificatePipeline() {
  const manageCertificates = read('cloudfunctions/quickstartFunctions/manageCertificates/index.js');
  assert(manageCertificates.includes("action === 'apply'"), '证书管理缺少受保护批处理入口');
  assert(manageCertificates.includes('assertCertificateSafetyGate'), '证书批处理缺少安全流水线闸门');
  assert(manageCertificates.includes("operationName !== 'uploadCertificates'"), '证书确认码必须绑定 uploadCertificates 操作');
  assert(manageCertificates.includes("status: 'replaced'"), '证书替换缺少 replaced 版本标记');
  assert(manageCertificates.includes('certificate_match_logs'), '证书批处理缺少匹配日志');
}

function main() {
  const checks = [
    ['关键文件', checkFiles],
    ['环境路由', checkEnvironmentRouting],
    ['云函数路由', checkRoutes],
    ['危险操作保护', checkSafety],
    ['证书批处理保护', checkCertificatePipeline],
    ['测试命令', checkTests]
  ];

  for (const [label, fn] of checks) {
    fn();
    console.log(`✓ ${label}`);
  }

  console.log('升级本地就绪检查通过。云端资源、微信开发者工具、真机和生产发布仍需单独验收。');
}

main();
