# 2026 升级阶段 1 设计

## 年度解析器

新增 `cloudfunctions/quickstartFunctions/common/edition.js`。

解析器职责：

- 提供内置默认配置：`pottery-2026` 当前届、`pottery-2025` 历史只读届。
- 优先从 `exhibition_editions` 读取云端配置。
- 对不存在的届次报错。
- 对历史只读届的写操作报错。
- 通过 `collectionName(edition, key)` 返回受信任集合名，避免前端直接传集合名。

## 当前届查询

新增 `quickstartFunctions/getCurrentEdition`，返回普通前端需要的轻量配置：

- `editionId`
- `year`
- `editionNumber`
- `title`
- `status`
- `readOnly`
- `featureFlags`

## 已接入普通业务

- `createPotterySubmission`
- `fetchAllSubmissions`
- `updatePotterySubmission`
- `deleteSubmission`
- `createArtworkDelivery`
- `updateArtworkDelivery`
- `deleteArtworkDelivery`

这些函数不再直接写死本届普通业务集合，而是通过年度解析器获取：

- `submissions` -> `pottery_submissions_2026`
- `deliveries` -> `artwork_deliveries_2026`

## 前端缓存

`miniprogram/app.js` 新增 `loadCurrentEdition`：

- 启动后请求 `getCurrentEdition`。
- 成功后写入 `globalData.currentEdition`。
- 本地缓存 5 分钟。
- 请求失败不阻塞小程序启动，保留内置 `pottery-2026` 兜底。

## 仍需云端完成

测试环境恢复后，需要创建或导入：

- `exhibition_editions`
- `edition_settings`
- `pottery_submissions_2026`
- `pottery_submissions_clean_2026`
- `pottery_submissions_preliminary_2026`
- `pottery_submissions_for_final_2026`
- `pottery_submissions_final_2026`
- `artwork_deliveries_2026`
- `secondWorks_2026`

并按手册创建索引。
