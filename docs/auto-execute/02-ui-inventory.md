# Task 01 UI 资产盘点与页面映射

生成日期：2026-05-16  
UI 目录：`docs/UI/`

## UI 参考资产

| 序号 | 文件 | 尺寸 | 推断页面 | 当前实现目标 |
| --- | --- | --- | --- | --- |
| UI-01 | `ChatGPT Image 2026年5月16日 11_37_32 (1).png` | 941 x 1672 | 首页/核心生成页 | `miniprogram/pages/index` |
| UI-02 | `ChatGPT Image 2026年5月16日 11_37_32 (2).png` | 941 x 1672 | 练习卷预览页 | `miniprogram/pages/preview` |
| UI-03 | `ChatGPT Image 2026年5月16日 11_37_33 (3).png` | 941 x 1672 | 选择套餐页 | `miniprogram/pages/packages` |
| UI-04 | `ChatGPT Image 2026年5月16日 11_37_33 (4).png` | 941 x 1672 | 登录页 | `miniprogram/pages/login` |
| UI-05 | `ChatGPT Image 2026年5月16日 11_37_34 (5).png` | 941 x 1672 | 确认订单页 | `miniprogram/pages/order` |
| UI-06 | `ChatGPT Image 2026年5月16日 11_48_53.png` | 941 x 1672 | 我的页 | `miniprogram/pages/my` |
| UI-CS | `_contact_sheet.png` | 960 x 1240 | 6 张 UI 总览 | 审计辅助 |

`docs/UI/backup/` 下还有 2 张历史 UI 备份图，本轮 Task 01 未作为主参考图。

## 视觉要点

### UI-01 首页/核心生成页

核心元素：

- 自定义顶部标题：`AI出题小助手`。
- 大 banner，左侧标题和描述，右侧试卷/AI 插画。
- 剩余点数条和升级入口。
- 大输入框，300 字计数。
- 年级/科目/难度三项快捷选择。
- 更多选项。
- 主按钮：一键生成练习卷。
- 上传资料卡片：PDF / Word / 图片。
- 底部 tab：首页、我的、更多。

当前实现映射：

- `pages/index/index.wxml` 覆盖输入、点数、选项、上传、生成按钮和底部 tab。
- `pages/index/index.js` 覆盖 `chooseGrade`、`chooseSubject`、`chooseDifficulty`、`chooseFile`、`handleGenerate`。
- `assets/hero-banner.png` 对应 banner。

主要待验证：

- 真机/开发者工具中自定义导航栏与系统胶囊是否和参考图高度一致。
- 中文文案是否没有乱码。
- 输入框、按钮、上传卡片在小屏下是否不挤压。

### UI-02 练习卷预览页

核心元素：

- 顶部返回和标题。
- `学生练习版` / `答案解析版` tab。
- 白色纸张卡片，含试卷标题、班级/姓名/得分、题目列表、页码。
- PDF/Word 下载卡片。
- 重新生成按钮。
- 会员升级卡片。

当前实现映射：

- `pages/preview/preview.wxml` 覆盖 tab、纸张预览、题目分组、答案解析、下载卡片、重新生成和升级卡片。
- `pages/preview/preview.js` 读取 `getApp().globalData.lastWorksheet`，非会员点击 Word 会弹升级提示。

主要待验证：

- PDF/Word URL 为空时是否出现可理解提示。
- 题目多于一屏时滚动体验和纸张视觉是否接近参考图。
- 答案解析 tab 的排版是否符合“可打印”感。

### UI-03 选择套餐页

核心元素：

- 顶部标题：选择套餐。
- 会员权益 banner。
- 按月/按年切换。
- 基础版/标准版/高级版套餐卡。
- 推荐标识、选中态、价格、权益列表。
- 底部立即升级按钮。

当前实现映射：

- `pages/packages/packages.js` 定义年付和月付套餐。
- `pages/packages/packages.wxml/.wxss` 负责卡片、切换、选中态。
- 选择套餐后进入 `pages/order/order`。

主要待验证：

- UI 图展示年付价格 19.9/39.9/79.9，PRD 推荐月付 9.9/19.9/39.9 和 Teacher 39.9/月。后续需确认价格口径。
- 套餐权益是否与 PRD 的 Free/Starter/Pro/Teacher 一致。

### UI-04 登录页

核心元素：

- 顶部标题。
- 居中 logo。
- 标题和登录提示。
- 绿色微信一键登录按钮。
- 协议勾选。

当前实现映射：

- `pages/login/login`。
- `utils/storage.js` 记录本地用户。

主要待验证：

- 当前是本地模拟登录，不是真实 `wx.login`/openid。
- 协议和隐私链接是入口型 UI，需确认是否有真实内容页。

### UI-05 确认订单页

核心元素：

- 顶部标题：确认订单。
- 会员套餐卡。
- 订单信息、商品金额、优惠券、实付款。
- 支付方式：微信支付、余额支付。
- 支付安全提示。
- 底部支付按钮和协议勾选。

当前实现映射：

- `pages/order/order.js` 本地模拟支付，发放点数和会员。
- `storage.addPurchase` 写入本地购买记录。

主要待验证：

- 真实微信支付不在 MVP 当前实现内。
- 支付按钮文案和金额是否随套餐正确变动。

### UI-06 我的页

核心元素：

- 用户头像、昵称、ID。
- 会员卡片。
- 剩余点数卡片和购买按钮。
- 生成记录、购买记录入口。
- 推广 banner。
- 底部 tab。

当前实现映射：

- `pages/my/my`。
- `pages/records/records` 和 `pages/purchase-records/purchase-records` 提供列表页。
- `storage.getPoints/getMember/getRecords/getPurchases` 提供本地数据。

主要待验证：

- 未登录状态是否按预期跳转登录。
- 空记录状态是否合理。
- 会员过期显示是否和 UI 图一致。

## 无独立 UI 参考但代码已有的页面

| 页面 | 现有实现 | UI 依据 |
| --- | --- | --- |
| 更多页 | `pages/more` | 底部 tab 延伸页面，按现有风格即可 |
| 生成记录 | `pages/records` | PRD 要求生成记录；参考“我的页”入口风格 |
| 购买记录 | `pages/purchase-records` | PRD 要求购买记录；参考“我的页”入口风格 |

## UI 验收建议

后续 Task 04/10 需要补充实际截图：

1. 用微信开发者工具分别打开首页、预览、套餐、登录、订单、我的页。
2. 以 941 x 1672 参考图比例做移动端截图。
3. 保存到 `docs/auto-execute/screenshots/`。
4. 对每张图标注：
   - 结构是否一致。
   - 主视觉是否一致。
   - 文案是否无乱码。
   - 间距/圆角/阴影是否明显偏离。
   - 状态栏和胶囊按钮差异是否属于微信平台差异。

Task 01 未做像素对比，也未声明 UI pixel-perfect PASS。
