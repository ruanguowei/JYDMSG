# 2026 升级第 5 阶段：设计与影响范围

## 换算规则

评分规则版本：`pottery-2026-v1`

| 维度 | A | B | C | D |
|---|---:|---:|---:|---:|
| 主题契合度 | 3 | 2 | 1 | 0 |
| 创意与表现力 | 3 | 2 | 1 | 0 |
| 工艺与材料 | 2 | 1 | 1 | 0 |
| 美感与实用性 | 2 | 1 | 1 | 0 |

最终分：

```text
max(0, 原始总分 - 扣分)
```

## 服务端结构

新增公共换算模块：

- `cloudfunctions/common/rubric.js`

评分记录新增或规范化保存：

```js
{
  rubricVersion: "pottery-2026-v1",
  gradeScores: {
    themeFit: "A",
    creativity: "B",
    craftsmanship: "C",
    aesthetics: "D"
  },
  scores: {
    themeFit: 3,
    creativity: 2,
    craftsmanship: 1,
    aesthetics: 0
  },
  totalScore: 6,
  rawTotalScore: 6,
  deductionScore: 1,
  finalScore: 5,
  deductions: {
    aiNotLabeled: false,
    missingCreativeStatement: true
  }
}
```

## 前端交互

- `miniprogram/pages/expert-scoring/index.js`
  - 增加 `gradeOptions` 和 `gradeScores`。
  - 使用 `onGradeSelect` 替代旧数字选择。
  - 提交前校验四个维度均已选择。
  - 提交时同时携带 `gradeScores` 和换算后的本地展示分；服务端以 `gradeScores` 为准。

- `miniprogram/pages/expert-scoring/index.wxml`
  - 四个维度均渲染 A/B/C/D。
  - 评分指南文案改为等级制。

- `miniprogram/pages/expert-scoring/index.wxss`
  - 增加换算分提示样式。

## 云函数影响

- `cloudfunctions/submitExpertScore/index.js`
  - 独立云函数，当前前端实际调用路径。
  - 不再信任前端传入的数字总分。
  - 使用 `calculateRubric()` 重新换算。

- `cloudfunctions/quickstartFunctions/submitExpertScore/index.js`
  - 聚合子函数同步改造，避免未来切换调用路径时规则不一致。

- `cloudfunctions/fetchSubmissionDetail/index.js`
- `cloudfunctions/quickstartFunctions/fetchSubmissionDetail/index.js`
  - 默认分数改为 0。
  - 新增 `existingGradeScores` 回显。

## 风险说明

- 当前专家评审云函数仍直接使用旧集合名 `pottery_submissions_clean` 与 `pottery_submissions_for_final`。这符合本阶段“评分规则收口”的边界，但在后续年度链路联调前必须继续接入第 1 阶段的年度解析器。
- 未运行微信开发者工具编译与真机验证；本阶段仅完成本地静态/单元烟雾测试。

