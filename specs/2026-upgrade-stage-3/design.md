# 2026 升级阶段 3 设计

## 大陶展页届次展示

`pages/pottery-exhibition/index.js` 调用 `app.loadCurrentEdition()` 获取当前届配置，失败时使用 `app.globalData.currentEdition` 的本地兜底。

状态文案：

- `preparing` -> 筹备中
- `registration` -> 报名开放
- `delivery` -> 送件开放
- `evaluation` -> 评审中
- `results` -> 结果已发布
- `archived` -> 历史只读

## 功能开关

入口仍显示，关闭时添加 `disabled` 样式。点击关闭入口时弹出明确原因。

受控入口：

- `registration`：推选入口、邀约入口
- `delivery`：作品运送
- `expertEvaluation`：专家评选
- `shortlistedQuery`：查询入围
- `awardQuery`：获奖查询
- `catalog`：作品画册

服务端权限和阶段校验仍必须保留；前端只是用户体验层提示。

## 作品画册

移除原有 `wx:if="{{false}}"` 硬隐藏，改为配置控制。
