# 评审批次加载优化

## 行为

- 新版前端选类别及加载下一批时传 batchOnly: true。首页 summaryOnly 仍计算完整统计。
- 2026批次查询按 categoryKey、qualification 和 evaluations 中专家身份/取消资格过滤，只返回该类别未评作品的简要信息，再保留原排序取5件。
- 为兼容 submissionTime 与 submitTime 的历史回退排序，仍读取当前类别剩余待评元数据，尚非数据库直接 limit(5)。不会加载全阶段作品详情。
- 终评每组最多5个候选按 sourceWorkId 查询清洗表，来源缺失或被取消资格时跳过并补位。
- 作品详情返回前再次过滤已评及取消资格，提交端原有事务校验保留。
- batchOnly响应不再提供全局统计。前端接受缺少统计字段；旧版请求及2025请求仍走原统计路径。

## 发布

需要部署独立 fetchSubmissionsForEvaluation，并发布对应小程序前端。聚合入口同名实现同步修改，但当前评分前端调用独立函数。

已存在的初评索引以 category 开头，并非本次查询使用的 categoryKey。建议发布时在 pottery_submissions_clean_2026 与 pottery_submissions_for_final_2026 分别增加非唯一索引 {categoryKey: 1, _id: 1}，再用查询计划评估。此改动尚未创建索引、部署或写库。

## 验证边界

本次只执行静态代码审查、四个修改文件的语法检查，不运行模拟或真机测试，尚无上线后的耗时对比。原始报名表不参与本批次读取或任何写入。
