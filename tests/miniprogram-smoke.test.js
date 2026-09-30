const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const miniprogramRoot = path.join(root, 'miniprogram');
const cloudfunctionsRoot = path.join(root, 'cloudfunctions');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('已注册页面、Tab 图标和目标云函数入口均存在', () => {
  const appConfig = JSON.parse(read('miniprogram/app.json'));

  for (const pagePath of appConfig.pages) {
    for (const extension of ['.js', '.json', '.wxml']) {
      assert.ok(
        fs.existsSync(path.join(miniprogramRoot, `${pagePath}${extension}`)),
        `缺少页面文件：${pagePath}${extension}`,
      );
    }
  }

  for (const tab of appConfig.tabBar.list) {
    for (const iconPath of [tab.iconPath, tab.selectedIconPath]) {
      assert.ok(fs.existsSync(path.join(miniprogramRoot, iconPath)), `缺少 Tab 图标：${iconPath}`);
    }
  }

  for (const functionName of [
    'quickstartFunctions',
    'queryWorkStatus',
    'queryAwardStatus',
    'fetchCatalogIndex',
    'fetchSubmissionsForEvaluation',
    'quickstartFunctions/fetchMuseumContent',
    'quickstartFunctions/manageMuseumContent',
    'quickstartFunctions/manageAdminOperation',
    'quickstartFunctions/fetchAllDeliveries',
  ]) {
    assert.ok(
      fs.existsSync(path.join(cloudfunctionsRoot, functionName, 'index.js')),
      `缺少云函数入口：${functionName}/index.js`,
    );
  }
});

test('聚合云函数的延迟加载处理器均可解析，且不存在失效路由', () => {
  const source = read('cloudfunctions/quickstartFunctions/index.js');
  const modulePaths = [...source.matchAll(/lazyModule\('(.+?)'\)/g)].map((match) => match[1]);

  assert.ok(modulePaths.length > 0, '未找到延迟加载处理器');
  assert.ok(!source.includes("case 'assignVideoNumbers'"), '仍存在无实现的 assignVideoNumbers 路由');

  for (const modulePath of modulePaths) {
    assert.ok(
      fs.existsSync(path.resolve(cloudfunctionsRoot, 'quickstartFunctions', `${modulePath}.js`)),
      `延迟加载处理器不存在：${modulePath}`,
    );
  }
});

test('个人中心和送件详情通过年度云函数读取，不直连旧年度集合', () => {
  const router = read('cloudfunctions/quickstartFunctions/index.js');
  const deliveryFunction = read('cloudfunctions/quickstartFunctions/fetchAllDeliveries/index.js');
  const deliveryPage = read('miniprogram/pages/artwork-delivery/index.js');
  const profilePage = read('miniprogram/pages/profile/index.js');
  assert.ok(router.includes("case 'fetchAllDeliveries'"), '缺少年度送件查询路由');
  assert.ok(deliveryFunction.includes('resolveEdition'), '送件查询必须解析届次');
  assert.ok(deliveryFunction.includes("collectionName(edition, 'deliveries')"), '送件查询必须通过届次集合映射');
  assert.ok(deliveryPage.includes("type: 'fetchAllDeliveries'"), '送件详情页应调用年度云函数');
  assert.ok(profilePage.includes("type: 'fetchAllDeliveries'"), '个人中心送件列表应调用年度云函数');
  assert.ok(profilePage.includes("type: 'fetchAllSubmissions'"), '个人中心报名列表应调用年度云函数');
  assert.ok(!deliveryPage.includes("db.collection('artwork_deliveries')"), '送件详情页不应直连旧集合');
  assert.ok(!profilePage.includes("db.collection('pottery_submissions')"), '个人中心不应直连旧报名集合');
  assert.ok(!profilePage.includes("db.collection('artwork_deliveries')"), '个人中心不应直连旧送件集合');
});

test('测试数据工具默认关闭并使用当前年度查询', () => {
  const testFunction = read('cloudfunctions/quickstartFunctions/uploadTestPotteryData/index.js');
  const testPage = read('miniprogram/pages/pottery-test/index.js');
  assert.ok(testFunction.includes("ENABLE_TEST_DATA !== 'true'"), '测试数据写入必须默认关闭');
  assert.ok(testFunction.includes('resolveEdition'), '测试数据写入必须解析届次');
  assert.ok(testFunction.includes('collectionName(edition, \'submissions\')'), '测试数据不得写入旧固定集合');
  assert.ok(testPage.includes("type: 'fetchAllSubmissions'"), '测试查询应使用年度云函数');
  assert.ok(!testPage.includes("db.collection('pottery_submissions')"), '测试页不应直连旧报名集合');
});

test('自动评估测试路由默认关闭并使用年度评审集合', () => {
  const files = [
    'autoEvaluateInitial',
    'autoEvaluatePartial',
    'autoEvaluateFinal',
    'autoEvaluateFinalAll'
  ];
  for (const name of files) {
    const source = read(`cloudfunctions/quickstartFunctions/${name}/index.js`);
    assert.ok(source.includes("ENABLE_TEST_DATA !== 'true'"), `${name} 必须默认关闭`);
    assert.ok(source.includes('resolveEdition'), `${name} 必须解析届次`);
    assert.ok(source.includes('collectionName'), `${name} 必须使用年度集合映射`);
    assert.ok(!source.includes("db.collection('pottery_submissions_clean')"), `${name} 不应硬编码清洗集合`);
    assert.ok(!source.includes("db.collection('pottery_submissions_for_final')"), `${name} 不应硬编码终评集合`);
  }
});

test('评选阶段和专家进度统计使用年度评审集合', () => {
  const phase = read('cloudfunctions/quickstartFunctions/getEvaluationPhase/index.js');
  const progress = read('cloudfunctions/quickstartFunctions/checkExpertProgress/index.js');
  for (const [name, source] of [['评选阶段', phase], ['专家进度', progress]]) {
    assert.ok(source.includes('resolveEdition'), `${name} 必须解析届次`);
    assert.ok(source.includes('collectionName'), `${name} 必须使用年度集合映射`);
    assert.ok(!source.includes("db.collection('pottery_submissions_clean')"), `${name} 不应硬编码清洗集合`);
    assert.ok(!source.includes("db.collection('pottery_submissions_preliminary')"), `${name} 不应硬编码初评集合`);
  }
});

test('统计与导出路由使用年度集合映射', () => {
  const sources = [
    ['generateRankingResults', read('cloudfunctions/quickstartFunctions/generateRankingResults/index.js')],
    ['exportCleanedSubmissions', read('cloudfunctions/quickstartFunctions/exportCleanedSubmissions/index.js')],
    ['exportPreliminaryResults', read('cloudfunctions/quickstartFunctions/exportPreliminaryResults/index.js')],
    ['exportFinalResults', read('cloudfunctions/quickstartFunctions/exportFinalResults/index.js')]
  ];
  for (const [name, source] of sources) {
    const usesSharedEditionResolver = source.includes('loadExpertResults') || source.includes('exportEvaluation');
    assert.ok(source.includes('resolveEdition') || usesSharedEditionResolver, `${name} 必须解析届次`);
    assert.ok(source.includes('collectionName') || usesSharedEditionResolver, `${name} 必须使用集合映射`);
  }
  const exportFinal = sources.find(item => item[0] === 'exportFinalResults')[1];
  assert.ok(exportFinal.includes('exportEvaluation'), '终评导出应通过统一导出器');
  const sharedExport = read('cloudfunctions/quickstartFunctions/common/evaluationExport.js');
  assert.ok(sharedExport.includes("collectionName(edition, 'finalResults')"));
  assert.ok(!sharedExport.includes('db.collection(event.sourceTable)'), '不得直接使用用户输入的集合名称');
});

test('遗留统计、专家结果和测试数据路由已完成年度化', () => {
  const files = [
    'fetchEvaluationResults',
    'exportEvaluationResults',
    'exportPotterySubmissions',
    'getAdminStats',
    'generateTestData'
  ];
  for (const name of files) {
    const source = read(`cloudfunctions/quickstartFunctions/${name}/index.js`);
    const usesSharedEditionResolver = source.includes('loadExpertResults') || source.includes('exportEvaluation');
    assert.ok(source.includes('resolveEdition') || usesSharedEditionResolver, `${name} 必须解析届次`);
    assert.ok(source.includes('collectionName') || usesSharedEditionResolver, `${name} 必须使用集合映射`);
    if (name === 'generateTestData') {
      assert.ok(source.includes("ENABLE_TEST_DATA !== 'true'"), 'generateTestData 必须默认关闭');
    }
    assert.ok(!source.includes("db.collection('pottery_submissions')"), `${name} 不应硬编码报名集合`);
    assert.ok(!source.includes("db.collection('pottery_submissions_clean')"), `${name} 不应硬编码清洗集合`);
    assert.ok(!source.includes("db.collection('pottery_submissions_for_final')"), `${name} 不应硬编码终评集合`);
  }
});

test('OpenID 请求会复用进行中的请求，失败后允许重试', async () => {
  let appDefinition;
  let callCount = 0;
  const stored = [];
  let mode = 'success';

  const wx = {
    cloud: {
      init() {},
      callFunction({ success, fail }) {
        callCount += 1;
        if (mode === 'failure') {
          fail(new Error('network error'));
          return;
        }
        setImmediate(() => success({ result: { openid: 'openid-test' } }));
      },
    },
    setStorageSync(key, value) {
      stored.push([key, value]);
    },
  };

  vm.runInNewContext(read('miniprogram/app.js'), {
    App(definition) {
      appDefinition = definition;
    },
    console,
    require(modulePath) {
      if (modulePath === './envList.js') {
        return { getCloudEnv: () => 'test-env' };
      }
      throw new Error(`测试未模拟的依赖：${modulePath}`);
    },
    wx,
  }, { filename: 'app.js' });

  const app = {
    ...appDefinition,
    globalData: { ...appDefinition.globalData },
  };
  const firstRequest = app.getOpenid();
  const secondRequest = app.getOpenid();

  assert.strictEqual(firstRequest, secondRequest, '并发请求应复用同一个 Promise');
  assert.equal(await firstRequest, 'openid-test');
  assert.equal(callCount, 1, '并发请求不应重复调用云函数');
  assert.deepEqual(stored, [['openid', 'openid-test']]);
  assert.equal(app.globalData.openid, 'openid-test');

  mode = 'failure';
  await assert.rejects(app.getOpenid(), /network error/);
  mode = 'success';
  await app.getOpenid();
  assert.equal(callCount, 3, '失败请求清理后应允许再次请求');
});

test('当前联调授权下所有版本使用生产环境', () => {
  const source = read('miniprogram/envList.js');

  function resolveEnv(envVersion) {
    const module = { exports: {} };
    vm.runInNewContext(source, {
      module,
      exports: module.exports,
      console,
      wx: {
        getAccountInfoSync() {
          return { miniProgram: { envVersion } };
        },
      },
    }, { filename: 'envList.js' });
    return module.exports.getCloudEnv();
  }

  assert.equal(resolveEnv('develop'), 'jdzyzdmsg-5g4rgrjl2008796f');
  assert.equal(resolveEnv('trial'), 'jdzyzdmsg-5g4rgrjl2008796f');
  assert.equal(resolveEnv('release'), 'jdzyzdmsg-5g4rgrjl2008796f');
});

test('年度解析器提供 2026 当前届映射并拒绝历史届写入', async () => {
  const {
    collectionName,
    generateWorkCode,
    publicEdition,
    resolveEdition,
  } = require('../cloudfunctions/quickstartFunctions/common/edition');

  const currentEdition = await resolveEdition(null, { mode: 'read', useCurrent: true });
  assert.equal(currentEdition.editionId, 'pottery-2026');
  assert.equal(collectionName(currentEdition, 'submissions'), 'pottery_submissions_2026');
  assert.equal(collectionName(currentEdition, 'deliveries'), 'artwork_deliveries_2026');
  assert.equal(publicEdition(currentEdition).readOnly, false);

  const historicalEdition = await resolveEdition(null, { editionId: 'pottery-2025', mode: 'read' });
  assert.equal(collectionName(historicalEdition, 'finalResults'), 'pottery_submissions_final');
  assert.equal(publicEdition(historicalEdition).readOnly, true);

  await assert.rejects(
    resolveEdition(null, { editionId: 'pottery-2025', mode: 'write' }),
    /历史只读届次/,
  );

  const editionSource = read('cloudfunctions/quickstartFunctions/common/edition.js');
  assert.ok(editionSource.includes('连续碰撞'), '作品编号生成应处理并发碰撞');
  assert.ok(editionSource.includes('workCode: candidate'), '作品编号生成应查询候选编号是否已存在');

  const db = {
    RegExp(value) {
      return value;
    },
    collection() {
      return {
        where(query) {
          if (query.workCode && typeof query.workCode === 'object') {
            return { count: async () => ({ total: 0 }) };
          }
          return {
            limit() {
              return { get: async () => ({ data: [] }) };
            },
          };
        },
      };
    },
  };
  const expectedCodes = {
    '传统·匠心传承': 'CT',
    '当代·当代表达': 'DD',
    '数字·数字传媒': 'SZ',
    '产业·产业制造': 'CY',
    '国际·全球视野': 'GJ',
  };
  for (const [category, code] of Object.entries(expectedCodes)) {
    const workCode = await generateWorkCode(db, currentEdition, category);
    assert.match(workCode, new RegExp(`^POT2026-${code}-\\d{6}$`), `${category} 作品编号前缀不正确`);
  }
});

test('报名页提交本届五个新类别，旧类别仅用于编辑回填', () => {
  const submissionLogic = read('miniprogram/pages/pottery-submission/index.js');
  const categories = [
    '传统·匠心传承',
    '当代·当代表达',
    '数字·数字传媒',
    '产业·产业制造',
    '国际·全球视野',
  ];

  for (const category of categories) {
    assert.ok(
      submissionLogic.includes(`value: '${category}', label: '${category}'`),
      `报名页未提交新类别：${category}`,
    );
  }
  assert.ok(submissionLogic.includes('category: getCategoryValue(editSubmission.category)'), '编辑旧记录时应转换为本届类别');
});

test('2026 类别迁移工具同步修改旧类别和旧作品编号并跳过历史届', () => {
  const { migrateDocument } = require('../scripts/migrate-2026-category-export');
  const result = migrateDocument({
    data: [
      { editionId: 'pottery-2026', category: '技艺', workCode: 'POT2026-JY-000123' },
      { editionId: 'pottery-2026', category: '国际·全球视野', workCode: 'POT2026-QT-000456' },
      { editionId: 'pottery-2025', category: '文脉', workCode: 'POT2025-WM-000001' },
    ],
  });

  assert.equal(result.document.data[0].category, '传统·匠心传承');
  assert.equal(result.document.data[0].workCode, 'POT2026-CT-000123');
  assert.equal(result.document.data[1].workCode, 'POT2026-GJ-000456');
  assert.equal(result.document.data[2].category, '文脉');
  assert.equal(result.summary.changed, 2);
  assert.deepEqual(result.summary.duplicateWorkCodes, []);
});

test('年度解析器优先使用云端 exhibition_editions 配置', async () => {
  const { collectionName, resolveEdition } = require('../cloudfunctions/quickstartFunctions/common/edition');

  const db = {
    collection(name) {
      assert.equal(name, 'exhibition_editions');
      return {
        where(query) {
          return {
            limit() {
              return {
                async get() {
                  if (query.isCurrent) {
                    return { data: [] };
                  }
                  if (query.editionId === 'pottery-2026') {
                    return {
                      data: [{
                        editionId: 'pottery-2026',
                        title: '云端第三届配置',
                        collectionMap: {
                          submissions: 'custom_submissions_2026'
                        }
                      }]
                    };
                  }
                  return { data: [] };
                },
              };
            },
          };
        },
      };
    },
  };

  const edition = await resolveEdition(db, { editionId: 'pottery-2026', mode: 'read' });
  assert.equal(edition.title, '云端第三届配置');
  assert.equal(collectionName(edition, 'submissions'), 'custom_submissions_2026');
  assert.equal(collectionName(edition, 'deliveries'), 'artwork_deliveries_2026');
});

test('小程序启动可加载并缓存当前届次配置', async () => {
  let appDefinition;
  let callCount = 0;
  const storage = new Map();

  const wx = {
    cloud: {
      init() {},
      callFunction({ data, success }) {
        callCount += 1;
        assert.equal(data.type, 'getCurrentEdition');
        success({
          result: {
            success: true,
            edition: {
              editionId: 'pottery-2026',
              year: 2026,
              editionNumber: 3,
              title: '第三届测试配置',
              featureFlags: { registration: true }
            }
          }
        });
      },
    },
    getStorageSync(key) {
      return storage.get(key);
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
  };

  vm.runInNewContext(read('miniprogram/app.js'), {
    App(definition) {
      appDefinition = definition;
    },
    console,
    require(modulePath) {
      if (modulePath === './envList.js') {
        return { getCloudEnv: () => 'test-env' };
      }
      throw new Error(`测试未模拟的依赖：${modulePath}`);
    },
    wx,
  }, { filename: 'app.js' });

  const app = {
    ...appDefinition,
    globalData: { ...appDefinition.globalData },
  };

  const edition = await app.loadCurrentEdition();
  assert.equal(edition.title, '第三届测试配置');
  assert.equal(app.globalData.currentEdition.featureFlags.registration, true);

  const cachedEdition = await app.loadCurrentEdition();
  assert.equal(cachedEdition.editionId, 'pottery-2026');
  assert.equal(callCount, 1, '有效缓存期内不应重复请求届次配置');
});

test('长期内容页面保留注册，首页暂停展示空内容入口', () => {
  const appConfig = JSON.parse(read('miniprogram/app.json'));
  for (const pagePath of [
    'pages/museum-collections/index',
    'pages/museum-collection-detail/index',
    'pages/museum-artists/index',
    'pages/museum-artist-detail/index',
    'pages/catalog-links/index',
    'pages/web/index',
  ]) {
    assert.ok(appConfig.pages.includes(pagePath), `未注册页面：${pagePath}`);
  }

  const homePage = read('miniprogram/pages/home/index.wxml');
  assert.ok(!homePage.includes('bindtap="navigateToMuseumResources"'), '未发布正式内容前不应展示馆藏与艺术家入口');

  const webPage = read('miniprogram/pages/web/index.js');
  assert.ok(webPage.includes('ALLOWED_HOSTS'), 'web-view 页面应声明业务域名白名单');
  assert.ok(webPage.includes("parsed.protocol === 'https:'"), 'web-view 页面应限制 HTTPS 链接');
});

test('参展报名在收集个人信息前要求明确同意协议与隐私政策', () => {
  const appConfig = JSON.parse(read('miniprogram/app.json'));
  assert.ok(appConfig.pages.includes('pages/user-service-agreement/index'), '未注册用户服务协议页面');
  assert.ok(appConfig.pages.includes('pages/privacy-policy/index'), '未注册隐私政策页面');

  const submissionPage = read('miniprogram/pages/pottery-submission/index.wxml');
  const submissionLogic = read('miniprogram/pages/pottery-submission/index.js');
  const privacyPolicy = read('miniprogram/pages/privacy-policy/index.wxml');

  assert.ok(submissionPage.includes('wx:if="{{!agreementAccepted}}"'), '报名表应在同意前展示信息收集说明');
  assert.ok(submissionPage.includes('<form wx:else'), '未同意时不应渲染个人信息表单');
  assert.ok(submissionPage.includes('《用户服务协议》'), '报名入口缺少用户服务协议链接');
  assert.ok(submissionPage.includes('《隐私政策》'), '报名入口缺少隐私政策链接');
  assert.ok(submissionLogic.includes('if (!this.data.agreementAccepted)'), '提交前应再次校验用户同意状态');
  assert.ok(privacyPolicy.includes('15907984066'), '隐私政策应提供指定联系电话');
});

test('管理员内容管理入口和服务端校验保持存在', () => {
  const router = read('cloudfunctions/quickstartFunctions/index.js');
  assert.ok(router.includes("case 'manageMuseumContent'"), '聚合云函数缺少内容管理路由');

  const manager = read('cloudfunctions/quickstartFunctions/manageMuseumContent/index.js');
  assert.ok(manager.includes("db.collection('admin')"), '内容管理写操作应服务端校验管理员');
  assert.ok(manager.includes("action === 'previewImport'") || manager.includes("case 'previewImport'"), '内容管理应保留导入预检');
  assert.ok(manager.includes("parsed.protocol === 'https:'"), '电子画册保存应校验 HTTPS URL');

  const adminPage = read('miniprogram/pages/admin-panel/index.wxml');
  assert.ok(adminPage.includes('长期内容管理'), '管理员面板缺少长期内容管理分区');
  assert.ok(adminPage.includes('批量导入预检'), '管理员面板缺少导入预检入口');
});

test('大陶展入口显示届次状态并恢复作品画册', () => {
  const pageJs = read('miniprogram/pages/pottery-exhibition/index.js');
  const pageWxml = read('miniprogram/pages/pottery-exhibition/index.wxml');

  assert.ok(pageJs.includes('loadEditionInfo'), '大陶展页面应加载届次配置');
  assert.ok(pageJs.includes('isFeatureOpen'), '大陶展页面应根据 featureFlags 控制入口');
  assert.ok(pageWxml.includes('作品画册'), '大陶展页面应显示作品画册入口');
  assert.ok(!pageWxml.includes('wx:if="{{false}}"'), '作品画册入口不应继续被硬编码隐藏');
});

test('视频作品上传与百度网盘备用提交规则保持生效', () => {
  const videoRules = read('cloudfunctions/quickstartFunctions/common/video.js');
  assert.ok(videoRules.includes('100 * 1024 * 1024'), '视频大小上限应为 100MB');
  assert.ok(!videoRules.includes('MAX_VIDEO_DURATION_SECONDS'), '视频时长不应设置硬性上限');
  assert.ok(!videoRules.includes('MAX_VIDEO_SHORT_EDGE'), '视频分辨率不应设置短边硬性上限');
  assert.ok(!videoRules.includes('MAX_VIDEO_LONG_EDGE'), '视频分辨率不应设置长边硬性上限');
  assert.ok(!videoRules.includes('视频清晰度最高不超过'), '服务端不应返回分辨率超限提示');
  assert.ok(videoRules.includes('MP4') || videoRules.includes('mp4'), '视频规则应限制 MP4');
  assert.ok(videoRules.includes('validateBaiduCloudBackup'), '服务端应校验百度网盘备用提交');

  const createSubmission = read('cloudfunctions/quickstartFunctions/createPotterySubmission/index.js');
  assert.ok(createSubmission.includes('validateVideoMeta'), '创建报名应使用服务端视频校验');
  assert.ok(createSubmission.includes('validateBaiduCloudBackup'), '创建报名应支持百度网盘备用提交');

  const submissionPage = read('miniprogram/pages/pottery-submission/index.wxml');
  assert.ok(submissionPage.includes('选择 MP4 视频'), '报名页应提供站内 MP4 选择入口');
  assert.ok(submissionPage.includes('不超过 100MB'), '报名页应提示 100MB 限制');
  assert.ok(submissionPage.includes('百度网盘分享链接'), '报名页应提供百度网盘备用入口');

  const { MAX_VIDEO_SIZE_BYTES, validateVideoMeta } = require(path.join(
    cloudfunctionsRoot,
    'quickstartFunctions/common/video.js',
  ));
  const validVideo = {
    fileId: 'cloud://test/video.mp4',
    fileName: 'video.mp4',
    sizeBytes: Math.round(5.5 * 1024 * 1024),
    format: 'mp4',
    durationSeconds: 300,
    width: 1920,
    height: 1080,
    uploadStatus: 'uploaded',
  };
  assert.equal(MAX_VIDEO_SIZE_BYTES, 100 * 1024 * 1024, '服务端视频上限应精确为 100MB');
  assert.equal(validateVideoMeta(validVideo, { required: true }).ok, true, '5.5MB、5分钟视频应通过校验');
  assert.equal(
    validateVideoMeta({ ...validVideo, durationSeconds: 24 * 60 * 60 }, { required: true }).ok,
    true,
    '视频时长不应设置硬性上限',
  );
  assert.equal(
    validateVideoMeta({ ...validVideo, width: 7680, height: 4320 }, { required: true }).ok,
    true,
    '8K 视频应通过校验',
  );
  assert.equal(
    validateVideoMeta({ ...validVideo, width: 0, height: 0 }, { required: true }).ok,
    true,
    '无法读取分辨率时也不应阻止提交',
  );
  assert.equal(
    validateVideoMeta({ ...validVideo, sizeBytes: MAX_VIDEO_SIZE_BYTES }, { required: true }).ok,
    true,
    '恰好 100MB 的视频应通过大小校验',
  );
  assert.equal(
    validateVideoMeta({ ...validVideo, sizeBytes: MAX_VIDEO_SIZE_BYTES + 1 }, { required: true }).errors[0],
    '视频大小不能超过 100MB',
    '超过 100MB 的视频应被拒绝',
  );
});

test('届次控制配置可覆盖入口开关并提供年度化时间', () => {
  const edition = read('cloudfunctions/quickstartFunctions/common/edition.js');
  const timeLimit = read('cloudfunctions/quickstartFunctions/getDeliveryTimeLimit/index.js');

  assert.ok(edition.includes("collection('edition_controls')"), '年度解析器应读取届次控制集合');
  assert.ok(edition.includes('controlsToFeatureFlags'), '年度控制布尔字段应映射为入口开关');
  assert.ok(timeLimit.includes('controls.registrationStartAt'), '报名时间应优先读取届次控制配置');
  assert.ok(timeLimit.includes('controls.deliveryStartAt'), '送件时间应优先读取届次控制配置');
  assert.ok(timeLimit.includes('!hasEditionControls && timeLimit && timeLimit.deliveryBeginTime'), '旧时间配置只能在不存在届次控制记录时兜底');
});

test('常规作品图片按7个指定角度上传并在客户端检测', () => {
  const submissionPage = read('miniprogram/pages/pottery-submission/index.wxml');
  const submissionJs = read('miniprogram/pages/pottery-submission/index.js');
  const submissionWxss = read('miniprogram/pages/pottery-submission/index.wxss');
  const imageFile = require('../miniprogram/utils/image-file');
  const createSubmission = read('cloudfunctions/quickstartFunctions/createPotterySubmission/index.js');

  assert.ok(submissionPage.includes('请按指定角度上传 7 张作品照片'), '页面应明确展示7张图片要求');
  assert.ok(submissionJs.includes('IMAGE_SLOT_DEFINITIONS'), '页面应有固定图片槽位定义');
  assert.equal(imageFile.detectImageFormat(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])), 'jpeg', '应识别真实 JPEG 文件头');
  assert.equal(imageFile.detectImageFormat(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])), 'png', '应识别真实 PNG 文件头');
  assert.equal(imageFile.detectImageFormat(Buffer.from('RIFF0000WEBP')), 'webp', '应识别伪装为 JPG 的 WebP 文件头');
  assert.ok(submissionPage.includes('JPG/JPEG、PNG'), '页面应明确允许 JPG、JPEG 与 PNG 图片');
  assert.ok(submissionPage.includes('建议项，不影响提交'), '页面应区分强制限制和建议尺寸');
  assert.ok(submissionJs.includes("!['jpg', 'jpeg', 'png'].includes(type)"), '正常图片应以微信解码结果允许 JPG、JPEG 与 PNG');
  assert.ok(submissionJs.includes('inspectUnreadableArtworkImage'), '只有微信无法解码图片时才应检查文件头');
  assert.ok(submissionJs.indexOf('wx.getImageInfo') < submissionJs.indexOf('inspectUnreadableArtworkImage'), '正常图片必须先走微信原生解码，不能先被文件头检测误拦截');
  assert.ok(submissionJs.includes('实际编码是 WebP'), 'WebP 伪装为 JPG 时应给出明确提示');
  assert.ok(submissionWxss.includes('aspect-ratio: 1 / 1'), '七个图片窗口应保持 1:1');
  assert.ok(submissionJs.includes('showImageValidationError'), '图片不合格时应走统一确认弹窗');
  assert.ok(submissionJs.includes('showCancel: false'), '图片不合格提示应由用户确认后关闭');
  assert.ok(submissionJs.includes('图片必须为 1:1 正方形'), '客户端应检测图片比例');
  assert.ok(submissionJs.includes('单张图片不能超过 5MB'), '客户端应检测图片大小');
  assert.ok(createSubmission.includes('fourViewImages.length !== 3'), '服务端应校验3张视图图片');
  assert.ok(createSubmission.includes('detailImages.length !== 3'), '服务端应校验3张细节图片');
});

test('专家评分采用数字档位并由服务端计算', () => {
  const rubric = require('../cloudfunctions/common/rubric');
  const quickstartRubric = require('../cloudfunctions/quickstartFunctions/common/rubric');
  const standaloneRubric = require('../cloudfunctions/submitExpertScore/rubric');

  const result = rubric.calculateRubric({
    themeFit: 'A',
    creativity: 'B',
    craftsmanship: 'C',
    aesthetics: 'D'
  }, {
    missingCreativeStatement: true
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.scores, {
    themeFit: 3,
    creativity: 2,
    craftsmanship: 1,
    aesthetics: 0
  });
  assert.equal(result.rawTotalScore, 6);
  assert.equal(result.deductionScore, 1);
  assert.equal(result.finalScore, 5);
  assert.deepEqual(quickstartRubric.calculateRubric(result.scores, {
    missingCreativeStatement: true
  }), result, '聚合云函数内置评分规则必须与源规则一致');
  assert.deepEqual(standaloneRubric.calculateRubric(result.scores, {
    missingCreativeStatement: true
  }), result, '独立评分云函数内置评分规则必须与源规则一致');

  const twoPointGrades = rubric.calculateRubric({
    themeFit: 'D',
    creativity: 'D',
    craftsmanship: 'B',
    aesthetics: 'C'
  }, {
    aiNotLabeled: true,
    missingCreativeStatement: true
  });
  assert.equal(twoPointGrades.scores.craftsmanship, 1.5);
  assert.equal(twoPointGrades.scores.aesthetics, 1);
  assert.equal(twoPointGrades.finalScore, 0, '扣分后最低应为 0 分');

  const incomplete = rubric.calculateRubric({ themeFit: 'A' }, {});
  assert.equal(incomplete.ok, false, '未完整选择四项等级不能通过换算');

  const scoringPageJs = read('miniprogram/pages/expert-scoring/index.js');
  const scoringPageWxml = read('miniprogram/pages/expert-scoring/index.wxml');
  const submitFunction = read('cloudfunctions/submitExpertScore/index.js');
  const submitPackage = JSON.parse(read('cloudfunctions/submitExpertScore/package.json'));
  const submitQuickstart = read('cloudfunctions/quickstartFunctions/submitExpertScore/index.js');

  assert.ok(scoringPageJs.includes('SCORE_OPTIONS'), '评分页应限制数字档位');
  assert.ok(scoringPageJs.includes('onScoreSelect'), '评分页应选择具体分数');
  assert.ok(scoringPageWxml.includes('scoreOptions'), '评分页应渲染数字选项');
  assert.ok(rubric.SCORE_OPTIONS.craftsmanship.includes(1.5), '工艺应允许1.5分');
  assert.ok(submitFunction.includes('calculateRubric'), '提交评分云函数必须服务端换算等级分');
  assert.ok(submitFunction.includes('rubricVersion'), '评分记录应保存评分规则版本');
  assert.ok(submitFunction.includes("require('./rubric')"), '独立评分云函数必须引用部署包内的评分规则');
  assert.ok(submitFunction.includes("require('./edition')"), '独立评分云函数必须引用部署包内的届次路由');
  assert.ok(submitPackage.dependencies['wx-server-sdk'], '独立评分云函数必须声明 wx-server-sdk 运行依赖');
  assert.ok(submitQuickstart.includes("require('../common/rubric')"), '聚合评分处理器必须引用部署包内的评分规则');
});

test('专家评审列表、详情和评分提交使用年度集合路由', () => {
  const expertList = read('cloudfunctions/quickstartFunctions/fetchSubmissionsForEvaluation/index.js');
  const listWrapper = read('cloudfunctions/fetchSubmissionsForEvaluation/index.js');
  const detailFunction = read('cloudfunctions/fetchSubmissionDetail/index.js');
  const detailQuickstart = read('cloudfunctions/quickstartFunctions/fetchSubmissionDetail/index.js');
  const submitFunction = read('cloudfunctions/submitExpertScore/index.js');
  const submitQuickstart = read('cloudfunctions/quickstartFunctions/submitExpertScore/index.js');
  const evaluationPage = read('miniprogram/pages/expert-evaluation/index.js');
  const scoringPage = read('miniprogram/pages/expert-scoring/index.js');

  assert.ok(listWrapper.includes("require('./edition')"), '独立列表云函数必须包含本地部署依赖');
  assert.equal(listWrapper, expertList.replace(/require\('\.\.\/common\//g, "require('./"), '独立与聚合列表实现必须同步');
  assert.ok(evaluationPage.includes('editionId'), '专家列表页面调用应携带 editionId');
  assert.ok(scoringPage.includes('editionId'), '专家评分页面详情和提交应携带 editionId');

  for (const [name, source] of [
    ['专家列表', expertList],
    ['专家详情独立', detailFunction],
    ['专家详情聚合', detailQuickstart],
    ['评分提交独立', submitFunction],
    ['评分提交聚合', submitQuickstart]
  ]) {
    assert.ok(source.includes('resolveEdition'), `${name} 应解析届次`);
    assert.ok(source.includes('collectionName'), `${name} 应通过集合映射取表名`);
    assert.ok(!source.includes("db.collection('pottery_submissions_clean')"), `${name} 不应硬编码旧初评集合`);
    assert.ok(!source.includes("db.collection('pottery_submissions_for_final')"), `${name} 不应硬编码旧终评集合`);
  }

  assert.ok(submitFunction.includes("mode: 'write'"), '独立评分提交应使用写模式解析届次以拒绝历史届');
  assert.ok(submitQuickstart.includes("mode: 'write'"), '聚合评分提交应使用写模式解析届次以拒绝历史届');
  assert.ok(detailFunction.includes('getTempFileURL'), '独立作品详情应为云存储视频生成临时播放地址');
  assert.ok(detailQuickstart.includes('getTempFileURL'), '聚合作品详情应为云存储视频生成临时播放地址');
  assert.ok(detailFunction.includes('playbackVideo.tempUrl'), '独立作品详情应优先返回临时视频地址');
  assert.ok(detailQuickstart.includes('playbackVideo.tempUrl'), '聚合作品详情应优先返回临时视频地址');
});

test('专家评分页面保留图片视频评审布局并使用具体分值', () => {
  const scoringPageJs = read('miniprogram/pages/expert-scoring/index.js');
  const scoringPageWxml = read('miniprogram/pages/expert-scoring/index.wxml');
  const scoringPageWxss = read('miniprogram/pages/expert-scoring/index.wxss');

  assert.ok(scoringPageWxml.includes('视频评审'), '评分页应支持视频评审标题');
  assert.ok(scoringPageWxml.includes('作品评审'), '评分页应支持作品评审标题');
  assert.ok(scoringPageWxml.includes('media-card'), '评分页应包含主媒体展示卡片');
  assert.ok(scoringPageWxml.includes('thumb-strip'), '评分页应包含图片缩略图条');
  assert.ok(scoringPageWxml.includes('播放进度'), '视频显示真实播放位置，不虚构章节或观看完成率');
  assert.ok(scoringPageWxml.includes('提交并下一件'), '评分页应包含提交并下一件按钮');
  assert.ok(scoringPageWxml.includes('暂存'), '评分页应包含暂存按钮');
  assert.ok(scoringPageWxml.includes('scoreOptions'), '评分页使用具体分值');
  assert.ok(scoringPageJs.includes('prepareMediaItems'), '评分页 JS 应生成媒体展示列表');
  assert.ok(scoringPageJs.includes('saveDraft'), '评分页 JS 应支持本地暂存');
  assert.ok(scoringPageJs.includes('onVideoTimeUpdate'), '评分页 JS 应记录视频观看进度');
  assert.ok(scoringPageJs.includes('stopGuideTap'), '评分指南弹层应阻止内容区域冒泡');
  assert.ok(!scoringPageWxml.includes('catchtap=""'), '评分指南不应使用空事件处理器');
  assert.ok(scoringPageWxss.includes('.bottom-bar'), '评分页样式应包含固定底部操作栏');
});

test('专家登录规则弹层不使用空事件处理器', () => {
  const loginPageJs = read('miniprogram/pages/expert-login/index.js');
  const loginPageWxml = read('miniprogram/pages/expert-login/index.wxml');
  assert.ok(loginPageJs.includes('stopRulesTap'), '规则弹层应有内容区域事件处理器');
  assert.ok(!loginPageWxml.includes('catchtap=""'), '规则弹层不应使用空事件处理器');
});

test('管理员危险操作安全流水线具备预检、口令和确认码保护', () => {
  const adminOperation = require('../cloudfunctions/quickstartFunctions/common/adminOperation');
  const router = read('cloudfunctions/quickstartFunctions/index.js');
  const adminPageJs = read('miniprogram/pages/admin-panel/index.js');
  const adminPageWxml = read('miniprogram/pages/admin-panel/index.wxml');
  const adminOperationCloud = read('cloudfunctions/quickstartFunctions/manageAdminOperation/index.js');

  const edition = {
    editionId: 'pottery-2026',
    readOnly: false,
    collectionMap: {
      submissions: 'pottery_submissions_2026',
      cleaned: 'pottery_submissions_clean_2026',
      preliminary: 'pottery_submissions_preliminary_2026',
      finalScoring: 'pottery_submissions_for_final_2026',
      finalResults: 'pottery_submissions_final_2026'
    }
  };

  const preview = adminOperation.buildPreview({
    operationName: 'cleanSubmissionsData',
    edition,
    counts: {
      pottery_submissions_2026: 650,
      pottery_submissions_clean_2026: 20
    },
    environment: 'test-env'
  });

  assert.equal(preview.editionId, 'pottery-2026');
  assert.deepEqual(preview.sourceCollections, ['pottery_submissions_2026']);
  assert.deepEqual(preview.targetCollections, ['pottery_submissions_clean_2026']);
  assert.equal(preview.sourceRecordCount, 650);
  assert.equal(preview.targetRecordCount, 20);
  assert.equal(preview.nextRequiredAction, 'BACKUP');
  assert.ok(preview.warnings.length > 0, '目标集合已有数据时应提示必须备份');

  assert.throws(() => {
    adminOperation.buildPreview({
      operationName: 'cleanSubmissionsData',
      edition: { ...edition, editionId: 'pottery-2025', readOnly: true },
      counts: {}
    });
  }, /历史只读届次/);

  assert.throws(() => adminOperation.assertPassphrase('pottery-2026', 'wrong'), /届次口令错误/);

  const code = adminOperation.createConfirmationCode();
  const hash = adminOperation.hashConfirmationCode(code);
  assert.equal(adminOperation.validateConfirmationCode({
    code,
    expectedHash: hash,
    issuedAt: Date.now()
  }), true);
  assert.equal(adminOperation.validateConfirmationCode({
    code,
    expectedHash: hash,
    issuedAt: Date.now() - adminOperation.CONFIRMATION_TTL_MS - 1
  }), false);

  assert.ok(router.includes("case 'manageAdminOperation'"), '聚合云函数缺少危险操作安全流水线路由');
  assert.ok(router.includes('rejectUnsafeDirectOperation'), '聚合云函数应拒绝危险操作旧路由直连');
  const unsafeTypes = [
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
  ];

  for (const unsafeType of unsafeTypes) {
    assert.ok(router.includes(`case '${unsafeType}'`), `聚合云函数缺少旧危险路由保护分支：${unsafeType}`);
    assert.ok(
      adminOperation.DANGEROUS_OPERATIONS[unsafeType],
      `安全流水线缺少危险操作定义：${unsafeType}`,
    );
  }
  assert.ok(adminPageJs.includes('previewDangerousOperation'), '管理员页缺少危险操作预检方法');
  assert.ok(adminPageJs.includes('backupDangerousOperation'), '管理员页缺少危险操作备份步骤');
  assert.ok(adminPageJs.includes('issueDangerousOperationConfirmation'), '管理员页缺少危险操作确认码步骤');
  assert.ok(adminPageJs.includes('executeDangerousOperation'), '管理员页缺少受保护执行链路');
  assert.ok(adminPageWxml.includes('评审数据操作'), '管理员页缺少危险操作预检区');
  assert.ok(adminPageWxml.includes('会更新当前届次数据'), '管理员页必须明确执行会修改数据');
  assert.ok(adminPageWxml.includes('创建备份清单'), '管理员页缺少备份清单按钮');
  assert.ok(adminPageWxml.includes('生成 10 分钟确认码'), '管理员页缺少确认码按钮');
  assert.ok(adminPageWxml.includes('第四步：确认执行'), '管理员页缺少受保护执行按钮');
  assert.ok(adminOperationCloud.includes("state: OPERATION_STATES.PREVIEWED"), '预检结果必须写入审计状态');
  assert.ok(adminOperationCloud.includes('cloud.uploadFile'), '备份步骤必须导出云存储文件');
  assert.ok(adminOperationCloud.includes('snapshot-'), '备份文件必须支持分片路径');
  assert.ok(adminOperationCloud.includes('未找到预检记录，不能创建备份'), '备份前必须验证预检状态');
  assert.ok(adminOperationCloud.includes('未找到备份记录，不能生成确认码'), '确认码前必须验证备份状态');
  assert.ok(adminPageWxml.includes('startDangerousOperationPreview'), '危险操作按钮应进入安全预检流程');
  assert.ok(!adminPageWxml.includes('bindtap="cleanData"'), '数据清洗按钮不应直连执行函数');
  assert.ok(!adminPageWxml.includes('bindtap="generatePreliminaryTable"'), '生成初评按钮不应直连执行函数');
  assert.ok(!adminPageWxml.includes('bindtap="startFinalEvaluation"'), '开始终评按钮不应直连执行函数');
  assert.ok(!adminPageWxml.includes('bindtap="generateFinalTable"'), '生成终评按钮不应直连执行函数');
});

test('查询和画册优化约束保持生效', () => {
  for (const functionName of ['queryWorkStatus', 'queryAwardStatus']) {
    const source = read(`cloudfunctions/${functionName}/index.js`);
    assert.ok(source.includes('.field({'), `${functionName} 应限制返回字段`);
    assert.ok(source.includes('.limit(100)'), `${functionName} 应支持同一用户多作品查询`);
    assert.ok(source.includes('works'), `${functionName} 应返回 works 数组`);
    assert.ok(source.includes('certificate_records') || source.includes('fetchActiveCertificates'), `${functionName} 应读取证书权威记录`);
  }

  const catalogFunction = read('cloudfunctions/fetchCatalogIndex/index.js');
  assert.ok(catalogFunction.includes('.field({'), '画册索引应限制查询字段');
  assert.ok(!catalogFunction.includes('...item,'), '画册索引不应重复返回原始映射字段');

  const catalogPage = read('miniprogram/pages/pottery-catalog/index.js');
  assert.match(catalogPage, /onUnload\s*:\s*function\s*\(/, '画册页应实现卸载清理');
  assert.match(catalogPage, /clearAllCache\s*\(/, '画册页应清理缓存');
});

test('入围、获奖和证书体系支持多作品与作品编号匹配', () => {
  const certificate = require('../cloudfunctions/common/certificate');
  const queryWorkStatus = read('cloudfunctions/queryWorkStatus/index.js');
  const queryAwardStatus = read('cloudfunctions/queryAwardStatus/index.js');
  const workQueryPage = read('miniprogram/pages/work-query/index.wxml');
  const awardQueryPage = read('miniprogram/pages/award-query/index.wxml');
  const manageCertificates = read('cloudfunctions/quickstartFunctions/manageCertificates/index.js');
  const router = read('cloudfunctions/quickstartFunctions/index.js');

  assert.equal(certificate.parseWorkCodeFromFileName('POT2026-JY-000001-入围证书.png'), 'POT2026-JY-000001');
  assert.equal(certificate.nextCertificateVersion([
    { workCode: 'POT2026-JY-000001', certificateType: 'shortlisted', version: 1 },
    { workCode: 'POT2026-JY-000001', certificateType: 'shortlisted', version: 2 }
  ], 'POT2026-JY-000001', 'shortlisted'), 3);

  const record = certificate.buildCertificateRecord({
    editionId: 'pottery-2026',
    workCode: 'POT2026-JY-000001',
    certificateType: 'award',
    fileId: 'cloud://cert.png',
    fileName: 'POT2026-JY-000001-获奖证书.png',
    existingRecords: [
      {
        certificateId: 'old-cert',
        workCode: 'POT2026-JY-000001',
        certificateType: 'award',
        version: 1,
        status: 'active'
      }
    ],
    createdBy: 'admin'
  });
  assert.equal(record.version, 2);
  assert.equal(record.replacesCertificateId, 'old-cert');
  assert.equal(record.matchMethod, 'workCode');

  assert.ok(queryWorkStatus.includes('editionId'), '入围查询应支持届次参数');
  assert.ok(queryAwardStatus.includes('editionId'), '获奖查询应支持届次参数');
  assert.ok(queryWorkStatus.includes('workCode'), '入围查询应返回作品编号');
  assert.ok(queryAwardStatus.includes('workCode'), '获奖查询应返回作品编号');
  assert.ok(!queryWorkStatus.includes('.limit(1)'), '入围查询不应继续限制单条');
  assert.ok(!queryAwardStatus.includes('.limit(1)'), '获奖查询不应继续限制单条');
  assert.ok(workQueryPage.includes('wx:for="{{works}}"'), '入围结果页应循环展示多件作品');
  assert.ok(awardQueryPage.includes('wx:for="{{works}}"'), '获奖结果页应循环展示多件作品');
  assert.ok(manageCertificates.includes('parseWorkCodeFromFileName'), '证书预检应从文件名解析作品编号');
  assert.ok(manageCertificates.includes('buildCertificateRecord'), '证书预检应构造版本化证书记录');
  assert.ok(manageCertificates.includes("action === 'apply'"), '证书管理应提供受保护批处理入口');
  assert.ok(manageCertificates.includes('assertCertificateSafetyGate'), '证书批处理必须接入安全流水线闸门');
  assert.ok(manageCertificates.includes("operationName !== 'uploadCertificates'"), '证书批处理确认码必须绑定 uploadCertificates 操作');
  assert.ok(manageCertificates.includes("status: 'replaced'"), '替换证书时旧版本应标记为 replaced');
  assert.ok(manageCertificates.includes('certificate_match_logs'), '证书批处理应写入匹配日志');
  assert.ok(manageCertificates.includes('syncLegacyCertificateField'), '证书批处理应兼容同步旧结果字段');
  assert.ok(router.includes("case 'manageCertificates'"), '聚合云函数缺少证书管理路由');
});

test('2026 全链路本地合成数据联调统计闭合', () => {
  const { simulateFullFlow } = require('./helpers/stage8FlowSimulator');
  const result = simulateFullFlow(650);
  const report = result.report;

  assert.equal(report.inputCount, 651, '应包含 650 条合成作品和 1 条重复旧记录');
  assert.ok(report.cleanedCount >= 640, '清洗后应覆盖 640 件以上分支');
  assert.ok(report.duplicateRemoved >= 1, '应识别并移除重复报名');
  assert.ok(report.preliminaryCount >= 480, '初评结果应至少保留普通作品目标量');
  assert.equal(report.finalResultCount, 320, '终评结果应生成 320 件入围结果');
  assert.equal(report.duplicateWorkCodes, 0, '最终结果作品编号必须唯一');
  assert.equal(report.rankContinuity, true, '最终排名必须连续');
  assert.ok(report.videoCount > 0, '合成数据应覆盖视频作品');
  assert.ok(report.finalVideoCount > 0, '最终结果应覆盖视频作品');

  for (const category of ['technique', 'culture', 'algorithm', 'industry', 'vision']) {
    assert.ok(report.categories[category] > 0, `最终结果应覆盖类别：${category}`);
  }

  const shortlistedCertificates = result.certificates.filter(record => record.certificateType === 'shortlisted');
  const awardCertificates = result.certificates.filter(record => record.certificateType === 'award');
  const replacedCandidate = result.certificates.find(record => record.version === 2 && record.replacesCertificateId);

  assert.equal(shortlistedCertificates.length, report.finalResultCount, '每件入围作品应有入围证书记录');
  assert.ok(awardCertificates.length > 0, '获奖作品应有获奖证书记录');
  assert.ok(replacedCandidate, '合成链路应覆盖证书替换版本');
});
