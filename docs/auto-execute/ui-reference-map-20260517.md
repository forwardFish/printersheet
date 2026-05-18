# 小程序视觉基准图映射

日期：2026-05-17

本轮 UI 复刻以 `docs/UI/小程序/ChatGPT Image 2026年5月17日 21_13_*.png` 为主视觉源稿。旧版 2026-05-16 参考图仅作为历史素材，不参与本轮 90+ 视觉评分。

| 页面 | 主参考图 | 实现入口 | 重点验收 |
| --- | --- | --- | --- |
| 登录页 | `ChatGPT Image 2026年5月17日 21_13_20 (8).png` | `ai-exam-miniapp/miniprogram/pages/login` | 顶部状态栏、中心 logo、标题字号、绿色微信按钮、协议区 |
| 首页 | `ChatGPT Image 2026年5月17日 21_13_21 (10).png` | `ai-exam-miniapp/miniprogram/pages/index` | hero、点数条、输入框、选择器、更多选项、底部 tab |
| 预览页 | `ChatGPT Image 2026年5月17日 21_13_21 (9).png` | `ai-exam-miniapp/miniprogram/pages/preview` | tab、纸张卡片、题目排版、下载卡、升级条 |
| 套餐页 | `ChatGPT Image 2026年5月17日 21_13_18 (3).png` | `ai-exam-miniapp/miniprogram/pages/packages` | 顶部 banner、套餐卡、价格、推荐标、选中态 |
| 订单页 | `ChatGPT Image 2026年5月17日 21_13_20 (7).png` | `ai-exam-miniapp/miniprogram/pages/order` | 商品卡、订单金额、支付方式、安全提示、底部协议 |
| 我的页 | `ChatGPT Image 2026年5月17日 21_13_19 (6).png` | `ai-exam-miniapp/miniprogram/pages/my` | 用户区、会员卡、点数卡、赚点数卡、记录卡、底部 tab |
| 其他/更多页 | 无独立 21:13 源稿 | `ai-exam-miniapp/miniprogram/pages/more` | 沿用公共底部 tab 和卡片视觉 |
| 记录页 | 无独立 21:13 源稿 | `ai-exam-miniapp/miniprogram/pages/records` | 沿用我的页列表入口视觉 |
| 购买记录页 | 无独立 21:13 源稿 | `ai-exam-miniapp/miniprogram/pages/purchase-records` | 沿用我的页列表入口视觉 |

验收口径：
- `90+`：可声明视觉通过。
- `80-89`：继续按差异项迭代。
- 无微信开发者工具真实截图时，只能标记 `PASS_NEEDS_MANUAL_UI_REVIEW`，不能声明 pixel-perfect PASS。
