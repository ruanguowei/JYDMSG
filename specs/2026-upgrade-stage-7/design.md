# 2026 升级第 7 阶段：设计与影响范围

## 查询返回结构

入围查询：

```js
{
  success: true,
  qualified: true,
  total: 2,
  edition: {
    editionId: "pottery-2026",
    year: 2026,
    editionNumber: 3,
    title: "第三届全国大学生陶艺作品展"
  },
  works: [
    {
      workCode: "POT2026-JY-000001",
      artworkName: "作品名",
      category: "技艺类",
      school: "学校",
      shortlisted: true,
      shortlistedCertificate: "cloud://...",
      certificates: {
        shortlisted: {
          certificateId: "",
          certificateType: "shortlisted",
          fileId: "cloud://...",
          version: 1,
          status: "active",
          matchMethod: "workCode"
        }
      }
    }
  ],
  data: {}
}
```

获奖查询同样返回 `works`，每件作品包含 `hasAward`、`awardStatus`、`awardCertificate` 和 `certificates.award`。

## 证书记录

新增公共工具：

- `cloudfunctions/common/certificate.js`

支持：

- `parseWorkCodeFromFileName()`
- `buildCertificateRecord()`
- `nextCertificateVersion()`
- `fetchActiveCertificates()`
- `normalizeCertificate()`

证书预检入口：

- `cloudfunctions/quickstartFunctions/manageCertificates/index.js`

当前仅支持：

- 从文件名或显式字段识别 `workCode`。
- 校验作品编号是否唯一匹配结果表。
- 判断将新增还是替换。
- 构造版本化证书记录预览。

## 兼容策略

- 第二届继续读取旧字段：
  - `shortlistedCertificate`
  - `awardCertificate`
- 2026 优先读取 `certificate_records`。
- 若 `certificate_records` 不存在或读取失败，回退到结果表旧字段。
- `data` 字段保留第一条结果，兼容旧前端。

## 风险与后续

- 当前证书管理真实执行未开放，避免误替换。
- 真正批量上传前必须接入第 6 阶段安全流水线。
- 真实执行必须保留旧证书记录为 `replaced`，并建立新旧版本关系。

