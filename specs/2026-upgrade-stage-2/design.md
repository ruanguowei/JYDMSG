# 2026 升级阶段 2 设计

## 用户端结构

首页新增三个快捷入口：

- 馆藏作品 -> `pages/museum-collections/index`
- 艺术家档案 -> `pages/museum-artists/index`
- 电子画册 -> `pages/catalog-links/index`

详情页：

- 馆藏详情 -> `pages/museum-collection-detail/index`
- 艺术家详情 -> `pages/museum-artist-detail/index`

## 云函数

新增聚合子函数 `quickstartFunctions/fetchMuseumContent`。

支持 action：

- `listCollections`
- `collectionDetail`
- `listArtists`
- `artistDetail`
- `listCatalogLinks`

默认只返回 `status: "published"` 的内容；管理员预览后续可通过服务端管理员校验后传入 `includeOffline`，当前用户端不暴露该入口。

## 数据集合

阶段 2 预期集合：

- `museum_artists`
- `museum_collections`
- `catalog_links`
- `content_import_jobs`

当前代码已读取前三个集合；`content_import_jobs` 留待后台导入流程实现。

## 电子画册

`pages/web/index` 已注册，并校验：

- URL 必须是 HTTPS。
- 域名必须在 `ALLOWED_HOSTS` 中。
- 不符合条件时弹出明确错误并返回上一页。

上线前仍需在微信公众平台配置对应业务域名，否则微信 `web-view` 仍可能无法打开。
