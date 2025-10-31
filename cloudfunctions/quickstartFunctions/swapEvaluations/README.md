# swapEvaluations - 批量交换作品评分

## 功能说明

批量交换作品的评分数据，支持：
- ✅ 多对作品同时交换
- ✅ ID + 名称双重验证（防止误操作）
- ✅ 三种执行模式
- ✅ 表可控（支持不同数据表）
- ✅ 详细的执行结果

---

## 调用参数

### 基本格式

```json
{
  "type": "swapEvaluations",
  "targetTable": "pottery_submissions_clean",
  "mode": "best-effort",
  "swaps": [
    {
      "workId1": "作品A的_id",
      "workName1": "作品A的名称",
      "workId2": "作品B的_id",
      "workName2": "作品B的名称"
    }
  ]
}
```

### 参数说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | ✅ | 固定值：`"swapEvaluations"` |
| `targetTable` | string | ⚪ | 目标表名，默认 `pottery_submissions_clean` |
| `mode` | string | ⚪ | 执行模式，默认 `best-effort` |
| `swaps` | array | ✅ | 交换对数组，至少1对 |
| `swaps[].workId1` | string | ✅ | 作品1的_id |
| `swaps[].workName1` | string | ✅ | 作品1的名称（用于验证） |
| `swaps[].workId2` | string | ✅ | 作品2的_id |
| `swaps[].workName2` | string | ✅ | 作品2的名称（用于验证） |

---

## 执行模式

### 1. `best-effort`（尽力而为）- 默认

- 验证所有交换对
- 只执行验证通过的
- 失败的跳过，不影响其他
- **推荐使用**

### 2. `all-or-nothing`（全部或全不）

- 所有交换对都验证通过后才执行
- 任何一对验证失败 → 全部不执行
- 最安全，但最严格

### 3. `stop-on-error`（遇错即停）

- 按顺序验证和执行
- 遇到第一个错误就停止
- 已执行的不回滚

---

## 调用示例

### 示例1：单对交换

```json
{
  "type": "swapEvaluations",
  "targetTable": "pottery_submissions_clean",
  "swaps": [
    {
      "workId1": "65f8a9b2c3d4e5f6a7b8c9d0",
      "workName1": "《回望工业时代系列一》",
      "workId2": "75f8a9b2c3d4e5f6a7b8c9d1",
      "workName2": "《青花瓷韵》"
    }
  ]
}
```

### 示例2：批量交换（推荐使用 best-effort 模式）

```json
{
  "type": "swapEvaluations",
  "targetTable": "pottery_submissions_clean",
  "mode": "best-effort",
  "swaps": [
    {
      "workId1": "65f8a9b2c3d4e5f6a7b8c9d0",
      "workName1": "《回望工业时代系列一》",
      "workId2": "75f8a9b2c3d4e5f6a7b8c9d1",
      "workName2": "《青花瓷韵》"
    },
    {
      "workId1": "85f8a9b2c3d4e5f6a7b8c9d2",
      "workName1": "《山水意境》",
      "workId2": "95f8a9b2c3d4e5f6a7b8c9d3",
      "workName2": "《现代简约》"
    }
  ]
}
```

---

## 返回结果

### 全部成功

```json
{
  "success": true,
  "message": "批量交换完成：2对全部成功",
  "data": {
    "mode": "best-effort",
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "results": [
      {
        "index": 0,
        "success": true,
        "work1": {
          "id": "65f8a9b2c3d4e5f6a7b8c9d0",
          "name": "《回望工业时代系列一》",
          "beforeCount": 7,
          "afterCount": 5
        },
        "work2": {
          "id": "75f8a9b2c3d4e5f6a7b8c9d1",
          "name": "《青花瓷韵》",
          "beforeCount": 5,
          "afterCount": 7
        }
      }
    ],
    "table": "pottery_submissions_clean",
    "operationTime": "2025-10-28T16:30:00.000Z"
  }
}
```

### 部分成功（best-effort 模式）

```json
{
  "success": true,
  "message": "批量交换完成：2对中1对成功，1对失败",
  "data": {
    "mode": "best-effort",
    "total": 2,
    "succeeded": 1,
    "failed": 1,
    "results": [
      {
        "index": 0,
        "success": true,
        "work1": { ... },
        "work2": { ... }
      },
      {
        "index": 1,
        "success": false,
        "error": "验证失败",
        "details": [
          {
            "type": "work1_name_mismatch",
            "message": "作品1名称不匹配",
            "expected": "《山水意境》",
            "provided": "山水意境"
          }
        ]
      }
    ]
  }
}
```

---

## 错误类型

### 1. 参数错误

```json
{
  "success": false,
  "message": "参数错误：swaps必须是非空数组"
}
```

### 2. ID冲突

```json
{
  "success": false,
  "message": "检测到ID冲突：同一作品不能出现在多个交换对中",
  "error": {
    "conflicts": [
      {
        "workId": "65f8a9b2c3d4e5f6a7b8c9d0",
        "appearsIn": [0, 2]
      }
    ]
  }
}
```

### 3. 作品不存在

```json
{
  "success": false,
  "error": "验证失败",
  "details": [
    {
      "type": "work1_not_found",
      "message": "作品1不存在",
      "workId": "xxx"
    }
  ]
}
```

### 4. 名称不匹配

```json
{
  "success": false,
  "error": "验证失败",
  "details": [
    {
      "type": "work1_name_mismatch",
      "message": "作品1名称不匹配",
      "workId": "xxx",
      "expected": "《回望工业时代系列一》",
      "provided": "回望工业时代系列一"
    }
  ]
}
```

---

## 注意事项

⚠️ **重要提醒：**

1. **不可撤销**：交换成功后没有自动回滚，需要再次调用才能还原
2. **准确输入**：必须准确输入作品ID和名称，大小写、标点符号都要一致
3. **避免冲突**：同一作品不能同时出现在多个交换对中
4. **建议备份**：操作前建议导出数据备份
5. **测试环境**：建议先在测试环境测试

---

## 使用流程

1. **获取作品ID和名称**
   - 从云数据库控制台查看
   - 或使用 exportPreliminaryResults 导出查看

2. **准备 JSON 参数**
   - 仔细核对ID和名称
   - 确保名称包含所有标点符号（如书名号《》）

3. **选择执行模式**
   - 单对交换：任意模式
   - 批量交换：推荐 `best-effort`

4. **在云开发控制台测试**
   - 云函数 → quickstartFunctions → 测试
   - 粘贴 JSON 参数
   - 查看返回结果

5. **验证结果**
   - 检查返回的 beforeCount 和 afterCount
   - 在数据库中验证评分是否正确交换

---

## 常见问题

**Q: 为什么需要输入作品名称？**  
A: 双重验证，防止ID输错导致交换错误的作品。

**Q: 名称不匹配怎么办？**  
A: 检查作品名称是否完全一致，包括标点符号、空格等。可以从数据库中复制准确的名称。

**Q: 可以撤销交换吗？**  
A: 再次执行相同的交换即可还原（A和B交换后，再次A和B交换即恢复原状）。

**Q: best-effort 和 all-or-nothing 有什么区别？**  
A: best-effort 允许部分成功，all-or-nothing 要求全部成功才执行。

**Q: 交换会影响其他字段吗？**  
A: 不会，只交换 evaluations 字段，其他字段（作品名称、学生信息等）不受影响。

---

## 支持的数据表

- `pottery_submissions` - 原始提交表
- `pottery_submissions_clean` - 清洗表（默认）
- `pottery_submissions_for_final` - 终评表
- `pottery_submissions_preliminary` - 初评结果表


