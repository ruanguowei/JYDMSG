# 2026 升级第 5 阶段：测试报告

## 本地检查

已通过：

```text
node --check cloudfunctions/common/rubric.js
node --check cloudfunctions/submitExpertScore/index.js
node --check cloudfunctions/quickstartFunctions/submitExpertScore/index.js
node --check miniprogram/pages/expert-scoring/index.js
node --test tests/miniprogram-smoke.test.js
```

烟雾测试结果：

```text
tests 13
pass 13
fail 0
```

覆盖项：

- A/B/C/D 换算正确。
- 2 分维度中 B/C 均换算为 1 分。
- 扣分后最低为 0 分。
- 未完整选择等级不能通过服务端换算。
- 评分页不再提供半分选项。
- 提交评分云函数必须调用服务端换算模块。
- 评分记录保存 `rubricVersion`。

## 未完成验证

- 未连接测试云环境执行真实专家评分提交。
- 未使用微信开发者工具编译。
- 未进行真机评分页面交互验证。

原因：当前账号下测试环境 `jdzyzdmsg-test-4gx2v0bw182af653` 不可用或不可见。为避免误碰生产环境，本阶段未执行任何云端写入。

## 下一阶段进入条件

- 若继续第 6 阶段，可先做本地安全流水线代码结构和静态测试。
- 若要做云端集成验证，需要先确认测试环境可访问，或提供可用的测试环境 ID。

