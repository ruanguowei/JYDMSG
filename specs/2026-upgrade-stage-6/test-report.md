# 2026 升级第 6 阶段：测试报告

## 本地检查

已通过：

```text
node --check cloudfunctions/quickstartFunctions/common/adminOperation.js
node --check cloudfunctions/quickstartFunctions/manageAdminOperation/index.js
node --check miniprogram/pages/admin-panel/index.js
node --check tests/miniprogram-smoke.test.js
node --check scripts/upgrade-readiness-check.js
node --test tests/miniprogram-smoke.test.js
npm run check:upgrade-readiness
```

烟雾测试结果：

```text
tests 24
pass 24
fail 0
```

覆盖项：

- 危险操作预检能返回源集合、目标集合和记录数。
- 目标集合已有数据时提示必须备份。
- 历史只读届次拒绝危险操作。
- 届次口令错误会拒绝。
- 一次性确认码哈希校验正确。
- 确认码超过 10 分钟失效。
- 安全流水线覆盖所有已拒绝的旧危险路由名称，避免预检时出现“未知危险操作”。
- 管理员页面包含预检、备份清单、确认码、届次口令和受保护执行链路。
- 执行确认码哈希从服务端审计记录读取，不依赖前端回传哈希。
- 预检状态会先写入 `operation_logs`；没有预检不能备份，没有备份不能生成确认码。
- 备份实现已导出到 `backups/{editionId}/{operationId}/`，按 4MB 分片上传并记录 SHA-256、文件 ID、大小和恢复说明。
- 执行入口具备 RUNNING/SUCCEEDED/FAILED 的幂等防重检查；当前仍以保护性失败返回阻止真实清洗、排名、证书替换或文件删除。
- 当前真实危险执行器保持保护性拒绝，只记录审计链路，不执行清洗、排名、证书替换或文件删除。
- 聚合云函数包含 `manageAdminOperation` 路由。
- 管理员页面包含危险操作安全流水线入口，并明确“执行器仍处于保护接入阶段”。
- 管理员页面的清洗、生成初评、开始终评、生成终评结果按钮不再直连旧危险执行函数，统一进入预检。
- 聚合云函数旧危险路由已拒绝直连，要求改走 `manageAdminOperation`，覆盖：
  - `cleanSubmissionsData`
  - `generatePreliminaryTable`
  - `startFinalEvaluation`
  - `generateFinalRanking`
  - `clearCleanTable`
  - `clearTestData`
  - `clearAllData`
  - `fixDateFormat`
  - `swapEvaluations`
  - `convertImageLinks`
  - `clearCloudStorageFiles`

## 未完成验证

- 未在测试云环境实际调用 `preview`。
- 未在测试云环境实际生成真实云存储备份文件（代码路径已实现）。
- 未接入旧危险操作的真实业务适配器；保护性幂等执行器已接入。
- 未使用微信开发者工具编译。
- 未真机验证管理员页面。

原因：当前账号下测试环境 `jdzyzdmsg-test-4gx2v0bw182af653` 不可用或不可见。为避免误碰生产环境，本阶段未执行任何云端写入。

## 当前补充验证状态

已完成最新本地检查：

```text
node --check cloudfunctions/quickstartFunctions/manageAdminOperation/index.js
node --check miniprogram/pages/admin-panel/index.js
node --check tests/miniprogram-smoke.test.js
node --check scripts/upgrade-readiness-check.js
npm run test:smoke
npm run check:upgrade-readiness
git diff --check -- cloudfunctions/quickstartFunctions/common/adminOperation.js cloudfunctions/quickstartFunctions/manageAdminOperation/index.js miniprogram/pages/admin-panel/index.js miniprogram/pages/admin-panel/index.wxml miniprogram/pages/admin-panel/index.wxss tests/miniprogram-smoke.test.js scripts/upgrade-readiness-check.js specs/2026-upgrade-stage-5/tasks.md specs/2026-upgrade-stage-6/tasks.md
```
