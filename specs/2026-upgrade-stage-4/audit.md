# 2026 升级阶段 4 审计

审计时间：2026-07-11

## 已完成

- 新增视频规则工具 `common/video.js`。
- 新增视频确认云函数 `confirmSubmissionVideo`。
- 报名页支持选择 MP4、50MB 校验、预览和上传进度。
- 报名创建/编辑服务端保存 `video` 结构。
- 视频作品不再要求百度云链接和密码。

## 本地验证

- `node --check cloudfunctions/quickstartFunctions/common/video.js`：通过。
- `node --check cloudfunctions/quickstartFunctions/confirmSubmissionVideo/index.js`：通过。
- `node --check miniprogram/pages/pottery-submission/index.js`：通过。
- `node --check` 报名创建/编辑云函数：通过。
- `node --test tests/miniprogram-smoke.test.js`：12/12 通过。
- 本阶段变更范围 `git diff --check`：通过。

## 当前限制

- 测试环境不可用，无法做真实云存储上传和真机 49/50MB 边界验证。
- 新建报名时视频暂用草稿路径，完整 `workCode` 路径绑定需在云端验证后继续收口。
- 专家评分页视频播放尚未接入，后续继续阶段 4/5 联动处理。
