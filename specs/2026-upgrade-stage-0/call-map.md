# 页面—云函数—数据链路摘要

## 普通用户链路

- 首页：`quickstartFunctions/fetchHomeData` → `system_settings`、`announcements`、`banners`。
- 报名：`createPotterySubmission`、`updatePotterySubmission`、`fetchAllSubmissions` → `pottery_submissions`。
- 送件：`createArtworkDelivery`、`updateArtworkDelivery`、`deleteArtworkDelivery` → `artwork_deliveries`。
- 入围查询：独立 `queryWorkStatus` → `pottery_submissions_final`。
- 获奖查询：独立 `queryAwardStatus` → `pottery_submissions_final`。
- 画册：`fetchCatalogIndex`、`fetchCatalogWorks`、`fetchCatalogDetail` → `secondWorks`。

## 专家链路

- 专家登录及承诺书：聚合云函数 → `experts`、`expertLoginLogs`。
- 评审列表与详情：独立/聚合云函数 → 初评 `pottery_submissions_clean`，终评 `pottery_submissions_for_final`。
- 评分提交：独立/聚合云函数 → 对应作品的 `evaluations`。

## 管理员链路

- 清洗：`pottery_submissions` → `pottery_submissions_clean`。
- 生成初评结果：`pottery_submissions_clean` → `pottery_submissions_preliminary`。
- 开始终评：`pottery_submissions_preliminary` → `pottery_submissions_for_final`。
- 最终排名：`pottery_submissions_for_final` → `pottery_submissions_final`。
- 证书与奖项工具直接更新最终结果或关联存储文件，均属于需单独确认的高风险路径。
