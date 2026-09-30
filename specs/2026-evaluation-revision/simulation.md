# 评审离线模拟使用说明

## 运行方法

```powershell
npm run simulate:evaluation
```

自动生成模拟报名数据，用真实清洗、评分提交、阶段生成处理器跑到最终名单，输出到outputs/evaluation-simulation下的新时间目录。

也可从已经导出的本地报名JSON数组开始；程序不读取云数据库：

```powershell
npm run simulate:evaluation -- --input "C:/本地报名副本.json" --out "outputs/evaluation-simulation/custom-run"
```

输入必须有唯一_id、name、school、idNumber、category、schoolProvinces等现有报名字段。请将输出放在独立目录。输入院校或类别分布无法满足规则时，输出FAILED报告并停止，不自动调整名额。

规则测试与穷举对照：

```powershell
npm run test:evaluation
```

## 链路和产物

1. 原始报名表：01-原始报名表.json。
2. 运行真实清洗处理器：02-清洗表.json。
3. 通过真实submitExpertScore模拟7位初评专家：03-初评评分表.json。
4. 生成初评结果：04-初评结果表.json。
5. 合并港澳台作品，清空新阶段评分：05-终评待评分表.json。
6. 通过真实submitExpertScore模拟11位终评专家：06-终评评分表.json。
7. 生成最终入围及分类评奖排名：07-终评结果表.json。
8. 模拟人工确定一个奖项再重算，检查奖项及证书保留：08-人工奖项重算结果.json。
9. report.md及report.json：数量、耗时、院校覆盖、评分提交次数、全部核对结果。

## 本次运行结果

默认场景原始850条，包括800件普通作品、8件港澳台、30件国际邀约、8条较旧重复投稿、4条报名时已无资格记录。清洗保留838件；国际不参加评审。模拟包含缺评、仅1或2位专家评分、真实零分、独立扣分、初评和终评取消资格。

| 阶段 | 数量 |
|---|---:|
| 原始报名 | 850 |
| 清洗后 | 838 |
| 初评结果 | 520 |
| 终评任务（含港澳台8件） | 528 |
| 最终展出 | 320 |

最终传统100、当代100、数字60、产业60件，全部132所参评院校获得至少1件展出。四所只有一件零分作品的院校仍入围；未评分的港澳台作品仍展出，但无评奖名次。每条结果的均分和同分维度由独立计算核对。

30项规则测试通过，包括80组终评穷举及100组初评/终评联合穷举；完整链路30项核对通过。待部署代码包也使用同一模拟链路跑通。

## 隔离和边界

- 只在本地内存中模拟集合；真实SDK、网络客户端和环境凭证不可加载。
- 模拟原始报名表和旧届表设置为不可写，记录所有写入尝试，并在最后核对原始内容SHA-256。
- 使用真实生成函数的入口及评分事务逻辑，但数据库查询/事务是模拟实现，不等于真实数据库并发、网络故障、限流或真机长期性能测试。
- --function-dir参数可指定本地待部署的聚合函数目录，评分仍采用小程序实际使用的独立submitExpertScore源码。
- 此脚本放在本地scripts目录，不随云函数部署，不提供线上自动评分或清空入口。

## 部署记录

生产环境：jdzyzdmsg-5g4rgrjl2008796f；云函数：quickstartFunctions。2026-09-11部署后状态Active，Nodejs16.13、180秒超时、256MB内存保持原配置。

仅更新common/evaluationRules.js、common/evaluationSelection.js、common/evaluationPipeline.js、common/adminOperation.js。已下载线上包逐文件核对，其他业务文件与部署前一致。备份和差异清单位于.deploy-review-2026/school-20260911。

本次工具传入dryRun:true、confirm:false后仍返回代码更新成功，后续已按实际更新核验且没有重复部署；这是本次工具行为记录。此次部署已经获得用户授权。未调用任何正式业务处理器，未修改正式数据库，未上传小程序前端。
