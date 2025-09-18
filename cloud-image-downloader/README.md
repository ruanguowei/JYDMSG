# 微信云存储图片下载工具

这个工具可以帮助您将微信小程序云数据库中的云存储图片路径替换为本地下载的图片文件。

## 功能特点

- 🔍 自动识别数据库中的云存储路径（`cloud://` 开头）
- 📥 批量下载云存储中的图片到本地
- 🔄 自动替换数据库数据中的路径为本地路径
- 📊 生成详细的处理报告
- 🛡️ 支持断点续传（跳过已下载的文件）
- 📋 支持多种数据格式（JSON、数组、嵌套对象）

## 安装依赖

```bash
npm install
```

## 使用方法

### 方法一：使用简化脚本（推荐）

```bash
# 基本用法
node download-images.js [输入文件] [输出文件] [环境ID]

# 示例
node download-images.js ./database_export.json ./database_with_local_images.json your-env-id

# 使用环境变量
export WECHAT_CLOUD_ENV_ID=your-env-id
node download-images.js ./database_export.json ./database_with_local_images.json
```

### 方法二：使用编程接口

```javascript
const WeChatCloudDownloader = require('./wechat-cloud-downloader');

const downloader = new WeChatCloudDownloader({
  envId: 'your-env-id',
  outputDir: './downloaded_images'
});

const result = await downloader.processDatabaseFile(
  './database_export.json',
  './database_with_local_images.json'
);

if (result.success) {
  console.log('处理成功！');
  downloader.generateReport(result);
}
```

## 配置说明

### 环境ID获取方法

1. 登录[微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择您的小程序项目
3. 在概览页面找到"环境ID"

### 输入文件格式

工具支持包含云存储路径的JSON数据，例如：

```json
{
  "potterySubmissions": [
    {
      "_id": "123",
      "name": "张三",
      "photoUrl": "cloud://your-env.xxx-xxx-xxx/personal_photos/1234567890_abc.jpg",
      "artworkImages": [
        "cloud://your-env.xxx-xxx-xxx/artwork_photos/1234567890_def.jpg",
        "cloud://your-env.xxx-xxx-xxx/artwork_photos/1234567890_ghi.jpg"
      ]
    }
  ]
}
```

## 输出结果

### 1. 处理后的数据文件

原始数据中的云存储路径会被替换为本地相对路径：

```json
{
  "potterySubmissions": [
    {
      "_id": "123",
      "name": "张三",
      "photoUrl": "./downloaded_images/000_1234567890_abc.jpg",
      "artworkImages": [
        "./downloaded_images/001_1234567890_def.jpg",
        "./downloaded_images/002_1234567890_ghi.jpg"
      ]
    }
  ]
}
```

### 2. 下载的图片文件

所有图片会保存在 `downloaded_images` 目录中，文件名格式为：
```
000_原文件名.jpg
001_原文件名.jpg
...
```

### 3. 处理报告

生成 `downloaded_images/download_report.json` 文件，包含：
- 下载统计信息
- 成功/失败的文件列表
- 路径映射关系

## 注意事项

1. **网络连接**：确保网络连接正常，能够访问微信云存储
2. **权限设置**：确保云存储文件有读取权限
3. **存储空间**：确保本地有足够的存储空间
4. **文件大小**：大文件下载可能需要较长时间
5. **并发限制**：工具会自动控制并发下载数量，避免过载

## 错误处理

- 如果某个图片下载失败，会记录错误信息但不会中断整个流程
- 下载失败的文件在最终数据中保持原始云存储路径
- 详细的错误信息会记录在处理报告中

## 常见问题

### Q: 提示"无法获取临时URL"怎么办？
A: 检查环境ID是否正确，确保云存储文件存在且有读取权限。

### Q: 下载速度很慢怎么办？
A: 这是正常现象，云存储下载速度受网络条件影响。工具支持断点续传，可以重复运行。

### Q: 如何处理大量数据？
A: 建议分批处理，或者增加下载超时时间。

### Q: 生成的本地路径是绝对路径还是相对路径？
A: 默认生成相对路径，便于数据迁移和分享。

## 技术支持

如果遇到问题，请检查：
1. 环境ID是否正确
2. 网络连接是否正常
3. 云存储权限设置
4. 输入文件格式是否正确

## 许可证

MIT License