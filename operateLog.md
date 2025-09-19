# 操作日志

## 2024年查询参展申请图片上传代码

### 查询时间
- 查询了参展申请页面中图片上传相关的代码实现

### 查询结果
找到了参展申请中图片上传的完整实现，包括前端页面和后端云函数处理。

### 主要文件位置
1. **前端页面文件**：`miniprogram/pages/pottery-submission/index.js`
2. **前端UI文件**：`miniprogram/pages/pottery-submission/index.wxml`
3. **云函数文件**：`cloudfunctions/quickstartFunctions/createPotterySubmission/index.js`

### 图片上传功能说明
- 支持个人照片上传（1张）
- 支持常规作品的分类图片上传：
  - 透视图（1张）
  - 四面图（最多3张）
  - 局部图（最多3张）
- 支持视频作品的百度云链接上传
- 图片上传到微信云存储，并转换为HTTPS链接保存到数据库

## 2024年修复图片上传问题

### 问题描述
- 用户反馈图片上传后日志显示的还是临时存储路径（http://tmp/），而不是云存储路径（cloud://）
- 经分析发现代码中路径判断逻辑有误，将微信小程序的临时文件路径误判为网络图片

### 修复内容
- 修改了 `uploadSingleFile` 方法中的路径判断逻辑
- 在判断网络图片时排除 `http://tmp/` 开头的临时文件路径
- 确保 `http://tmp/` 路径的图片能正确上传到云存储

### 修改文件
- `miniprogram/pages/pottery-submission/index.js` 第723行

## 2024年进一步修复图片上传问题

### 问题描述
- 修复后仍然出现图片未上传到云存储的问题
- 经分析发现，除了 `uploadSingleFile` 方法中的判断逻辑外，提交时的判断条件也有问题
- `http://tmp/` 路径在提交时被错误地排除在上传逻辑之外

### 修复内容
- 修改了个人照片上传判断条件（第637行）
- 修改了透视图上传判断条件（第645行）
- 修改了四面图和局部图的过滤逻辑（第651-662行）
- 确保 `http://tmp/` 路径的图片能正确进入上传流程

### 修改文件
- `miniprogram/pages/pottery-submission/index.js` 第637、645、651-662行

## 2025年添加学校省份字段

### 需求描述
- 在参展申请页面添加学校省份字段，以选择器形式输入中国34个省份数据
- 使用数据库中已存在的 `schoolProvinces` 字段存储数据

### 修改内容

#### 1. 前端页面修改
**文件：`miniprogram/pages/pottery-submission/index.wxml`**
- 在学校字段下方添加省份选择器UI组件
- 调整表单布局，将年级和出生年月重新排列

**文件：`miniprogram/pages/pottery-submission/index.js`**
- 在data中添加省份相关字段：
  - `schoolProvince`: 存储选中的省份
  - `schoolProvinceIndex`: 存储省份选择器的索引
  - `provinces`: 存储中国34个省份的数组
- 添加省份选择的事件处理方法 `bindSchoolProvinceChange`
- 在编辑模式中支持省份数据的回显
- 在表单验证中添加省份字段验证
- 在提交数据中包含 `schoolProvinces` 字段

#### 2. 云函数修改
**文件：`cloudfunctions/quickstartFunctions/createPotterySubmission/index.js`**
- 在必填字段验证中添加 `schoolProvinces` 字段
- 在数据库保存时包含 `schoolProvinces` 字段

**文件：`cloudfunctions/quickstartFunctions/updatePotterySubmission/index.js`**
- 在数据库更新时包含 `schoolProvinces` 字段

### 省份数据
包含中国34个省级行政区：
- 23个省：河北、山西、辽宁、吉林、黑龙江、江苏、浙江、安徽、福建、江西、山东、河南、湖北、湖南、广东、海南、四川、贵州、云南、陕西、甘肃、青海、台湾
- 5个自治区：内蒙古、广西、西藏、宁夏、新疆
- 4个直辖市：北京、天津、上海、重庆
- 2个特别行政区：香港、澳门

### 影响分析
- 对其他模块无重大影响
- 使用现有数据库字段，无需修改数据库结构
- 保持向后兼容性

### 修复记录
**问题1**：在调整布局时意外删除了"专业"字段
**修复1**：重新添加专业字段

**问题2**：邮箱字段只占半行，应该占满整行
**修复2**：将邮箱字段改为使用 `form-group` 样式，占满整行

**最终布局**：
- 第一行：姓名 + 性别
- 第二行：所在学校 + 学校省份
- 第三行：年级 + 出生年月
- 第四行：专业 + 联系电话
- 第五行：邮箱（占满整行）
- 第六行：身份证号码（占满整行）

**问题3**：视频作品在详情页面显示"作品图片"部分
**修复3**：在作品查询页面和专家评分页面添加作品类型判断，只有常规作品才显示图片部分
- 修改 `miniprogram/pages/pottery-query/index.wxml` 第155行
- 修改 `miniprogram/pages/expert-scoring/index.wxml` 第12行

**问题4**：视频作品在详情页面显示"作品尺寸"部分
**修复4**：在所有相关页面添加作品类型判断，只有常规作品才显示尺寸部分
- 修改 `miniprogram/pages/pottery-query/index.wxml` 第77、89行
- 修改 `miniprogram/pages/expert-scoring/index.wxml` 第74行
- 修改 `miniprogram/pages/profile/index.wxml` 第96行

**问题5**：申请时间显示不正确
**修复5**：修复时间字段的优先级和格式化逻辑
- 修改 `cloudfunctions/quickstartFunctions/fetchAllSubmissions/index.js` 第37-49行
  - 优先使用 `updatedAt` 字段（更新时间）
  - 其次使用 `createdAt` 字段
  - 最后兼容旧的 `submitTime` 字段
- 修改 `miniprogram/pages/pottery-query/index.wxml` 第177行
  - 调整时间字段显示优先级：`submitTime` > `updatedAt` > `createdAt`

**调试日志添加**：
- 在 `cloudfunctions/quickstartFunctions/fetchAllSubmissions/index.js` 中添加详细的时间字段调试日志
- 在 `miniprogram/pages/pottery-query/index.js` 的 `showDetails` 方法中添加时间字段调试日志
- 可以通过微信开发者工具的控制台查看日志输出，帮助排查时间显示问题

**问题6**：移除参展查询页面的提交时间显示
**修复6**：根据用户要求，移除所有提交时间相关的显示
- 修改 `miniprogram/pages/pottery-query/index.wxml` 第17-26行，移除列表页面的提交时间
- 修改 `miniprogram/pages/pottery-query/index.wxml` 第175-178行，移除详情页面的提交时间
- 修改 `cloudfunctions/quickstartFunctions/fetchAllSubmissions/index.js`，移除时间格式化逻辑
- 修改 `miniprogram/pages/pottery-query/index.js`，移除调试日志

## 2025年添加预约页面字段

### 需求描述
- 在预约页面添加预约人姓名（reservationName）和联系方式（reservationPhone）字段
- 在云函数中写入数据库

### 修改内容

#### 1. 前端页面修改
**文件：`miniprogram/pages/appointment/index.wxml`**
- 在"来访事由"字段上方添加两个新的表单字段：
  - 预约人姓名（必填）
  - 联系方式（必填，支持手机号验证）
- 调整字段顺序：预约人姓名 → 联系方式 → 参观人数 → 来访事由

**文件：`miniprogram/pages/appointment/index.js`**
- 在data中添加新字段：
  - `reservationName`: 预约人姓名
  - `reservationPhone`: 联系方式
- 添加输入事件处理方法：
  - `inputReservationName`: 处理姓名输入
  - `inputReservationPhone`: 处理电话输入
- 在表单验证中添加新字段的验证：
  - 姓名：必填，长度2-20字符
  - 电话：必填，手机号格式验证（11位数字，1开头）
- 在提交数据中包含新字段

#### 2. 云函数修改
**文件：`cloudfunctions/quickstartFunctions/createAppointment/index.js`**
- 在数据验证中添加新字段的必填验证
- 添加手机号格式验证（正则表达式：/^1[3-9]\d{9}$/）
- 添加姓名长度验证（2-20字符）
- 在数据库写入时包含新字段

### 数据库字段
新增字段将存储到 `appointments` 集合中：
- `reservationName`: 预约人姓名（String，2-20字符）
- `reservationPhone`: 联系方式（String，11位手机号）

### 验证规则
- **预约人姓名**：必填，长度2-20字符
- **联系方式**：必填，手机号格式验证（1开头，11位数字）
- **参观人数**：必填，1-100人
- **来访事由**：必填

## 2025年修改预约日历规则

### 需求描述
- 周一不能预约，周二到周日可以预约
- 预约时间段调整为：9-10, 10-11, 11-12, 14-15, 15-16, 16-17

### 修改内容

#### 1. 时间段调整
**文件：`miniprogram/pages/appointment/index.js`**
- 修改 `timeSlots` 配置，添加新的时间段：
  - 09:00-10:00（原有）
  - 10:00-11:00（原有）
  - 11:00-12:00（新增）
  - 14:00-15:00（原有）
  - 15:00-16:00（原有）
  - 16:00-17:00（新增）

#### 2. 日历规则调整
**文件：`miniprogram/pages/appointment/index.js`**
- 修改 `generateDays` 方法中的可用性判断逻辑
- 添加周一不可预约的限制：`isMonday = currentDate.getDay() === 1`
- 更新可用性判断：`available = !isWeekend && !isPast && !isMonday`

### 预约规则
- **可预约日期**：周二到周日（包括周六周日）
- **不可预约日期**：周一、今天及之前的日期
- **预约时间段**：6个时间段，上午3个，下午3个

**修正**：移除了周六周日的限制，现在周六周日也可以预约

## 2025年优化首页公告弹窗排版

### 需求描述
- 优化首页公告弹窗的排版效果，提升用户体验
- 支持富文本内容显示，自动解析公告内容结构
- 保持美观的排版，支持不同长度的公告内容

### 修改内容

#### 1. 弹窗样式优化
**文件：`miniprogram/pages/home/index.wxss`**
- 优化弹窗整体布局，增加内边距和阴影效果
- 添加背景模糊效果（backdrop-filter）
- 改进标题样式，支持长标题换行
- 优化关闭按钮样式，添加交互效果
- 重新设计时间显示区域，添加图标和背景色
- 添加富文本内容样式支持，包括分段、高亮、联系方式等

#### 2. 弹窗模板结构优化
**文件：`miniprogram/pages/home/index.wxml`**
- 重构弹窗内容结构，支持分段显示
- 添加活动主题、活动板块、征集时间、报名方法等结构化字段
- 添加联系方式专用显示区域
- 支持条件渲染，只显示有内容的字段

#### 3. 云函数内容解析功能
**文件：`cloudfunctions/quickstartFunctions/fetchHomeData/index.js`**
- 添加 `parseAnnouncementContent` 函数，自动解析公告内容
- 支持提取以下信息：
  - 活动主题（通过"活动主题："关键词匹配）
  - 活动板块（通过"活动板块："关键词匹配）
  - 征集截止时间（通过"征集截至时间："等关键词匹配）
  - 报名方法（通过"报名方法："关键词匹配）
  - 咨询电话（通过"咨询电话："关键词匹配）
  - 联系人信息（从电话信息中提取）
- 添加时间格式化，显示创建时间
- 保持原始内容完整性，同时提供结构化数据

### 功能特性
1. **自动内容解析**：根据关键词自动提取公告中的结构化信息
2. **分段显示**：将长文本内容按逻辑分段显示
3. **视觉层次**：使用图标、颜色、背景等元素增强视觉层次
4. **响应式布局**：适配不同屏幕尺寸和内容长度
5. **交互优化**：改进关闭按钮和整体交互体验

### 样式改进
- 弹窗圆角从16rpx增加到20rpx
- 添加渐变背景和阴影效果
- 时间显示区域添加图标和背景色
- 联系方式区域使用特殊样式突出显示
- 支持文本换行和自动调整

### 兼容性
- 保持向后兼容，原有公告内容仍能正常显示
- 新功能为增强功能，不影响现有功能
- 支持纯文本和结构化内容混合显示

## 2025年添加PDF文件支持功能

### 需求描述
- 在公告弹窗中添加PDF文件支持，用户可以直接预览PDF文件
- 将指定的PDF文件链接添加到"2025大陶展征集与报名提醒"公告中
- 支持云存储PDF文件的实时显示和预览

### 修改内容

#### 1. 云函数PDF支持
**文件：`cloudfunctions/quickstartFunctions/fetchHomeData/index.js`**
- 在 `parseAnnouncementContent` 函数中添加PDF文件字段支持
- 添加 `pdfFiles` 和 `attachments` 字段到返回结果中
- 为"2025大陶展征集与报名提醒"公告自动添加PDF文件：
  - 文件名：首页第一张.pdf
  - 云存储链接：cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268/首页资料/首页第一张.pdf
  - 文件大小：2.5MB

#### 2. 前端PDF预览功能
**文件：`miniprogram/pages/home/index.js`**
- 添加 `previewPDF` 方法：处理PDF文件预览
- 添加 `openPDFDocument` 方法：打开PDF文档
- 添加 `openAttachment` 方法：处理其他附件打开
- 支持云存储链接自动转换为临时访问链接
- 支持PDF文件下载和预览

#### 3. 弹窗模板更新
**文件：`miniprogram/pages/home/index.wxml`**
- 添加PDF文件显示区域
- 添加其他附件显示区域
- 支持条件渲染，只显示有内容的字段
- 添加点击事件绑定

#### 4. PDF样式设计
**文件：`miniprogram/pages/home/index.wxss`**
- 添加PDF文件列表样式
- 添加附件列表样式
- 支持文件图标、名称、大小显示
- 添加点击交互效果

### 功能特性

#### PDF预览功能
1. **云存储支持**：自动处理云存储链接，获取临时访问链接
2. **文件下载**：支持PDF文件下载到本地
3. **原生预览**：使用微信小程序原生PDF预览功能
4. **错误处理**：完善的错误提示和异常处理

#### 附件管理
1. **多类型支持**：支持PDF、图片、其他文件类型
2. **统一界面**：PDF和附件使用统一的显示界面
3. **交互优化**：点击效果和加载提示
4. **文件信息**：显示文件名、大小、类型等信息

### 技术实现

#### 云存储处理
```javascript
// 自动检测云存储链接并转换
if (url.startsWith('cloud://')) {
  wx.cloud.getTempFileURL({
    fileList: [url],
    success: res => {
      // 使用临时访问链接
    }
  });
}
```

#### PDF预览
```javascript
// 下载并预览PDF
wx.downloadFile({
  url: url,
  success: function(res) {
    wx.openDocument({
      filePath: res.tempFilePath,
      fileType: 'pdf'
    });
  }
});
```

### 用户体验
- **无缝预览**：在弹窗中直接点击即可预览PDF
- **加载提示**：显示"正在加载PDF..."提示
- **错误处理**：完善的错误提示信息
- **文件信息**：显示文件名和大小信息

### 测试数据
已为"2025大陶展征集与报名提醒"公告添加测试PDF文件：
- 文件路径：首页资料/首页第一张.pdf
- 云存储ID：jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268
- 文件大小：2.5MB

## 2025年移除征集截止时间显示

### 需求描述
- 根据用户反馈，移除公告弹窗中的"征集截止时间"部分
- 该部分内容表述不准确，需要完全移除

### 修改内容

#### 1. 云函数修改
**文件：`cloudfunctions/quickstartFunctions/fetchHomeData/index.js`**
- 移除 `parseAnnouncementContent` 函数中的征集截止时间提取逻辑
- 从返回结果中移除 `deadline` 字段
- 简化内容解析逻辑

#### 2. 前端模板修改
**文件：`miniprogram/pages/home/index.wxml`**
- 移除征集截止时间的显示区域
- 移除相关的条件渲染逻辑
- 保持其他内容区域不变

### 影响范围
- 公告弹窗不再显示"征集截止时间"部分
- 其他功能（活动主题、活动板块、报名方法、联系方式、PDF文件等）保持不变
- 向后兼容，不影响现有数据

## 2025年修改大陶展专区按钮文字

### 需求描述
- 将大陶展专区中"省优推选"按钮的文字改为"推选入口"
- 保持按钮功能和样式不变

### 修改内容

#### 前端页面修改
**文件：`miniprogram/pages/pottery-exhibition/index.wxml`**
- 第26行：将按钮文字从"省优推送"改为"推选入口"
- 保持按钮的点击事件和样式不变

### 修改结果
- 大陶展专区第一个按钮现在显示"推选入口"
- 按钮功能保持不变，仍然跳转到作品提交页面
- 其他按钮（参展查询、作品运送、专家评选）文字保持不变

## 2025年修改作品运送页面字段标签

### 需求描述
- 将作品运送信息提交页面中的"姓名"字段标签改为"作者姓名"
- 同时修改对应的输入框提示文字

### 修改内容

#### 前端页面修改
**文件：`miniprogram/pages/artwork-delivery/index.wxml`**
- 第18行：将字段标签从"姓名"改为"作者姓名"
- 第19行：将输入框placeholder从"请输入姓名"改为"请输入作者姓名"

### 修改结果
- 作品运送信息提交页面的姓名字段现在显示为"作者姓名"
- 输入框提示文字也相应更新为"请输入作者姓名"
- 字段功能和验证逻辑保持不变

## 2025年添加作品运送时间限制功能

### 需求描述
- 为作品运送功能添加时间限制，根据timeLimit数据库的deliveryBeginTime和deliveryEndTime字段判断是否可以进入
- 如果不在时间范围内，则弹窗提示用户

### 修改内容

#### 1. 创建云函数
**文件：`cloudfunctions/quickstartFunctions/getDeliveryTimeLimit/index.js`**
- 新建云函数用于获取作品运送时间限制配置
- 从timeLimit集合读取deliveryBeginTime和deliveryEndTime字段
- 返回时间配置信息给前端

#### 2. 更新云函数主入口
**文件：`cloudfunctions/quickstartFunctions/index.js`**
- 添加getDeliveryTimeLimit云函数的引用
- 在switch语句中添加getDeliveryTimeLimit的case处理

#### 3. 修改作品运送跳转逻辑
**文件：`miniprogram/pages/pottery-exhibition/index.js`**
- 修改navigateToDelivery方法，添加时间验证逻辑
- 在跳转前先调用云函数获取时间限制配置
- 根据当前时间与配置时间进行比较：
  - 如果未配置时间：提示"尚未配置作品运送时间"
  - 如果时间未到：提示"作品运送尚未开始，开始时间：xxx"
  - 如果时间已过：提示"作品运送已结束，结束时间：xxx"
  - 如果在时间范围内：正常跳转到作品运送页面

### 功能特性

#### 时间验证逻辑
1. **配置检查**：验证timeLimit集合中是否存在deliveryBeginTime和deliveryEndTime
2. **时间解析**：将时间字符串解析为时间戳进行比较
3. **状态判断**：
   - 未开始：当前时间 < 开始时间
   - 进行中：开始时间 ≤ 当前时间 ≤ 结束时间
   - 已结束：当前时间 > 结束时间

#### 用户体验
- **加载提示**：显示"校验运送时间..."加载状态
- **错误处理**：网络异常时显示"网络异常，请重试"
- **时间显示**：使用本地化日期格式显示开始/结束时间
- **友好提示**：根据不同情况显示相应的提示信息

### 数据库配置

#### timeLimit集合结构
```json
{
  "_id": "自动生成的文档ID",
  "deliveryBeginTime": "2025-01-01T00:00:00.000Z",
  "deliveryEndTime": "2025-12-31T23:59:59.000Z",
  "submissionBeginDeadline": "2025-01-01T00:00:00.000Z",
  "submissionEndDeadline": "2025-12-31T23:59:59.000Z",
  "note": "时间限制说明"
}
```

**字段说明**：
- `deliveryBeginTime`: 运送开始时间
- `deliveryEndTime`: 运送截止时间  
- `submissionBeginDeadline`: 提交开始时间
- `submissionEndDeadline`: 提交结束时间

### 使用方式
1. 管理员在云开发控制台的timeLimit集合中配置deliveryBeginTime和deliveryEndTime
2. 用户点击"作品运送"按钮时，系统自动验证当前时间是否在允许范围内
3. 根据验证结果决定是否允许进入作品运送页面

### 兼容性
- 保持向后兼容，如果未配置时间限制，会提示用户联系管理员
- 不影响其他功能模块的正常使用
- 时间验证失败时不会影响其他按钮的功能

## 2025年分析用户隐私保护审核问题

### 问题描述
- 用户询问在提交代码审核时，关于"用户隐私保护"选项是否应该勾选
- 需要分析项目中收集的用户个人信息类型和隐私保护措施

### 项目个人信息收集分析

#### 1. 收集的个人信息类型
**参展申请页面（pottery-submission）**：
- 姓名（name）
- 性别（gender）
- 出生年月（birthDate）
- 学校名称（school）
- 学校省份（schoolProvinces）
- 年级（grade）
- 专业（major）
- 联系电话（phone）
- 邮箱（email）
- 身份证号码（idNumber）
- 指导教师（teacher）
- 教师电话（teacherPhone）
- 地址（address）
- 个人照片（photoUrl）

**预约页面（appointment）**：
- 预约人姓名（reservationName）
- 联系方式（reservationPhone）

**专家登录**：
- 专家姓名（expertName）
- 专家验证码（expertCode）

#### 2. 隐私保护措施
**技术保护**：
- 使用微信云开发，数据存储在腾讯云服务器
- 使用openid作为用户唯一标识，不直接暴露用户微信信息
- 云函数中使用管理员权限进行数据库操作
- 图片上传到云存储，使用HTTPS链接

**数据使用**：
- 个人信息仅用于参展申请和作品评选
- 专家信息仅用于身份验证和评分记录
- 预约信息仅用于参观预约管理

#### 3. 审核建议
**建议勾选"用户隐私保护"选项**，原因如下：

1. **收集敏感信息**：项目收集身份证号码、手机号、邮箱等敏感个人信息
2. **涉及用户身份**：需要用户提供真实姓名、学校、专业等身份信息
3. **存储个人数据**：在云数据库中存储大量用户个人信息
4. **处理个人照片**：收集并存储用户个人照片
5. **符合审核要求**：微信小程序审核要求收集个人信息的应用必须勾选此选项

#### 4. 隐私保护建议
- 在app.json中添加隐私政策页面配置
- 在用户提交信息前显示隐私政策同意页面
- 明确告知用户信息收集目的和使用范围
- 提供用户数据删除和修改功能
- 定期清理过期数据

### 结论
**应该勾选"用户隐私保护"选项**，因为项目收集了身份证号、手机号、邮箱等敏感个人信息，符合微信小程序审核要求。