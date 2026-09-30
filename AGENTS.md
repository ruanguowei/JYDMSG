# AGENTS.md instructions

<INSTRUCTIONS>
所有的回答，都要以中文回答
</INSTRUCTIONS>

## Agent Rules

- 在开始任何修改代码或执行任务前，必须先确认需求是否完整
- 如果信息不明确，必须先提出澄清问题，一直提出问题，直到完全清晰为止
- 不允许在未确认需求前直接修改代码或生成大规模改动
- 优先输出 plan，再执行

--- project-doc ---

# Codex 项目上下文

## 基本约定

- 所有回答都用中文。
- 这是微信小程序云开发项目，不是普通 Web / Node 单页应用。
- 读取中文文件时优先按 UTF-8 处理；在 Windows PowerShell 里查看文件请使用 `Get-Content -Encoding UTF8`，否则中文会显示为乱码。
- 仓库可能长期存在未提交改动。后续改代码时只改任务相关文件，不回滚、不整理用户已有改动。

## 项目定位

项目是“景德镇艺术职业大学美术馆”相关微信小程序，核心业务围绕：

- 美术馆首页与参观预约。
- “景德镇国际大陶展”报名、查询、送件、入围查询、获奖查询。
- 专家登录、承诺书、初评/终评评分。
- 管理员数据清洗、生成初评表、生成终评评分表、生成终评结果表和导出。
- 作品画册浏览。
- 证书、图片下载、批量导入、数据修复等辅助工具。

## 目录地图

```text
.
├─ project.config.json              # 微信开发者工具项目配置
├─ miniprogram/                     # 小程序前端根目录
│  ├─ app.js                        # 初始化云环境、获取 openid
│  ├─ app.json                      # 页面注册、tabBar、窗口配置
│  ├─ envList.js                    # 云环境配置，目前强制使用生产环境
│  ├─ pages/                        # 页面
│  ├─ components/                   # 小程序组件
│  ├─ images/                       # 图标等静态图片
│  └─ audio/page-flip.mp3           # 画册翻页音效
├─ cloudfunctions/                  # 云函数根目录
│  ├─ quickstartFunctions/          # 聚合型云函数，靠 event.type 分发
│  ├─ queryWorkStatus/              # 独立云函数：入围查询
│  ├─ queryAwardStatus/             # 独立云函数：获奖查询
│  ├─ fetchCatalogIndex/            # 独立云函数：画册目录
│  ├─ fetchCatalogWorks/            # 独立云函数：画册作品列表
│  ├─ fetchCatalogDetail/           # 独立云函数：画册作品详情
│  └─ 其他数据处理/导出/修复云函数
├─ cloud-image-downloader/          # 云存储图片下载工具
├─ scripts/                         # 本地脚本与导出表生成脚本
├─ outputs/                         # 生成的 Excel/PDF 等输出文件
└─ 其他文件/                         # 测试数据、证书数据、下载图片等资料
```

## 启动与云环境

- `miniprogram/app.js` 调用 `getCloudEnv()` 后执行 `wx.cloud.init({ env, traceUser: true })`。
- `app.js` 启动后调用 `quickstartFunctions` 的 `login` 类型，把 openid 写入本地缓存和 `globalData.openid`。
- `miniprogram/envList.js` 有生产环境和测试环境两个配置，但当前逻辑强制返回生产环境：
  - 生产：`jdzyzdmsg-5g4rgrjl2008796f`
  - 测试：`jdzyzdmsg-test-4gx2v0bw182af653`
- 如果后续要做有风险的测试，先确认是否要切到测试环境。

## 已注册页面

`miniprogram/app.json` 注册了这些页面：

- `pages/home/index`：首页，入口到参观预约和大陶展专区，也拉取首页 banner/公告/预约配置。
- `pages/exhibition/index`：展览页，较旧/较轻的展示页。
- `pages/artwork-detail/index`：作品详情页，代码里有 `getArtworkDetail`、`submitRating` 调用痕迹，偏旧逻辑。
- `pages/appointment/index`：参观预约，提交到 `appointments` 集合。
- `pages/pottery-exhibition/index`：大陶展专区主入口，进入报名、查询、送件、专家评审、画册等。
- `pages/pottery-query/index`：当前用户参展申请查询、详情、删除、跳转编辑。
- `pages/pottery-submission/index`：参展申请/编辑，上传图片或视频信息，调用创建/更新云函数。
- `pages/pottery-test/index`：测试数据工具。
- `pages/submission/index`：旧提交页/占位页。
- `pages/artwork-delivery/index`：送件信息登记、查询、删除。
- `pages/profile/index`：我的，聚合预约、报名、送件等个人记录。
- `pages/reservation/index`：旧预约/保留页。
- `pages/expert-login/index`：专家登录，读取评审时间，校验专家身份。
- `pages/expert-pledge/index`：专家承诺书签署。
- `pages/expert-evaluation/index`：专家待评作品列表，含管理员入口。
- `pages/expert-scoring/index`：作品评分页，提交评分。
- `pages/expert-results/index`：评选结果查看/导出入口。
- `pages/admin-panel/index`：管理员面板，数据清洗、生成结果表、导出。
- `pages/work-query/index`：入围查询，直调 `queryWorkStatus`。
- `pages/pottery-catalog/index`：作品画册，直调画册独立云函数。
- `pages/award-query/index`：获奖查询，直调 `queryAwardStatus`。

`miniprogram/pages` 下还有一些未在 `app.json` 注册的目录，例如 `expert-management`、`expert-test`、`user-center`、`web`，修改前先确认是否仍在使用。

## TabBar

当前 tabBar 只有三个入口：

- 首页：`pages/home/index`
- 大陶展：`pages/pottery-exhibition/index`
- 我的：`pages/profile/index`

## 云函数组织方式

项目有两种云函数调用方式：

1. 聚合型：前端调用 `name: 'quickstartFunctions'`，再通过 `data.type` 分发。
2. 独立型：前端直接调用具体云函数名，例如 `queryWorkStatus`、`queryAwardStatus`、`fetchCatalogIndex`。

`cloudfunctions/quickstartFunctions/index.js` 是主路由文件。新增聚合云函数能力时，需要：

- 在 `quickstartFunctions/index.js` 顶部 `require('./xxx/index')`。
- 在 `switch (event.type)` 里新增 `case 'xxx'`。
- 前端用 `wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type: 'xxx', ... } })` 调用。

注意：有些能力同时存在顶层独立云函数和 `quickstartFunctions/xxx` 子目录，改动前先看前端实际调用的是哪一个。

## 核心数据集合

- `pottery_submissions`：原始报名表，普通用户创建/编辑的参展申请。
- `pottery_submissions_clean`：清洗后的评审表，初评评分写入这里。
- `pottery_submissions_preliminary`：初评结果表，管理员生成，作为进入终评的中间结果。
- `pottery_submissions_for_final`：终评评分表，终评专家评分写入这里。
- `pottery_submissions_final`：终评结果/入围/获奖结果表，入围查询、获奖查询、证书关联主要读这里。
- `appointments`：参观预约记录。
- `artwork_deliveries`：送件信息记录。
- `experts`：专家账号、姓名、类型、承诺书状态。
- `admin`：管理员账号。
- `evaluationLogs`：评分日志。
- `expertLoginLogs`：专家登录日志。
- `evaluation_settings`：评审时间等设置。
- `timeLimit`：报名/送件时间限制。
- `system_settings`：首页和预约配置，例如 `appointment_config`。
- `announcements`、`banners`：首页公告和轮播。
- `pottery_exhibition`：大陶展信息。
- `secondWorks`：作品画册数据源。
- `certificate_files`：证书文件匹配/上传相关集合。

## 普通用户报名流程

1. 用户从 `pages/pottery-exhibition/index` 点击报名。
2. 页面先调用 `quickstartFunctions/getDeliveryTimeLimit` 检查报名时间窗口。
3. 再调用 `quickstartFunctions/fetchAllSubmissions` 判断当前 openid 是否已有申请。
4. 没有申请则进入 `pages/pottery-submission/index`。
5. `pottery-submission` 收集个人信息、作品信息、图片或视频信息。
6. 图片先通过 `wx.cloud.uploadFile` 上传；云函数里会把 `cloud://` 转成临时 HTTPS URL 保存。
7. 新增调用 `quickstartFunctions/createPotterySubmission`，写入 `pottery_submissions`。
8. 编辑调用 `quickstartFunctions/updatePotterySubmission`，会校验 openid 权限和截止时间，修改后状态重置为 `pending`。
9. `pages/pottery-query/index` 通过 `fetchAllSubmissions` 查询当前 openid 的申请，可删除或进入编辑。

重要字段：

- 个人信息：`name`、`gender`、`school`、`schoolProvinces`、`grade`、`birthDate`、`major`、`phone`、`email`、`idNumber`、`teacher`、`teacherPhone`、`address`、`photoUrl`
- 作品信息：`workType`、`artworkName`、`createYear`、`dimensions`、`category`、`craftMaterial`、`artworkDescription`
- 常规作品图片：`perspectiveImage`、`fourViewImages`、`detailImages`、`specialDisplay`
- 视频作品字段：`videoDuration`、`videoResolution`、`videoAspectRatio`、`shootingTechnique`、`baiduCloudLink`、`baiduCloudPassword`

## 送件流程

- 入口主要在 `pages/pottery-exhibition/index` 和 `pages/profile/index`。
- 前端页面是 `pages/artwork-delivery/index`。
- 新增/删除/更新通过 `quickstartFunctions/createArtworkDelivery`、`deleteArtworkDelivery`、`updateArtworkDelivery`。
- 数据表是 `artwork_deliveries`。

## 专家评审流程

1. 专家从 `pages/expert-login/index` 输入姓名和验证码。
2. `quickstartFunctions/expertLogin` 在 `experts` 表校验 `expertCode`、`expertName`、`status: 'active'`。
3. 登录成功后本地缓存 `expertInfo`，并写入一次性 `expertLoginTicket`。
4. `quickstartFunctions/checkPledge` 检查承诺书；未签署跳到 `pages/expert-pledge/index`。
5. `quickstartFunctions/signPledge` 更新专家签署状态。
6. `pages/expert-evaluation/index` 拉取待评作品：
   - 当前页面直接调用独立云函数 `fetchSubmissionsForEvaluation`。
   - `quickstartFunctions` 里也有同名子函数，注意别改错。
7. 初评专家通常读 `pottery_submissions_clean`。
8. 终评专家通常读 `pottery_submissions_for_final`。
9. `pages/expert-scoring/index` 获取详情并提交评分：
   - 当前页面直接调用独立云函数 `fetchSubmissionDetail` 和 `submitExpertScore`。
   - 评分统一写入作品的 `evaluations` 数组。
10. 评分维度是 `themeFit`、`creativity`、`craftsmanship`、`aesthetics`，总分一般为 10 分制。

专家类型：

- `experts.expertType === 'preliminary'`：初评。
- `experts.expertType === 'final'`：终评。

## 管理员与评审数据流

管理员入口在专家评审页或结果页触发，登录后进入 `pages/admin-panel/index`。

典型处理顺序：

1. `cleanSubmissionsData`：从 `pottery_submissions` 去重清洗到 `pottery_submissions_clean`。这是危险操作，会清空清洗表并导致已有初评评分丢失。
2. 初评专家评分：写入 `pottery_submissions_clean.evaluations`。
3. `generatePreliminaryTable`：从清洗表按类别、分数、地域保护等规则生成 `pottery_submissions_preliminary`。
4. `startFinalEvaluation`：从初评结果表复制到 `pottery_submissions_for_final`，作为终评评分表。
5. 终评专家评分：写入 `pottery_submissions_for_final.evaluations`。
6. `generateFinalRanking`：从终评评分表生成 `pottery_submissions_final`。
7. `exportCleanedSubmissions`、`exportPreliminaryResults`、`exportFinalResults`：导出 CSV 到云存储。

几个危险操作会清空目标表，后续运行前必须确认：

- `cleanSubmissionsData`
- `generatePreliminaryTable`
- `startFinalEvaluation`
- `generateFinalRanking`
- `copyFullTable`
- `copyWorksToFinal`
- `replaceQualifiedWorks`
- `removeDuplicates`
- `updateAwardStatus`
- `uploadCertificates`

## 入围与获奖查询

- `pages/work-query/index` 直调独立云函数 `queryWorkStatus`。
- `queryWorkStatus` 用 `phone + name` 查询 `pottery_submissions_final`。
- 查到记录表示已入围，返回 `shortlistedCertificate`。
- `pages/award-query/index` 直调独立云函数 `queryAwardStatus`。
- `queryAwardStatus` 同样查询 `pottery_submissions_final`，用 `status` 判断是否获奖。
- 当前获奖状态列表：`卓越创作奖`、`新锐突破奖`、`优秀潜力奖`。
- 获奖证书字段是 `awardCertificate`。

## 作品画册

- 前端：`pages/pottery-catalog/index`。
- 数据源：`secondWorks`。
- 独立云函数：
  - `fetchCatalogIndex`
  - `fetchCatalogWorks`
  - `fetchCatalogDetail`
- 画册页有滑动窗口缓存、翻页动画、翻页音效和图片预览逻辑，改动时注意内存释放：
  - `clearAllCache`
  - `releaseMemory`
  - `releasePreviewImage`
  - 音频对象 `flipSound.destroy()`

## 类别与阶段规则

作品类别在代码里同时出现中文和英文，需要兼容：

- 技艺：`technique`、`技艺`、`技艺类`
- 文脉：`culture`、`文脉`、`文脉类`
- 算法：`algorithm`、`算法`、`算法类`
- 产业：`industry`、`产业`、`产业类`
- 视界：`vision`、`视界`、`视界类`

`getEvaluationPhase` 的阶段判断：

- 少于 320 件：取消评选，所有作品直接入围。
- 320 到 639 件：直接终评。
- 640 件及以上：初评 + 终评。
- 初评目标大致是普通作品 480 件进入终评。
- 终评目标大致是普通作品 300 件，加港澳台等规则形成最终入围结果。

实际名额和地域保护逻辑以 `generatePreliminaryTable`、`generateFinalRanking` 内的当前代码为准。

## 常见修改入口

- 改首页/公告/预约展示：先看 `miniprogram/pages/home/index.*` 和 `quickstartFunctions/fetchHomeData`。
- 改报名表字段：同时看 `pages/pottery-submission/index.*`、`createPotterySubmission`、`updatePotterySubmission`、`fetchAllSubmissions`、导出函数。
- 改报名时间限制：看 `quickstartFunctions/getDeliveryTimeLimit`、`timeLimit` 集合，以及 `pottery-exhibition`、`pottery-query`、`profile` 的相关校验。
- 改专家登录：看 `pages/expert-login/index.*`、`quickstartFunctions/expertLogin`、`checkPledge`、`signPledge`。
- 改评分逻辑：看 `pages/expert-scoring/index.*`、`fetchSubmissionDetail`、`submitExpertScore`。
- 改评审列表：看 `pages/expert-evaluation/index.*`、独立云函数 `fetchSubmissionsForEvaluation`。
- 改管理员生成结果：看 `pages/admin-panel/index.*`、`generatePreliminaryTable`、`startFinalEvaluation`、`generateFinalRanking`。
- 改入围/获奖查询：看 `pages/work-query`、`cloudfunctions/queryWorkStatus`、`pages/award-query`、`cloudfunctions/queryAwardStatus`。
- 改画册：看 `pages/pottery-catalog/index.*` 和 `fetchCatalogIndex`、`fetchCatalogWorks`、`fetchCatalogDetail`。
- 改证书：看 `cloudfunctions/uploadCertificates`、`cloudfunctions/updateAwardStatus`、`其他文件/` 下的证书 JSON/扫描资料。

## 本地工具、CloudBase 与发布流程

### 工具职责与边界

- `wx` / `wx.cloud`：小程序运行时 API，只能在小程序代码中调用；不是终端命令。
- CloudBase MCP：供 AI IDE 管理 CloudBase 云端资源（环境、数据库、云函数、云存储等）。读取、检查可以直接进行；部署、写库、清表、批量更新等生产操作必须先说明影响并取得确认。
- CloudBase 开发 Skills：供 AI 选择正确开发流程和安全规则，不是部署工具。涉及小程序、云函数、数据库或 CloudBase 资源时，先读取对应 Skill 再行动。
- `tcb`：CloudBase CLI，适合开发者或 CI 以终端方式管理同一套 CloudBase 资源；与 MCP 功能有重叠，按当前任务任选其一，避免对同一资源重复执行写操作。
- 微信开发者工具 CLI：用于启动、编译、预览等开发者工具自动化，终端命令为 `cli`。
- `miniprogram-ci`：Node.js 自动化构建/预览/上传工具；本项目通过 npm 脚本调用，不要求全局安装。

### 本机已配置路径与密钥变量

- `tcb` 全局命令目录已加入用户 `PATH`：`C:\Users\Ruan\AppData\Roaming\npm`。
- 微信开发者工具 CLI 已加入用户 `PATH`：`C:\Program Files (x86)\Tencent\微信web开发者工具`，入口文件为 `cli.bat`。
- 小程序上传私钥不加入 `PATH`。用户环境变量 `MINIPROGRAM_PRIVATE_KEY_PATH` 指向：`C:\Users\Ruan\WeChatProjects\miniprogram-upload.key`。
- 私钥位于当前仓库外；不得复制进仓库、写入脚本、日志或提交至 Git。
- 如 PATH 或用户环境变量刚改过，需重启终端后再执行命令。可用 `tcb --version`、`cli --help` 检查命令可用性。

### CloudBase CLI 操作规则

1. 任何 CloudBase 写操作前，先让用户明确确认目标 `envId`；本项目默认生产环境是 `jdzyzdmsg-5g4rgrjl2008796f`，不可因默认值而跳过确认。
2. 首次使用某个 `tcb` 子命令，先运行对应的 `--help`；不确定参数时用 `tcb docs` 查询，不凭记忆猜命令。
3. 部署、覆盖、删除、清空、批量更新等操作，先执行 `--dry-run`（若该命令支持），展示影响范围并等待用户明确确认后再执行。
4. 认证使用交互式 `tcb login`；不要把腾讯云 SecretId、SecretKey 或其他凭证写入项目文件、命令历史或代码。
5. 云函数、数据库和存储的最终改动必须做对应的只读核验，并向用户说明结果。

### 小程序预览与上传

项目已在 `package.json` 配置以下脚本，具体实现见 `scripts/miniprogram-ci.js`：

```powershell
npm run ci:preview  # 生成预览二维码，不上传版本
npm run ci:upload   # 上传小程序版本，属于外部发布操作
```

- 脚本读取 `MINIPROGRAM_PRIVATE_KEY_PATH`、可选的 `MINIPROGRAM_APPID` 和 `MINIPROGRAM_CI_DESC`。
- **未经用户在当前任务中明确授权，严禁执行任何会将代码上传到微信平台的操作**，包括 `npm run ci:upload`、微信开发者工具中的上传操作，以及上传体验版、开发版或正式版。即使代码已通过本地验证，也必须先取得授权。
- 执行 `ci:upload` 前，必须先确认当前代码、目标小程序 AppID、版本说明和上传授权；不得将“上传成功”误当作已提交审核或已发布。
- `ci:preview` 会在项目 `.ci/` 下生成预览二维码；检查二维码生成结果即可，不触发小程序版本上传。

## 后续协作提醒

- 先确认前端调用的是聚合云函数还是独立云函数。
- 评审/排名/证书相关云函数大多会改数据库，不能随手执行。
- 小程序没有常规单元测试配置，验证通常依赖微信开发者工具、云函数日志、页面手动流程。
- 如果只是阅读或改静态逻辑，可以用 `rg` 快速找调用关系；如果要跑会访问云环境的脚本，先确认环境和风险。
