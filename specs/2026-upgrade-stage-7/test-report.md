# 2026 升级第 7 阶段：测试报告

## 本地检查

已通过：

```text
node --check cloudfunctions/common/certificate.js
node --check cloudfunctions/queryWorkStatus/index.js
node --check cloudfunctions/queryAwardStatus/index.js
node --check cloudfunctions/quickstartFunctions/manageCertificates/index.js
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

- 入围查询不再 `.limit(1)`。
- 获奖查询不再 `.limit(1)`。
- 两个查询接口均返回 `works` 数组。
- 查询接口支持届次参数。
- 查询接口返回作品编号。
- 查询接口读取证书权威记录或兼容旧字段。
- 查询页面循环展示多作品。
- 证书文件名能解析 `workCode`。
- 证书版本号按已有记录递增。
- 新证书记录保存 `matchMethod: "workCode"`。
- 证书预检入口已挂到聚合云函数。
- 证书批处理 `apply` 必须通过 `uploadCertificates` 安全流水线确认码、备份记录和届次口令。
- 证书替换会把旧 active 记录标记为 `replaced`，并写入 `replacedByCertificateId`。
- 证书批处理写入 `certificate_match_logs`，保留匹配、创建、替换和文件信息。
- 为兼容旧查询字段，批处理可同步当前有效证书到结果表字段。

## 未完成验证

- 未在测试云环境查询真实数据。
- 未在微信开发者工具编译。
- 未真机验证证书长按保存。
- 未在测试云环境执行证书真实上传或替换。

原因：当前账号下测试环境不可用或不可见。为避免误碰生产环境，本阶段未执行任何云端写入。
