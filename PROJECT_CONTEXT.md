# 景德镇艺术职业大学美术馆小程序 2026 升级项目交接文档

> 最后更新：2026-07-12  
> 工作区：`C:\Users\Ruan\WeChatProjects\miniprogram-4`  
> 当前状态：本地代码已完成阶段 9 最新回归；阶段 10/11 已建立检查与运营文档。测试云环境、微信开发者工具、真机和生产上线尚未完成。  
> 2026-07-22 已在生产环境创建长期内容与运维用空集合；未写入业务记录、未修改既有索引或权限、未部署云函数、未上传或发布小程序。

## 1. 项目目标与边界

本项目是“景德镇艺术职业大学美术馆”微信小程序。2026 年升级不是重做系统，而是在保持报名、送件、专家评审、结果查询、画册等旧流程兼容的前提下，增加年度隔离和长期内容能力。

本次升级的核心目标：

- 保留 2025 年第二届历史数据和文件，不迁移、不清空、不覆盖。
- 2026 年第三届使用独立集合和存储目录。
- 普通用户仍可查询第二届入围、获奖、证书和画册。
- 增加馆藏作品库、艺术家档案和云展网电子画册配置。
- 支持小程序内上传 MP4，限制为 `50 × 1024 × 1024` 字节，并支持用户、专家和管理员预览。
- 专家评分改为 A/B/C/D 等级制，同时保存等级、换算分、扣分和最终分。
- 管理员危险操作必须经过“预检 → 备份 → 口令 → 一次性确认码 → 二次确认 → 执行 → 审计”。
- 入围、获奖和证书查询支持同一参赛者多件作品；证书以作品编号匹配并保留替换历史。
- 所有真实功能先在测试环境验证，生产清洗、排名、证书批处理和删除必须另行明确授权。

已确定的届次标识：

- 2025 第二届：`pottery-2025`，只读历史届。
- 2026 第三届：`pottery-2026`，当前届。

## 2. 技术栈

### 2.1 小程序端

- 微信原生小程序：JavaScript、WXML、WXSS、JSON。
- 小程序基础库：`2.33.1`。
- AppID：`wx7c60c191a0841a09`。
- 小程序源码目录：`miniprogram/`。
- 云能力调用：`wx.cloud.init`、`wx.cloud.callFunction`、`wx.cloud.uploadFile`、临时文件 URL。
- 用户身份：微信云开发天然登录，服务端以 `cloud.getWXContext().OPENID` 为可信用户标识；不要引入 Web 登录模型。

### 2.2 云端

- 腾讯云开发 / 微信云开发 CloudBase。
- 云函数运行时：Node.js + `wx-server-sdk`。
- 数据库：CloudBase 旧版 NoSQL 文档数据库，不是 PostgreSQL。
- 存储：CloudBase 云存储。
- 两种云函数形态：
  - 聚合云函数 `quickstartFunctions`，通过 `event.type` 分发。
  - 独立云函数，例如 `queryWorkStatus`、`queryAwardStatus`、`fetchSubmissionDetail`、`submitExpertScore`。

### 2.3 本地工具和测试

- Node.js 内置测试运行器：`node --test`。
- `miniprogram-ci`：预览/上传脚本已配置，但尚未执行发布。
- PowerShell / `rg` / Git。
- 本地测试命令：

```text
npm run test:smoke
npm run test:static
npm run test:unit
npm run test:integration:local
npm run test:structure
npm run test:handlers
npm run test:wxml
npm run check:upgrade-readiness
```

## 3. 项目目录结构

```text
.
├─ PROJECT_CONTEXT.md                 # 本交接文档
├─ AGENTS.md                          # 项目协作规则和历史业务说明
├─ project.config.json                # 微信开发者工具配置
├─ project.private.config.json        # 本地开发者工具私有配置，已有用户改动
├─ package.json                       # 本地测试及 miniprogram-ci 命令
├─ miniprogram/
│  ├─ app.js                          # 云环境初始化、openid、当前届配置缓存
│  ├─ app.json                        # 页面注册、窗口、TabBar
│  ├─ envList.js                      # develop/trial/test 与 release/prod 映射
│  ├─ pages/                          # 小程序页面
│  ├─ components/                     # 公共组件
│  ├─ images/                         # 图标及静态图片
│  └─ audio/                          # 画册翻页音效
├─ cloudfunctions/
│  ├─ common/                         # 独立云函数共享：评分、证书等
│  ├─ quickstartFunctions/
│  │  ├─ index.js                     # 聚合路由入口
│  │  ├─ common/                      # 届次、视频、管理员操作公共逻辑
│  │  └─ */index.js                   # 各 event.type 实现
│  ├─ fetchSubmissionDetail/          # 专家作品详情独立云函数
│  ├─ fetchSubmissionsForEvaluation/  # 专家列表独立入口/转发
│  ├─ submitExpertScore/              # 评分独立云函数
│  ├─ queryWorkStatus/                # 入围多作品查询
│  ├─ queryAwardStatus/               # 获奖多作品查询
│  ├─ fetchCatalogIndex/              # 历史作品画册目录
│  ├─ fetchCatalogWorks/              # 历史作品画册列表
│  ├─ fetchCatalogDetail/             # 历史作品画册详情
│  └─ 其他历史数据处理云函数/
├─ scripts/
│  ├─ check-miniprogram-structure.js  # 页面和 TabBar 资源检查
│  ├─ check-wxml-handlers.js          # WXML 事件处理器检查
│  ├─ check-wxml-syntax.js            # WXML 标签结构检查
│  ├─ upgrade-readiness-check.js      # 升级就绪检查
│  └─ miniprogram-ci.js               # 预览/上传入口
├─ tests/
│  ├─ miniprogram-smoke.test.js       # 静态、单元、本地集成和冒烟测试
│  └─ helpers/stage8FlowSimulator.js  # 650+ 合成作品全链路模拟器
├─ specs/
│  ├─ 2026-upgrade-stage-0/ ... stage-11/
│  └─ performance-memory-optimization/
├─ outputs/                           # Excel/PDF/导出结果，勿随意清理
├─ cloud-image-downloader/            # 历史图片下载工具及资料
└─ 其他文件/                          # 历史证书、JSON、扫描和导入资料
```

## 4. 页面和入口

`miniprogram/app.json` 当前注册 27 个页面。主要页面：

- `pages/home/index`：首页、预约入口、馆藏/艺术家/电子画册入口。
- `pages/pottery-exhibition/index`：大陶展主入口、届次和功能开关展示。
- `pages/pottery-submission/index`：报名、编辑、图片和视频上传。
- `pages/pottery-query/index`：当前用户报名查询。
- `pages/artwork-delivery/index`：作品送件登记和查询。
- `pages/profile/index`：我的预约、报名、送件。
- `pages/expert-login/index`：专家登录。
- `pages/expert-pledge/index`：专家承诺书。
- `pages/expert-evaluation/index`：专家待评作品列表。
- `pages/expert-scoring/index`：重新设计后的图片/视频评审和 A/B/C/D 评分页。
- `pages/admin-panel/index`：管理员内容管理和危险操作安全流水线。
- `pages/work-query/index`：入围多作品查询。
- `pages/award-query/index`：获奖多作品查询。
- `pages/pottery-catalog/index`：历史作品画册。
- `pages/museum-collections/index`、`museum-collection-detail`：馆藏。
- `pages/museum-artists/index`、`museum-artist-detail`：艺术家。
- `pages/catalog-links/index`、`pages/web/index`：电子画册和云展网 web-view。

TabBar 保持三项：首页、大陶展、我的。图标仍使用 `miniprogram/images/icons/` 中的本地资源。

## 5. 云环境和生产数据基线

### 5.1 环境映射

`miniprogram/envList.js` 当前规则：

- `develop` → 测试环境 `jdzyzdmsg-test-4gx2v0bw182af653`
- `trial` → 测试环境 `jdzyzdmsg-test-4gx2v0bw182af653`
- `release` → 生产环境 `jdzyzdmsg-5g4rgrjl2008796f`
- 无法识别版本时默认测试环境，禁止回退生产。

当前 CloudBase 账号只看得到生产环境。测试环境 ID 不存在或当前账号无权限。因此开发版会正确尝试连接测试环境，但云函数连通会失败。不能为了测试而改回生产环境。

### 5.2 2026-07-12 生产环境只读盘点

生产环境：`jdzyzdmsg-5g4rgrjl2008796f`，区域 `ap-shanghai`，状态 `NORMAL`。

历史核心集合：

| 集合 | 条数 | 说明 |
|---|---:|---|
| `pottery_submissions` | 0 | 原始报名表为空，不能据此推断历史数据被删 |
| `pottery_submissions_clean` | 1274 | 第二届清洗/评审数据 |
| `pottery_submissions_preliminary` | 549 | 第二届初评结果 |
| `pottery_submissions_for_final` | 549 | 第二届终评评分表 |
| `pottery_submissions_final` | 320 | 第二届最终结果 |
| `artwork_deliveries` | 225 | 第二届送件 |
| `secondWorks` | 334 | 第二届画册 |

其他集合包括 `appointments` 1140、`expertLoginLogs` 565、`experts` 12、`admin` 1 等。

存储只读盘点：

- 根目录约 364 个文件/目录条目。
- `admin_exports/` 有 11 个 2025 导出文件。
- `第二届入围视频作品/` 有 11 个 MP4，最大约 95.8MB；旧视频不受 2026 的 50MB 新规则影响。
- 生产云存储 ACL 查询为 `READONLY`。
- `pottery_submissions_final` 权限为 `READONLY`。

详细证据见 `specs/2026-upgrade-stage-0/production-readonly-inventory-2026-07-12.md`。

## 6. 已确定的架构设计

### 6.1 四层结构

1. 长期内容层：馆藏、艺术家、电子画册，不依附活动届次。
2. 届次配置层：当前届、历史届、集合映射、功能开关、只读状态。
3. 本届业务层：2026 报名、清洗、初评、终评、结果、送件和画册独立集合。
4. 运维安全层：操作日志、备份、证书、匹配日志和批量导入记录。

### 6.2 年度集合映射

2026 计划集合：

```text
pottery_submissions_2026
pottery_submissions_clean_2026
pottery_submissions_preliminary_2026
pottery_submissions_for_final_2026
pottery_submissions_final_2026
artwork_deliveries_2026
secondWorks_2026
```

长期和运维集合：

```text
exhibition_editions
edition_settings
museum_artists
museum_collections
catalog_links
content_import_jobs
operation_logs
data_backups
certificate_records
certificate_match_logs
admin_import_jobs
```

2026 七个年度业务集合、`exhibition_editions` 和 `edition_settings` 已存在于生产环境，均为空。2026-07-22 已补建以下长期内容与运维空集合：

```text
museum_artists
museum_collections
catalog_links
content_import_jobs
operation_logs
data_backups
certificate_records
certificate_match_logs
admin_import_jobs
```

上述新建集合仅含 CloudBase 默认 `_id`、`_openid` 索引，尚未写入业务记录；2026 届次仍为 `preparing`，功能开关均关闭。

### 6.3 年度解析器

核心文件：`cloudfunctions/quickstartFunctions/common/edition.js`。

- `resolveEdition(editionId, { mode })` 从受信任配置解析届次。
- 内置 `pottery-2025` 和 `pottery-2026` 兜底配置。
- 优先读取 `exhibition_editions` 云端配置。
- `collectionName(edition, key)` 返回可信集合映射。
- 写操作对 `readOnly: true` 的历史届直接拒绝。
- 前端不能传任意集合名。
- 旧请求未传 `editionId` 时，写操作默认当前届；往届查询需要显式届次。

### 6.4 数据统一字段

2026 业务记录固定写入：

```js
{
  editionId: 'pottery-2026',
  schemaVersion: 2,
  workCode: 'POT2026-类别代码-六位序号',
  createdAt: ..., 
  updatedAt: ...
}
```

作品编号由服务端生成，一旦生成不可修改，贯穿报名、评审、送件、结果、画册、证书和导出。当前生成器包含冲突检查和随机回退，但不是数据库级原子序列，后续高并发上线前仍需评估唯一索引与冲突重试。

## 7. 当前已经完成的修改

### 7.1 阶段 0：基线和环境隔离

- 完成生产数据库和存储只读盘点。
- 开发版/体验版切到测试环境，正式版才使用生产。
- 管理员页面显示环境标签、版本和环境 ID。
- 建立第二届冻结规则：不移动、不改名、不清空、不批量更新、不删除关联文件。
- 开发者工具曾完成首页、WXML/WXSS 基础编译；测试云函数连通仍阻塞。

### 7.2 阶段 1：年度路由和业务隔离

- 新增年度解析器和 `getCurrentEdition`。
- `app.js` 启动加载当前届，缓存 5 分钟；失败时保留 2026 兜底，但写入仍由服务端校验。
- 报名新增/查询/编辑/删除改用年度集合。
- 送件新增/查询/编辑/删除改用年度集合。
- 新增 `fetchAllDeliveries`，个人中心和送件详情不再直连旧年度集合。
- 专家列表、详情和评分改用 `cleaned` / `finalScoring` 年度映射。
- 统计和导出路由已开始年度化，包括评审阶段、专家进度、清洗表导出、初评导出、终评导出和排名统计。
- 测试数据上传默认关闭，只有 `ENABLE_TEST_DATA === 'true'` 才允许。

### 7.3 阶段 2–3：长期内容和全局入口

- 新增 `fetchMuseumContent`、`manageMuseumContent`。
- 完成馆藏列表/详情、艺术家列表/详情、电子画册列表和 web-view。
- 支持内容单条新增、编辑、上下架、排序和 JSON 批量导入预检。
- 艺术家通过稳定 `artistId` 关联馆藏，姓名只用于显示。
- 首页增加馆藏、艺术家和电子画册入口。
- 大陶展页显示当前届、状态和功能开关；恢复作品画册入口。
- `pages/web/index.js` 限制 HTTPS 和允许的云展网域名。

### 7.4 阶段 4：站内视频

- 新增视频标准化和服务端校验工具。
- 报名页支持选择 MP4、大小校验、预览、上传进度、失败重试和元数据保存。
- 2026 限制为不超过 50MB，边界按字节判断。
- 上传目录为 `exhibitions/pottery-2026/submissions/{workCode}/video/`。
- `confirmSubmissionVideo` 校验作品所有权、路径、文件存在性、格式和大小。
- 新版 `video` 字段与旧百度网盘字段并存，第二届旧数据只读兼容。
- 专家详情云函数为 `cloud://` 视频生成临时播放地址，不把临时 URL 永久写入数据库。

### 7.5 阶段 5：A/B/C/D 评分与页面重设计

- 评分页已参考用户提供的图片/视频评审稿重新设计媒体区、缩略图、视频分段、评分卡和底部操作区。
- 业务规则仍使用已经确认的 A/B/C/D 等级制，不使用设计稿中的自由 1–10 滑杆。
- 服务端映射：

| 维度 | A | B | C | D |
|---|---:|---:|---:|---:|
| 主题契合度 | 3 | 2 | 1 | 0 |
| 创意与表现力 | 3 | 2 | 1 | 0 |
| 工艺与材料 | 2 | 1 | 1 | 0 |
| 美感与实用性 | 2 | 1 | 1 | 0 |

- 保存 `rubricVersion`、`gradeScores`、换算后的 `scores`、`rawTotalScore`、扣分、`finalScore` 和取消资格状态。
- 服务端重新换算，前端总分不可作为可信数据。
- 默认四项都未选择，必须完整选择才能提交。
- 保留 AI 未标注扣 2 分、缺少说明扣 1 分和取消资格机制。
- 同一专家/作品/阶段只有一条有效评分，重复请求幂等。
- 第二届旧数字评分不反推等级，显示为旧版数字评分。

### 7.6 阶段 6：管理员安全流水线

- 新增 `common/adminOperation.js`、`manageAdminOperation` 和管理员页面安全操作 UI。
- 状态机：`DRAFT → PREVIEWED → BACKED_UP → CONFIRMED → RUNNING → SUCCEEDED/FAILED`。
- 预检返回源/目标集合、条数和影响摘要。
- 备份以 4MB 分片上传到 `backups/{editionId}/{operationId}/`，记录 SHA-256、文件 ID、条数和恢复说明。
- 确认必须输入届次口令 `pottery-2026` 和服务端生成的 10 分钟一次性确认码。
- `operationId` 作为幂等键，运行中和已完成操作拒绝重复执行。
- 聚合路由日志只记录安全摘要，不输出完整姓名、手机号、证件号或文件路径。
- 旧危险路由已禁止直接调用，包括清洗、生成初评、开始终评、终评排名、清表、全表清空、数据修复和存储删除。
- 重要：真实清洗/排名/重建适配器尚未开放；安全执行器目前会保护性失败，避免误操作。

### 7.7 阶段 7：多作品结果与证书

- `queryWorkStatus`、`queryAwardStatus` 不再 `.limit(1)`，统一返回 `works` 数组。
- 查询条件仍为姓名、手机号、届次，但返回该用户全部作品。
- 证书权威集合为 `certificate_records`，以 `workCode` 主匹配。
- 支持入围证书、获奖证书、版本递增、旧证书 `replaced` 状态和替换关系。
- `certificate_match_logs` 保存匹配、创建、替换和异常信息。
- `manageCertificates` 支持预检和受保护应用；真实批处理必须通过 `uploadCertificates` 安全流水线。
- 第二届继续读取 `shortlistedCertificate` 和 `awardCertificate` 旧字段，不强制迁移。

### 7.8 阶段 8：本地全链路模拟

- 使用 650 件以上合成作品覆盖 640+ 初评/终评分支。
- 覆盖五类作品、地域规则、视频、多作品、重复记录、扣分、取消资格、证书缺失和证书替换。
- 模拟清洗、初评、终评、最终 320 件结果、排名连续性和证书生成。
- 发现同一人多件作品不能按姓名/学校/证件号去重，真实清洗必须以 `workCode` 为主键。

### 7.9 阶段 9：自动化测试

- 建立页面结构、TabBar 资源、WXML 事件处理器和标签结构检查。
- 建立年度路由、视频、评分、安全流水线、证书和 650+ 全链路测试。
- 最近一次完整成功矩阵曾达到冒烟测试 23/23；随后补充测试后阶段报告记录为 24/24。
- 注意：年度导出/统计及自动评估路由的最新修改发生在最后一次完整 Node 测试之后，受本机 Node `EPERM lstat C:\Users\Ruan` 和工具使用额度影响，最新全矩阵尚未重新验证。后续必须重新运行全部 npm 测试，不应只引用旧报告。

## 8. 当前正在进行的任务

当前主线是测试环境恢复与云端端到端验收，不是生产上线。年度路由收口和阶段 9 最新回归已于 2026-07-22 完成。

正在进行/最近完成但待验证的改动：

- 年度化 `exportCleanedSubmissions`、`exportPreliminaryResults`、`exportFinalResults`、`generateRankingResults`、`getEvaluationPhase`、`checkExpertProgress` 已完成。
- `getVideoWorksList` 与 `createTestVideoWorks` 已使用年度解析；测试数据入口由 `ENABLE_TEST_DATA === 'true'` 保护。
- 2026-07-22 已完成语法检查及完整本地测试矩阵：冒烟测试 27/27 通过，静态、单元、本地集成、结构、WXML 和升级就绪检查均通过。

下一位 Codex 应优先恢复测试环境并完成真实云端联调，不应在功能开关关闭期间写入 2026 业务数据。

## 9. 重要业务逻辑

### 9.1 报名

1. 从大陶展页检查报名功能开关和时间窗口。
2. 前端调用 `fetchAllSubmissions` 查询当前 OPENID 和届次的记录。
3. 创建时服务端生成 `workCode`，写入 2026 集合。
4. 编辑时校验 OPENID、届次、截止时间；更新后业务状态按旧规则重置。
5. 前端不得指定集合名，不得写历史届。

### 9.2 送件

- 所有送件 CRUD 通过 `deliveries` 年度映射。
- `fetchAllDeliveries` 以 OPENID 限定用户数据。
- 往届页面只读，不展示编辑和送件操作。

### 9.3 专家身份和评审

- 专家登录读取 `experts`，专家类型为 `preliminary` 或 `final`。
- 本地 `expertInfo` 仅用于页面状态，云函数必须重新验证专家身份、阶段和权限。
- 初评读取 `cleaned`，终评读取 `finalScoring`。
- 评分提交必须校验评审时间、专家类型、作品阶段、重复提交和历史届只读。
- 列表不可自动播放视频；离开页面必须停止播放和释放上下文。

### 9.4 评审阶段

- 少于 320 件：取消评选，全部直接入围。
- 320–639 件：直接终评。
- 640 件及以上：初评 + 终评。
- 真实名额和地域保护仍以 `generatePreliminaryTable`、`generateFinalRanking` 的现有规则为准；这些函数目前禁止直接调用，后续应作为安全流水线适配器重构。

### 9.5 查询和证书

- 查询输入为姓名、手机号、届次。
- 返回全部匹配作品，不得恢复 `.limit(1)`。
- 自动证书匹配只允许 `workCode`；报名 ID 可技术复核，姓名/手机号/作品名只用于人工排查。
- 临时证书 URL 不得永久存库。
- 替换证书必须新建版本，旧文件不能直接删除。

### 9.6 管理员权限

- 前端本地 `adminInfo` 不可信。
- 每个管理云函数必须服务端重新校验管理员。
- 生产危险操作必须单独取得明确确认；一般“继续开发”不等于授权清洗、排名、删除或发布。
- 任何备份失败都必须终止后续步骤。

## 10. 重要文件列表

### 10.1 环境、应用和路由

- `miniprogram/envList.js`：版本到环境映射。
- `miniprogram/app.js`：云初始化、openid、届次缓存。
- `miniprogram/app.json`：27 个页面及 TabBar。
- `cloudfunctions/quickstartFunctions/index.js`：聚合路由、安全拒绝和日志摘要。
- `cloudfunctions/quickstartFunctions/common/edition.js`：年度解析器。

### 10.2 报名、送件和视频

- `miniprogram/pages/pottery-submission/index.js|wxml|wxss`
- `miniprogram/pages/pottery-query/index.js`
- `miniprogram/pages/artwork-delivery/index.js`
- `miniprogram/pages/profile/index.js`
- `cloudfunctions/quickstartFunctions/createPotterySubmission/index.js`
- `cloudfunctions/quickstartFunctions/updatePotterySubmission/index.js`
- `cloudfunctions/quickstartFunctions/fetchAllSubmissions/index.js`
- `cloudfunctions/quickstartFunctions/fetchAllDeliveries/index.js`
- `cloudfunctions/quickstartFunctions/common/video.js`
- `cloudfunctions/quickstartFunctions/confirmSubmissionVideo/index.js`

### 10.3 内容模块

- `cloudfunctions/quickstartFunctions/fetchMuseumContent/index.js`
- `cloudfunctions/quickstartFunctions/manageMuseumContent/index.js`
- `miniprogram/pages/museum-collections/`
- `miniprogram/pages/museum-collection-detail/`
- `miniprogram/pages/museum-artists/`
- `miniprogram/pages/museum-artist-detail/`
- `miniprogram/pages/catalog-links/`
- `miniprogram/pages/web/index.js`
- `miniprogram/pages/home/index.js|wxml|wxss`
- `miniprogram/pages/pottery-exhibition/index.js|wxml|wxss`

### 10.4 专家评分

- `miniprogram/pages/expert-login/index.js|wxml`
- `miniprogram/pages/expert-evaluation/index.js`
- `miniprogram/pages/expert-scoring/index.js|wxml|wxss`
- `cloudfunctions/common/rubric.js`
- `cloudfunctions/submitExpertScore/index.js`
- `cloudfunctions/quickstartFunctions/submitExpertScore/index.js`
- `cloudfunctions/fetchSubmissionDetail/index.js`
- `cloudfunctions/quickstartFunctions/fetchSubmissionDetail/index.js`
- `cloudfunctions/quickstartFunctions/fetchSubmissionsForEvaluation/index.js`

### 10.5 管理员和证书

- `miniprogram/pages/admin-panel/index.js|wxml|wxss`
- `cloudfunctions/quickstartFunctions/common/adminOperation.js`
- `cloudfunctions/quickstartFunctions/manageAdminOperation/index.js`
- `cloudfunctions/common/certificate.js`
- `cloudfunctions/quickstartFunctions/manageCertificates/index.js`
- `cloudfunctions/queryWorkStatus/index.js`
- `cloudfunctions/queryAwardStatus/index.js`
- `miniprogram/pages/work-query/index.js|wxml|wxss`
- `miniprogram/pages/award-query/`

### 10.6 测试和文档

- `tests/miniprogram-smoke.test.js`
- `tests/helpers/stage8FlowSimulator.js`
- `scripts/check-miniprogram-structure.js`
- `scripts/check-wxml-handlers.js`
- `scripts/check-wxml-syntax.js`
- `scripts/upgrade-readiness-check.js`
- `specs/2026-upgrade-stage-0/` 至 `stage-11/`

## 11. 未完成问题和已知风险

### 11.1 外部环境阻塞

- 测试环境 `jdzyzdmsg-test-4gx2v0bw182af653` 当前不可见或不存在。
- 未创建测试集合、索引、配置和存储目录。
- 未做测试环境真实云函数集成测试。
- 未完成微信开发者工具最新全量编译。
- 未完成 iOS/Android 真机测试。
- 未完成体验版、审核和发布。

### 11.2 代码未收口项

- `getVideoWorksList` 仍直接选择 `pottery_submissions_for_final` / `pottery_submissions_clean`，需要改用年度解析器。
- `createTestVideoWorks` 仍写死 `pottery_submissions_clean`，需要增加 `ENABLE_TEST_DATA` 保护并年度化。
- 一些旧危险函数内部仍写死历史集合，例如 `cleanSubmissionsData`、`generatePreliminaryTable`、`startFinalEvaluation`、`generateFinalRanking`、清表和修复函数。它们目前被聚合路由保护性拒绝，但后续真实适配器必须彻底年度化，不能直接重新开放旧路由。
- `generateRankingResults` 是统计/查询辅助逻辑，不等同于已经开放真实最终排名执行。
- 作品编号生成不是数据库事务级序列；需要依赖 `workCode` 唯一索引和冲突重试。
- 内容批量导入当前偏 JSON 粘贴预检，尚不是完整 Excel 模板上传体验。
- 视频“孤立文件”只有设计约束，尚需云端记录和管理员核对页面进一步完善。
- 云展网业务域名必须在微信公众平台配置，代码校验不能替代平台配置。

### 11.3 当前本地质量问题

最近一次 `git diff --check` 报告三处尾随空格：

- `cloudfunctions/quickstartFunctions/generatePreliminaryTable/index.js`
- `cloudfunctions/quickstartFunctions/uploadTestPotteryData/index.js`
- `miniprogram/pages/pottery-test/index.js`

这些是格式问题，可以用小补丁清理，但不要顺手改动相关历史业务逻辑。

最新年度导出/自动评估修改尚需运行：

```text
node --check <所有最近修改的云函数>
npm run test:smoke
npm run test:static
npm run test:unit
npm run test:integration:local
npm run test:structure
npm run test:handlers
npm run test:wxml
npm run check:upgrade-readiness
git diff --check
```

如果 Node 在默认沙箱报 `EPERM lstat C:\Users\Ruan`，这是本机执行权限/工具限制，不要通过复制项目、换 shell 或写临时脚本绕过。按平台要求申请受控执行；如果仍受使用额度限制，记录为未验证。

### 11.4 工作区风险

- 工作区长期脏，存在大量已修改、未跟踪和删除文件。
- 这些改动不全是本轮 Codex 创建，也可能包含用户自己的资料和历史操作。
- 不要执行 `git reset --hard`、`git clean`、`git checkout --`，不要恢复或删除不相关文件。
- 当前看到的删除包括历史 Excel、图片和 `tatus` 等；未经用户明确要求，不处理这些删除。
- 当前没有为本轮升级创建干净提交，不能以 Git HEAD 代表当前成果。

### 11.5 2026-07-22 生产环境初始化与评分联调

用户已在当前任务中明确授权直接操作生产环境 `jdzyzdmsg-5g4rgrjl2008796f`，并允许创建联调账号和合成测试数据。本次完成：

- 确认 2026 七个年度业务集合已存在且联调前为空。
- 创建 9 个长期业务空集合：`museum_artists`、`museum_collections`、`catalog_links`、`content_import_jobs`、`operation_logs`、`data_backups`、`certificate_records`、`certificate_match_logs`、`admin_import_jobs`。
- 创建可识别的生产联调专家：`T26-PRE-001`（初评）和 `T26-FIN-001`（终评），均标记 `_isTestData: true`、`_testRunId: production-link-20260722`。
- 创建两条合成作品：`T26-LINK-PRE-001` 位于 `pottery_submissions_clean_2026`，`T26-LINK-FIN-001` 位于 `pottery_submissions_for_final_2026`；未写入任何 2025 集合。
- 修复聚合与独立 `submitExpertScore` 部署包跨目录引用问题：评分规则 `rubric.js`、独立函数届次路由 `edition.js` 和 `package.json` 均改为部署包自包含。
- 已部署生产 `quickstartFunctions` 和独立 `submitExpertScore`。两条路径的初评、终评提交均成功；数据库回读均为 1 条评分，A/B/A/B 换算为 8 分，`rubricVersion` 为 `pottery-2026-v1`。
- 本地专项单测 7/7、完整烟雾测试 27/27 通过；独立函数云端状态为 `Active / Available`，依赖安装和代码部署结果均成功。

联调数据当前保留，便于后续开发者工具/真机复测；清理前需按 `_isTestData` 和 `_testRunId` 精确确认范围。小程序真实 OPENID 报名、送件、视频上传仍需在微信开发者工具或真机完成。

## 12. 下一阶段开发计划

### 步骤 1：先完成本地收口

1. 清理三处尾随空格。
2. 年度化 `getVideoWorksList`。
3. 为 `createTestVideoWorks` 增加测试开关、年度解析和安全日志。
4. 检查所有活跃、非保护性拒绝路由是否仍硬编码旧业务集合。
5. 检查最新导出、阶段判断、专家进度和自动评估函数语法。
6. 重新执行完整本地测试矩阵。
7. 根据真实测试数量更新阶段 6/7/9/10 测试报告，不能沿用猜测的 24/24。

### 步骤 2：恢复测试环境

需要用户或项目管理员确认以下一种方案：

- 找回原测试环境权限；或
- 在核对套餐和费用后创建新的测试环境，并更新测试环境 ID。

恢复后创建：

- `exhibition_editions`、`edition_settings`
- 2026 七个年度业务集合
- 馆藏、艺术家、画册集合
- 操作日志、备份、证书和匹配日志集合
- 必要唯一索引和查询索引
- `exhibitions/pottery-2026/`、`museum/` 和 `backups/` 存储目录

测试数据必须为合成数据，禁止复制生产姓名、手机号、身份证号、作品图片和视频。

### 步骤 3：测试环境端到端验收

按顺序执行：

```text
活动配置
→ 报名/编辑/视频上传
→ 报名截止
→ 清洗预检/备份/执行
→ 初评
→ 初评结果
→ 终评评分表
→ 终评
→ 最终排名
→ 入围/获奖查询
→ 证书匹配与替换
→ 送件
→ 画册发布
```

危险业务适配器必须先在测试环境实现和演练“执行 + 校验 + 恢复”。生产环境只允许预检，除非用户针对某次具体操作明确确认。

### 步骤 4：开发者工具和真机

- 微信开发者工具完整编译、页面导航、控制台和网络检查。
- iOS/Android 视频选择、49MB/50MB/50MB+1 字节、弱网、中断和重试。
- 图片/视频评分、页面反复进入退出、音频停止和内存趋势。
- 多作品入围/获奖查询、证书临时 URL、长按保存。
- 云展网 web-view 和业务域名。
- 管理员预检、备份、确认码过期、重复执行和恢复。

### 步骤 5：生产上线准备

只有测试验收通过后：

1. 再做一次生产只读基线。
2. 列出要创建的集合、索引、目录、云函数和风险，取得确认。
3. 创建空的 2026 资源，所有功能开关默认关闭。
4. 部署兼容版云函数，验证旧版小程序仍可用。
5. 体验版只做安全的只读和测试账号流程。
6. 用户明确授权后才上传、提交审核和发布。

## 13. 后续 Codex 必须遵守的规则

1. 所有回答使用中文。
2. 开始任务前先核对需求；本项目已有完整总体方案，局部不明确时优先从代码和 `specs/` 查证。只有会改变业务结果、数据或权限的选择才向用户提问。
3. 每次只推进一个阶段或一个明确子任务；先给出需求、设计、任务、影响文件和验证方法。
4. 修改前运行 `git status --short`，只改本任务文件；保留用户已有修改。
5. 使用 `apply_patch` 编辑文件；不要用 Python、`cat` 或重定向写普通代码文件。
6. 搜索优先 `rg` / `rg --files`。
7. 中文文件在 PowerShell 使用 `Get-Content -Encoding UTF8`。
8. 前端实际调用可能是聚合云函数或独立云函数，修改前必须确认调用链；同名实现可能同时存在。
9. 小程序使用 `wx.cloud` 和 OPENID，不要引入 Web SDK 登录方案。
10. 客户端本地管理员/专家信息不可信，权限必须由服务端重新校验。
11. 所有届次相关集合必须经年度解析器；不得接受前端任意集合名。
12. `pottery-2025` 所有写操作必须拒绝；第二届数据和文件不得迁移、覆盖、清空或删除。
13. 开发版和体验版不得连接生产；测试环境不可用时只能做本地验证，不能改回生产绕过。
14. 不得把生产个人数据复制到测试环境。
15. 清洗、排名、全表复制、去重、证书批处理、文件删除必须单独取得明确确认；“继续开发”不构成授权。
16. 生产资源创建、云函数部署、小程序上传、审核和发布也需要明确授权。
17. 新视频限制仅适用于 2026 新上传；不要删除或拒绝第二届大于 50MB 的历史视频。
18. 评分业务规则是 A/B/C/D；设计稿中的 1–10 滑杆仅作为视觉参考，除非用户明确变更已确认规则。
19. 多作品查询必须返回数组；证书自动匹配主键必须为 `workCode`。
20. 临时文件 URL 不得永久存入数据库；敏感个人信息不得写入日志。
21. 每次修改后至少执行语法检查、相关最小测试和 `git diff --check`；测试失败要记录真实结果，不能更新文档伪称通过。
22. 同一根因连续出现 3 次时停止增量修补，给出根因、影响范围和整体修复建议。
23. 不执行破坏性 Git 命令，不整理无关未跟踪文件，不删除 `outputs/`、历史证书、图片、视频或导出资料。
24. 每阶段结束报告：完成内容、修改范围、测试结果、未完成项、风险、回滚方法和下一阶段条件。

## 14. 建议新对话的第一条指令

可直接对下一位 Codex 说：

> 请先完整阅读项目根目录的 `PROJECT_CONTEXT.md`、`AGENTS.md`，再检查 `git status --short`。当前先完成“阶段 9 本地收口”：修复三处尾随空格，年度化 `getVideoWorksList`，为 `createTestVideoWorks` 增加测试开关和年度路由，核查活跃路由中的旧集合硬编码，然后运行完整本地测试矩阵并更新真实测试报告。不要写生产环境，不要部署或发布，不要处理无关工作区改动。

## 15. 关键参考文档

- 总体升级方案：当前对话中用户提供的《2026 年整体升级操作手册》。
- `AGENTS.md`：项目既有业务、页面、集合和协作规则。
- `specs/2026-upgrade-stage-0/production-readonly-inventory-2026-07-12.md`：生产只读盘点。
- `specs/2026-upgrade-stage-0/` 至 `specs/2026-upgrade-stage-11/`：各阶段 requirements/design/tasks/audit/test-report。
- `specs/performance-memory-optimization/`：既有性能和内存优化记录。
