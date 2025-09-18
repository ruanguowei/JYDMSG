# 快速开始指南

## 1. 准备工作

### 获取云开发环境ID
1. 打开[微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择您的小程序项目
3. 在概览页面复制"环境ID"

### 准备数据库导出文件
将您的数据库数据导出为JSON格式，确保包含云存储路径（`cloud://` 开头）

## 2. 安装和运行

```bash
# 1. 安装依赖
npm install

# 2. 运行下载工具
node download-images.js ./your_database.json ./output_with_images.json your-env-id
```

## 3. 查看结果

- 📁 `downloaded_images/` - 下载的图片文件
- 📄 `output_with_images.json` - 处理后的数据文件
- 📋 `downloaded_images/download_report.json` - 处理报告

## 4. 示例数据格式

### 输入数据（包含云存储路径）
```json
{
  "potterySubmissions": [
    {
      "name": "张三",
      "photoUrl": "cloud://your-env.xxx/personal_photos/123.jpg",
      "artworkImages": [
        "cloud://your-env.xxx/artwork_photos/456.jpg"
      ]
    }
  ]
}
```

### 输出数据（本地路径）
```json
{
  "potterySubmissions": [
    {
      "name": "张三",
      "photoUrl": "./downloaded_images/000_123.jpg",
      "artworkImages": [
        "./downloaded_images/001_456.jpg"
      ]
    }
  ]
}
```

## 5. 常见问题

**Q: 提示"无法获取临时URL"**
- 检查环境ID是否正确
- 确认云存储文件存在

**Q: 下载失败**
- 检查网络连接
- 确认云存储权限设置

**Q: 文件很大下载很慢**
- 这是正常现象，可以重复运行工具（支持断点续传）

## 6. 高级用法

### 使用环境变量
```bash
export WECHAT_CLOUD_ENV_ID=your-env-id
node download-images.js input.json output.json
```

### 编程方式使用
```javascript
const WeChatCloudDownloader = require('./wechat-cloud-downloader');

const downloader = new WeChatCloudDownloader({
  envId: 'your-env-id',
  outputDir: './images'
});

const result = await downloader.processDatabaseFile('input.json', 'output.json');
```
