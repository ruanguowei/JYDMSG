# 2026 升级阶段 4 设计

## 数据结构

报名记录新增：

```js
{
  video: {
    fileId: "",
    fileName: "",
    sizeBytes: 0,
    format: "mp4",
    durationSeconds: 0,
    width: 0,
    height: 0,
    aspectRatio: "",
    uploadStatus: "uploaded",
    uploadedAt: 0
  }
}
```

## 前端流程

`pages/pottery-submission/index.js` 新增：

- `chooseVideoFile`
- `removeVideoFile`
- `ensureVideoUploaded`

提交时：

- 视频作品先校验并上传视频。
- 上传完成后把 `video` 元数据随报名数据提交。

## 服务端校验

新增 `common/video.js`：

- `MAX_VIDEO_SIZE_BYTES`
- `normalizeVideoMeta`
- `validateVideoMeta`

报名创建和编辑均调用 `validateVideoMeta`。

## 当前限制

新建报名时服务端生成 `workCode` 发生在提交后，而视频上传发生在提交前，所以当前本地实现先上传到草稿路径。后续在测试环境恢复后，应在创建成功后用 `workCode` 完成二次绑定或迁移到：

```text
exhibitions/pottery-2026/submissions/{workCode}/video/
```

`confirmSubmissionVideo` 已作为编辑/确认路径底座，但完整绑定仍需云端环境验证。
