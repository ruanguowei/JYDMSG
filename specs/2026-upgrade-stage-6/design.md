# 2026 升级第 6 阶段：设计与影响范围

## 新增文件

- `cloudfunctions/quickstartFunctions/common/adminOperation.js`
  - 危险操作定义。
  - 状态常量。
  - 预检构造。
  - 届次口令校验。
  - 确认码生成、哈希和过期校验。

- `cloudfunctions/quickstartFunctions/manageAdminOperation/index.js`
  - 聚合云函数子入口。
  - 动作：
    - `preview`
    - `backup`
    - `issueConfirmation`
    - `execute`

## 修改文件

- `cloudfunctions/quickstartFunctions/index.js`
  - 新增 `manageAdminOperation` 路由。

- `miniprogram/pages/admin-panel/index.js`
  - 新增危险操作预检状态。
  - 新增 `previewDangerousOperation()`。

- `miniprogram/pages/admin-panel/index.wxml`
  - 新增安全流水线预检区域。

- `miniprogram/pages/admin-panel/index.wxss`
  - 新增预检区域样式。

- `tests/miniprogram-smoke.test.js`
  - 新增危险操作安全流水线测试。

## 状态机

```text
DRAFT
→ PREVIEWED
→ BACKED_UP
→ CONFIRMED
→ RUNNING
→ SUCCEEDED / FAILED
```

当前本地阶段实际开放：

```text
PREVIEWED
BACKED_UP
CONFIRMED
FAILED（真实执行器未接入时的保护性返回）
```

## 安全边界

- 前端本地 `adminInfo` 只用于传递账号标识；云函数仍重新查询 `admin` 集合校验。
- `pottery-2025` 等只读历史届次会被服务端拒绝。
- `execute` 当前不会调用旧危险函数。
- 管理员页面明确显示执行器仍处于保护接入阶段，支持预检、备份清单、确认码和受保护执行链路验证，但不会真实执行清洗、排名、证书替换或删除。

## 后续接入真实执行器前必须完成

- 测试环境可访问。
- 真实备份导出到云存储并记录哈希。
- 每个旧危险函数改造为可幂等执行器。
- 前端按状态机逐步开放备份、确认、执行按钮。
- 生产环境仅允许预检，真实执行必须再次单独确认。
