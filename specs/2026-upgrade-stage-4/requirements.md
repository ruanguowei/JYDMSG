# 2026 升级阶段 4 需求

阶段目标：把视频作品从“百度云链接填写”升级为“小程序内选择、50MB 校验、预览、上传、提交”的站内流程。

## 当前本地范围

- 报名页支持选择 MP4 视频。
- 客户端校验扩展名和 50MB 大小。
- 页面支持提交前预览。
- 提交时上传视频到云存储。
- 报名创建和编辑保存新版 `video` 结构。
- 服务端按 `video` 结构校验 MP4、50MB 和 `uploadStatus`。
- 旧字段 `videoDuration`、`videoResolution`、`videoAspectRatio`、`shootingTechnique`、`baiduCloudLink`、`baiduCloudPassword` 保留兼容读取。

## 当前验收标准

- 视频作品不再要求填写百度云链接和密码。
- 视频作品必须存在 `video.fileId` 且 `uploadStatus: "uploaded"`。
- 视频大小不能超过 `50 * 1024 * 1024` 字节。
- 仅允许 MP4。
- 本地测试覆盖服务端和前端入口。

## 待测试环境恢复后验证

- 49MB MP4 上传成功。
- 恰好 50MB 上传成功。
- 50MB 加 1 字节被拒绝。
- 真机视频预览、上传进度、上传失败重试。
- 专家评分页视频播放。
