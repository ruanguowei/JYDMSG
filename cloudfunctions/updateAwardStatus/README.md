# updateAwardStatus 云函数

根据获奖名单更新 `pottery_submissions_final` 表中作品的 `status` 字段。

## 功能说明

- 读取获奖名单JSON数据
- 根据作品名称和作者姓名匹配数据库中的记录
- 将获奖情况（卓越创作奖、新锐突破奖、优秀潜力奖）写入 `status` 字段

## 参数说明

```javascript
{
  awardList: {
    "技艺类": [
      {
        "排名": 1,
        "作品名称": "《记忆蓝匣系列之二》",
        "作者姓名": "陈婧怡",
        "所在学校": "景德镇陶瓷大学",
        "学校省份": "江西",
        "指导老师": "赵兰涛",
        "获奖情况": "卓越创作奖"
      },
      // ... 更多作品
    ],
    "文脉类": [...],
    "算法类": [...],
    "产业类": [...]
  },
  mode: "best-effort"  // 可选，执行模式
}
```

### 执行模式（mode）

- `best-effort`（默认）：尽力而为模式，尽可能多地更新，跳过失败项
- `all-or-nothing`：全部成功模式，只有全部匹配成功才执行更新
- `stop-on-error`：遇错停止模式，遇到错误立即停止后续更新

## 匹配逻辑

1. 首先通过作品名称（`artworkName` 或 `title` 字段）查找记录
2. 如果找到多条同名作品，通过作者姓名进一步匹配
3. 支持多作者情况（作者姓名用空格、顿号、逗号分隔）
4. 匹配成功后，更新 `status` 字段为获奖情况

## 返回结果

```javascript
{
  success: true,
  message: "获奖状态更新完成：60件全部成功",
  data: {
    mode: "best-effort",
    total: 60,
    succeeded: 60,
    failed: 0,
    categoryStats: {
      "技艺类": { total: 18, succeeded: 18, failed: 0 },
      "文脉类": { total: 18, succeeded: 18, failed: 0 },
      "算法类": { total: 12, succeeded: 12, failed: 0 },
      "产业类": { total: 12, succeeded: 12, failed: 0 }
    },
    results: [
      {
        index: 1,
        success: true,
        category: "技艺类",
        rank: 1,
        workName: "《记忆蓝匣系列之二》",
        authorName: "陈婧怡",
        awardStatus: "卓越创作奖",
        recordId: "...",
        oldStatus: "pending"
      },
      // ... 更多结果
    ],
    operationTime: "2024-01-01T00:00:00.000Z"
  }
}
```

## 使用方法

### 方法1：在微信开发者工具中调用

1. 上传云函数到云端
2. 在云函数测试工具中调用，参数如下：

```json
{
  "awardList": {
    "技艺类": [...],
    "文脉类": [...],
    "算法类": [...],
    "产业类": [...]
  },
  "mode": "best-effort"
}
```

### 方法2：使用测试脚本

在项目根目录运行：

```bash
node update-award-status.js
```

### 方法3：使用HTML测试页面

在浏览器中打开 `update-award-status.html`（需要在微信开发者工具中运行）

## 注意事项

1. 确保 `pottery_submissions_final` 表已存在且有相应记录
2. 作品名称和作者姓名需要与数据库中的记录匹配
3. 如果作品名称或作者姓名有差异，可能导致匹配失败
4. 建议先用 `best-effort` 模式测试，查看匹配情况
5. 更新操作会记录时间戳到 `_awardUpdatedAt` 字段

## 错误处理

如果匹配失败，返回结果中会包含详细的错误信息：

```javascript
{
  success: false,
  message: "匹配失败，取消所有更新（5件有问题）",
  error: {
    mode: "all-or-nothing",
    total: 60,
    matchErrors: [
      {
        index: 1,
        category: "技艺类",
        rank: 1,
        workName: "作品名称",
        authorName: "作者姓名",
        errors: ["未找到作品: \"作品名称\""]
      }
    ]
  }
}
```






