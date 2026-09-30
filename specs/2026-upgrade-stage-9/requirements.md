# 2026 升级第 9 阶段：自动化测试体系需求

## 目标

把当前单一 smoke 测试扩展为可按层执行的测试体系，覆盖静态检查、单元规则、本地合成联调，并明确微信开发者工具和真机验收边界。

## 本阶段完成范围

- 新增 npm 分层测试命令：
  - `test:static`
  - `test:unit`
  - `test:integration:local`
  - `test:smoke`
- `test:structure`：解析小程序 JSON，校验页面文件和 TabBar 资源。
- `test:handlers`：检查 WXML 事件处理器在页面 JS 中存在。
- `test:wxml`：检查页面 WXML 标签闭合结构。
- 新增 `tests/README.md` 测试分层说明。
- 保留当前全部本地测试。
- 明确无法用 Node 自动验证的微信运行时项目。

## 明确不做

- 不运行微信开发者工具上传。
- 不生成体验版二维码。
- 不执行真机测试。
- 不连接云端测试环境。
