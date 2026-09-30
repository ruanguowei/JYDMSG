# 2026 升级阶段 0 基线审计

盘点时间：2026-07-11  
生产环境：`jdzyzdmsg-5g4rgrjl2008796f`  
测试环境：`jdzyzdmsg-test-4gx2v0bw182af653`

## 生产数据库汇总

生产环境当前共有 41 个 NoSQL 集合。第二届核心数据如下：

| 集合 | 条数 | 用途 | 冻结状态 |
|---|---:|---|---|
| `pottery_submissions_clean` | 1274 | 初评清洗及评分数据 | 历史只读 |
| `pottery_submissions_preliminary` | 549 | 初评结果 | 历史只读 |
| `pottery_submissions_for_final` | 549 | 终评评分 | 历史只读 |
| `pottery_submissions_final` | 320 | 最终入围、获奖和证书关联 | 历史只读 |
| `artwork_deliveries` | 225 | 第二届送件记录 | 历史只读 |
| `secondWorks` | 334 | 第二届作品画册 | 历史只读 |

其他重要集合：`appointments` 1140 条，包含 2026 年预约，不属于第二届整体归档对象；`expertLoginLogs` 565 条；`experts` 12 条；`pottery_submissions` 当前 0 条。

## 云存储汇总

根路径只读盘点得到 364 个对象。主要类别包括：

- `admin_exports/`：初评和终评 CSV。
- `exports/`：视频作品清单、评分进度和图片清单。
- `weda/import/`：第二届各阶段导入包、模板和失败包。
- `weda-uploader/`、`artwork_photos/`、`personal_photos/`：作品及个人资料图片。
- `artwork-delivery/`：送件和包装图片。
- `证书/`：第二届入围和获奖证书。
- `第二届入围视频作品/`：第二届入围视频。
- `首页资料/`：第二届通知及首页资料。

阶段 0 未移动、写入或删除任何云端对象。

## 已知风险

- 多个云函数仍写死第二届集合名；阶段 1 年度路由完成前不得执行危险函数。
- 管理员危险操作目前仍是单次弹窗后直接执行；阶段 6 完成前禁止在生产运行。
- 当前工作区存在大量历史未提交改动，后续必须继续采用任务范围内的小补丁。
- 微信开发者工具中的实际环境仍需人工启动开发版和体验版确认。

## 开发者工具验证结果

验证时间：2026-07-11。

- 微信开发者工具已成功打开项目并识别 AppID `wx7c60c191a0841a09`。
- 当前页面成功编译并进入 `pages/home/index`。
- WXML 与 WXSS 单文件编译通过。
- 运行时 `envVersion` 为 `develop`。
- 运行时 `cloudEnv` 为 `jdzyzdmsg-test-4gx2v0bw182af653`，证明环境映射生效。
- 网络请求的 `Env` 请求头同样为测试环境 ID。
- 测试环境返回 `Env Not Exists`，导致 `quickstartFunctions/login` 与 `fetchHomeData` 无法调用。
- CloudBase 环境列表只返回生产环境 `jdzyzdmsg-5g4rgrjl2008796f`，未返回原测试环境。

结论：代码隔离已生效，但原测试环境已不存在或当前账号没有访问权限。不得通过重新强制连接生产环境绕过此问题。恢复测试环境需要找回原环境权限，或经费用与套餐确认后创建新的测试环境。

## 自动化验证结果

- `node --check`：通过。
- `npm run test:smoke` 对应测试：5/5 通过。
- 开发者工具 WXML 编译：通过。
- 开发者工具 WXSS 编译：通过。
- 开发版实际环境：测试环境映射通过。
- 测试环境云函数连通：阻塞，原因是目标环境不存在或不可见。
