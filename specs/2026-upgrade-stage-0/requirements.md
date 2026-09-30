# 2026 升级阶段 0：基线与环境隔离需求

## 目标

在不创建云资源、不写入生产数据、不部署或发布小程序的前提下，固定升级前基线，并消除开发版和体验版误连生产环境的风险。

## 范围

- 记录工作区、页面、云函数、生产 NoSQL 集合和云存储基线。
- 把第二届核心集合和关联存储标记为历史只读资产。
- 恢复 `develop/trial -> test`、`release -> production` 的环境映射。
- 在管理员面板显示实际运行环境。
- 增加环境映射离线测试。

## 非目标

- 不创建 2026 年集合、索引或存储目录。
- 不更改云数据库权限、云函数和生产数据。
- 不执行清洗、排名、证书、复制或删除操作。
- 不上传、预览、提交审核或发布小程序。

## 验收标准

- 当小程序版本为 `develop` 或 `trial` 时，系统应初始化测试环境 `jdzyzdmsg-test-4gx2v0bw182af653`。
- 当小程序版本为 `release` 时，系统应初始化生产环境 `jdzyzdmsg-5g4rgrjl2008796f`。
- 当管理员进入管理面板时，页面应显示环境名称、版本类型和环境 ID。
- 当阶段 0 完成时，生产环境第二届集合条数和云存储文件数量应与只读盘点一致。
- 当离线冒烟测试运行时，环境映射测试应覆盖 `develop`、`trial` 和 `release`。

## 冻结规则

以下生产集合在年度路由完成前视为第二届历史资产，禁止清空、覆盖和批量更新：

- `pottery_submissions_clean`
- `pottery_submissions_preliminary`
- `pottery_submissions_for_final`
- `pottery_submissions_final`
- `artwork_deliveries`
- `secondWorks`

云存储中的第二届作品、证书、视频、首页资料、导入包和导出文件不删除、不移动。
