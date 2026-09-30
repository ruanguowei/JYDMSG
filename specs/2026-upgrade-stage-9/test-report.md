# 2026 升级第 9 阶段：测试报告

## 本地检查范围

本阶段新增分层命令，已分别执行：

```text
npm run test:static
npm run test:unit
npm run test:integration:local
npm run test:smoke
npm run test:structure
npm run test:handlers
npm run test:wxml
```

结果：

```text
test:static              pass 7, skipped 9, fail 0
test:unit                pass 7, skipped 11, fail 0
test:integration:local   pass 1, skipped 15, fail 0
test:smoke               tests 24, pass 24, fail 0
test:structure           27 个页面、3 个 TabBar 入口通过
test:handlers            WXML 事件处理器检查通过
test:wxml                WXML 标签结构检查通过
```

## 人工验收项

需要微信开发者工具或真机：

- 小程序编译。
- 真机视频选择、上传和播放。
- 证书长按保存。
- web-view 云展网。
- 管理员预检真实云函数调用。

## 当前限制

测试云环境不可见，本阶段不执行云端集成测试。
