# 2026 升级阶段 1 审计

审计时间：2026-07-11

## 已完成

- 已新增年度解析器 `quickstartFunctions/common/edition.js`。
- 已新增聚合云函数路由 `getCurrentEdition`。
- 已将报名和送件普通业务写路径接入年度集合映射。
- 已在小程序启动阶段加载并缓存当前届配置。
- 已增加本地测试覆盖年度解析、历史届只读拒绝、云端配置覆盖、前端届次缓存。
- 个人中心与送件详情已通过 `fetchAllDeliveries` / `fetchAllSubmissions` 云函数读取，避免前端直连旧年度集合。
- 评选阶段、专家进度和自动评估测试路由已接入年度解析；自动评估入口默认仅在显式启用的测试环境工作。

## 本地验证

- `node --check cloudfunctions/quickstartFunctions/common/edition.js`：通过。
- `node --check cloudfunctions/quickstartFunctions/getCurrentEdition/index.js`：通过。
- `node --check miniprogram/app.js`：通过。
- `node --check` 本阶段修改的报名和送件云函数：通过。
- `node --test tests/miniprogram-smoke.test.js`：8/8 通过。
- 搜索确认本阶段接入的普通业务函数不再直接写死旧 `pottery_submissions` 或 `artwork_deliveries` 写路径。
- 本阶段变更范围内 `git diff --check`：通过。
- 全仓 `git diff --check` 仍有历史无关行尾空格：`generatePreliminaryTable/index.js`、`work-query/index.wxml`。

## 当前限制

- 测试环境 `jdzyzdmsg-test-4gx2v0bw182af653` 当前不存在或当前账号不可见，无法完成云端集合创建、索引创建和小程序端到端写入验证。
- 本阶段未部署云函数，生产环境没有被写入或修改。
- 管理员清洗、排名、证书批处理仍未改造，必须等阶段 6 安全流水线处理后再运行。

## 下一步进入条件

- 恢复测试环境访问，或经套餐和费用确认后创建新的测试环境。
- 在测试环境创建 2026 年度集合、索引和 `exhibition_editions` 配置。
- 部署兼容云函数到测试环境后，执行一次报名和送件空数据冒烟。
