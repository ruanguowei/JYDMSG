# 自动化测试分层说明

当前项目是微信小程序云开发项目，无法在普通 Node 环境完整模拟微信运行时和云端数据库。因此测试分为五层。

## 1. 静态检查

命令：

```bash
npm run test:static
```

覆盖：

- 页面注册。
- Tab 图标存在。
- 聚合云函数路由存在。
- 关键页面入口存在。
- web-view 云展网白名单。
- 管理员页面危险操作预检入口。
- 查询接口字段限制。

结构护栏命令：

```bash
npm run test:structure
```

它会解析所有小程序 JSON，检查已注册页面的 JS/WXML/WXSS/JSON 文件和 TabBar 图标。

事件处理器检查：

```bash
npm run test:handlers
```

它会扫描页面 WXML 的 `bind*`/`catch*` 事件，确认对应页面 JS 中存在同名处理器。

WXML 标签检查：

```bash
npm run test:wxml
```

## 2. 单元规则测试

命令：

```bash
npm run test:unit
```

覆盖：

- 年度解析器。
- 只读届次保护。
- 视频 MP4 / 50MB 规则。
- A/B/C/D 评分换算。
- 扣分最低 0 分。
- 危险操作口令和确认码。
- 证书 workCode 匹配和版本递增。

## 3. 本地合成联调

命令：

```bash
npm run test:integration:local
```

覆盖：

- 650 件合成作品。
- 清洗、初评、终评、最终排名。
- 视频作品。
- 多作品用户。
- 证书生成和替换版本。
- 统计闭合。

## 4. 完整本地烟雾测试

命令：

```bash
npm run test:smoke
```

覆盖全部当前本地测试。

## 5. 需要微信开发者工具或真机验证的项目

这些项目无法仅靠 Node 验证：

- 小程序 WXML/WXSS 编译。
- 微信云开发真实调用。
- `wx.chooseMedia` 视频选择。
- `wx.cloud.uploadFile` 上传进度、取消和失败重试。
- `video` 组件播放与页面退出释放。
- web-view 打开云展网。
- 证书长按保存。
- 管理员页面真实预检云函数调用。

在测试环境可用后，应先执行：

```bash
npm run ci:preview
```

再使用测试账号进行真机验证。不得在生产环境执行报名、评分、清洗、排名、证书批处理或删除。
