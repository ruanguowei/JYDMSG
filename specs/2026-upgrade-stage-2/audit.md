# 2026 升级阶段 2 审计

审计时间：2026-07-11

## 已完成

- 新增 `fetchMuseumContent` 云函数并注册聚合路由。
- 新增馆藏作品列表与详情页面。
- 新增艺术家档案列表与详情页面。
- 新增电子画册入口页面。
- 注册 `pages/web/index` 并增加云展网 HTTPS 白名单校验。
- 首页增加馆藏、艺术家和电子画册入口。
- 新增 `manageMuseumContent` 管理云函数并注册聚合路由。
- 管理员面板新增长期内容管理分区。
- 支持艺术家、馆藏、画册单条新增、编辑、发布和下架。
- 支持 JSON 数组导入预检和确认导入；导入只新增或更新，不删除、不清空。

## 本地验证

- `node --check cloudfunctions/quickstartFunctions/fetchMuseumContent/index.js`：通过。
- `node --check` 新增页面 JS：通过。
- `node --check cloudfunctions/quickstartFunctions/manageMuseumContent/index.js`：通过。
- `node --check miniprogram/pages/admin-panel/index.js`：通过。
- `node --test tests/miniprogram-smoke.test.js`：10/10 通过。
- 本阶段变更范围 `git diff --check`：通过。

## 当前限制

- 测试环境仍不可用，无法创建 `museum_artists`、`museum_collections`、`catalog_links` 集合和索引。
- 业务域名是否已在微信公众平台配置尚无法验证。
- 管理员后台的“模板文件下载”和文件上传解析尚未接入；当前使用 JSON 数组粘贴作为模板化导入底座。

## 下一步

- 测试环境恢复后导入样例内容并验证用户端展示。
- 后续可把 JSON 导入扩展为 Excel/CSV 文件上传解析。
