# 生产环境只读结构盘点（2026-07-12）

本文件由 CloudBase 管理接口只读查询生成。未执行数据库写入、集合创建、索引修改、存储删除或云函数部署。

## 环境

- 环境 ID：`jdzyzdmsg-5g4rgrjl2008796f`
- 区域：`ap-shanghai`
- 状态：`NORMAL`
- 后端：旧版 NoSQL（未开通 PostgreSQL）
- 测试环境 ID `jdzyzdmsg-test-4gx2v0bw182af653` 当前不在账号可见环境列表中。

## 第二届及既有业务集合

| 集合 | 记录数 | 说明 |
|---|---:|---|
| `pottery_submissions` | 0 | 原始报名表当前为空，不能据此推断历史数据已删除 |
| `pottery_submissions_clean` | 1274 | 历史清洗/评审数据仍在 |
| `pottery_submissions_preliminary` | 549 | 历史初评结果仍在 |
| `pottery_submissions_for_final` | 549 | 历史终评评分表仍在 |
| `pottery_submissions_final` | 320 | 历史终评结果仍在 |
| `artwork_deliveries` | 225 | 历史送件数据仍在 |
| `secondWorks` | 334 | 历史作品画册数据仍在 |

## 其他业务集合

| 集合 | 记录数 |
|---|---:|
| `appointments` | 1140 |
| `expertLoginLogs` | 565 |
| `experts` | 12 |
| `announcements` | 2 |
| `banners` | 8 |
| `admin` | 1 |
| `evaluation_settings` | 1 |
| `pottery_exhibition` | 1 |
| `system_settings` | 1 |
| `timeLimit` | 1 |
| `test` | 1 |

## 云存储只读摘要

- 根目录文件及目录条目：364 个。
- `admin_exports/` 导出文件：11 个，均为 2025 年评审/结果导出。
- `第二届入围视频作品/`：目录及 11 个 MP4 文件；最大文件约 95.8 MB。
- 根目录还存在 `weda/import/` 下的多批导入压缩包、失败文件和模板，以及首页资料文件。

上述旧视频和导出文件全部保留。2026 年视频上传目录必须使用 `exhibitions/pottery-2026/...`，不能复用 `第二届入围视频作品/`。

## 2026 资源现状

本次只读检查确认以下集合目前均不存在：

- `exhibition_editions`
- `pottery_submissions_2026`
- `pottery_submissions_clean_2026`
- `pottery_submissions_preliminary_2026`
- `pottery_submissions_for_final_2026`
- `pottery_submissions_final_2026`
- `artwork_deliveries_2026`
- `secondWorks_2026`
- `museum_artists`
- `museum_collections`
- `catalog_links`
- `operation_logs`
- `data_backups`
- `certificate_records`
- `certificate_match_logs`

这些资源必须在可用测试环境先创建并验收，再按阶段申请生产创建；本轮未在生产环境创建空集合。

## 权限只读检查

- 生产云存储桶 ACL 查询结果：`READONLY`。
- `pottery_submissions_final` 集合权限查询结果：`READONLY`，未发现显式 SecurityRule 文本。
- 本轮未修改任何权限规则；新年度集合和视频目录上线前必须在测试环境复核最小权限。

每个主要集合均存在 CloudBase 默认索引；本次只读盘点未修改索引。所有带 `-preview` 后缀的影子集合当前均为 0 条，不能视为正式测试环境。

## 结论与后续约束

1. 第二届评分、结果、送件和画册数据仍在生产环境，后续不得清空、迁移或批量覆盖。
2. `pottery_submissions` 为 0 条，说明原始报名表与清洗表之间存在历史流程差异；任何清洗或回填前必须另做字段级核对。
3. 2026 年应新建年度集合和存储目录，不得复用上述旧集合。
4. 测试环境不可见，因此本次仅完成代码和本地合成测试；未执行生产危险操作。
