# printersheet 项目状态

最后更新：2026-05-16  
当前任务：Task 10 全流程测试、截图验收、最终修复、交付报告  
当前结论：`PASS_WITH_LIMITATION`

## 当前技术栈

- 前端：微信原生小程序
- 前端目录：`D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram`
- 后端：Node.js 18+、Express、ESM
- 后端目录：`D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server`
- 数据：小程序本地缓存；未接数据库
- AI：服务端 OpenAI-compatible API；环境变量为 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`AI_MOCK_MODE`
- 文件：上传文件临时解析；生成 PDF/DOCX 临时文件通过 `/files/*` 访问，当前策略为 30 分钟静态缓存和定时清理

## 运行命令

后端：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm install
Copy-Item .env.example .env
npm run dev
```

默认地址：

```text
http://127.0.0.1:8787
```

小程序：

```text
微信开发者工具导入：
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram
```

本地调试前检查：

```text
miniprogram/utils/config.js
API_BASE_URL: http://127.0.0.1:8787
USE_MOCK_API: false
```

## 测试命令

后端自动化测试：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
```

JS 静态语法检查：

```powershell
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
foreach ($f in $files) { node --check $f }
```

server smoke：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
$env:PORT='8799'
$env:PUBLIC_BASE_URL='http://127.0.0.1:8799'
$env:AI_MOCK_MODE='true'
npm run start
```

## 最新验证证据

Task 10 已执行：

```text
node --check => PASS 26 JS files
npm test => tests 10, pass 10, fail 0
server smoke => health_ok=True
text generate => generate_success=True, source=mock, question_count=10, points_used=1
PDF export => HEAD 200
DOCX export => HEAD 200
plans => month_count=3, year_count=3
mock purchase => paymentStatus=paid, pointsAdded=150
secret guard => miniprogram has no AI_API_KEY / AI_BASE_URL / AI_MODEL
```

微信开发者工具 CLI 探测：

```text
C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat => missing
C:\Program Files\Tencent\微信web开发者工具\cli.bat => missing
C:\Program Files (x86)\Tencent\微信开发者工具\cli.bat => missing
C:\Program Files\Tencent\微信开发者工具\cli.bat => missing
```

因此本轮未完成真实小程序点击、截图和 `wx.openDocument` 运行态验证。

## 页面列表

| 页面 | 路径 | 当前状态 |
| --- | --- | --- |
| 首页 / 生成页 | `pages/index/index` | 已实现文本生成、上传入口、点数展示、最近结果入口；待开发者工具截图验收 |
| 练习卷预览 | `pages/preview/preview` | 已实现学生版、答案解析版、PDF/DOCX 导出路径、Word 会员提示；待开发者工具点击验收 |
| 登录 | `pages/login/login` | MVP 本地模拟登录 |
| 套餐 | `pages/packages/packages` | 已展示套餐、当前点数和会员状态 |
| 订单 | `pages/order/order` | 已支持本地模拟支付后点数、会员状态和购买记录写入 |
| 我的 | `pages/my/my` | 已展示点数、会员状态、生成记录和购买记录入口 |
| 更多 | `pages/more/more` | 基础入口已存在 |
| 生成记录 | `pages/records/records` | 已支持本地记录和再次打开历史练习卷 |
| 购买记录 | `pages/purchase-records/purchase-records` | 已支持本地购买记录展示 |

## 接口列表

| 接口 | 方法 | 状态 |
| --- | --- | --- |
| `/health` | GET | PASS |
| `/api/worksheet/generate` | POST | PASS，文本和上传入口 |
| `/api/generate` | POST | PASS，兼容入口 |
| `/api/export/pdf` | POST | PASS，二进制和 URL 模式 |
| `/api/export/docx` | POST | PASS，二进制和 URL 模式 |
| `/api/plans` | GET | PASS |
| `/api/purchases/mock` | POST | PASS |
| `/files/*` | GET | PASS_WITH_LIMITATION，HTTP 可访问，TTL 仍需长时间运行观察 |

## 已完成能力

- 微信原生小程序项目骨架
- Node/Express 后端骨架
- 首页文字输入生成入口
- 上传 PDF / Word / 图片入口
- 服务端 PDF/DOCX 文本解析策略
- 图片 OCR placeholder 降级
- 上传文件类型/大小错误处理
- 上传临时文件解析后清理测试覆盖
- AI 调用封装和 mock fallback
- 统一 Worksheet / Question / PaperBlueprint 合同
- mock 默认生成初一数学一元一次方程题，包含答案、解析、answerKey、cost、paperBlueprint
- 小程序 API client：`generateWorksheet`、`exportPdf`、`exportDocx`、`getPlans`、`createMockPurchase`、`downloadAndOpen`
- 预览页学生版 / 答案解析版
- 整卷仿真模式数据和成本策略
- PDF/DOCX 生成接口
- 小程序 PDF 按需导出、下载、`wx.openDocument` 代码路径
- 小程序 Word 会员付费墙和会员导出代码路径
- 本地 2 点免费额度
- 点数不足升级提示代码路径
- 套餐页、订单页、本地模拟支付
- 生成记录和购买记录本地缓存
- 服务端套餐和模拟购买接口
- 小程序端密钥守卫

## 缺失或限制

- 未完成微信开发者工具真实页面点击、截图或 `wx` API 运行态验证。
- 未完成 6 张 UI 设计图的实际截图对比。
- 未实际验证微信运行时的 `wx.downloadFile` / `wx.openDocument` 文件预览效果。
- 未接真实微信登录 / openid。
- 未接真实微信支付。
- 未接服务端账户、点数、会员、订单持久化。
- 图片 OCR 和扫描 PDF OCR 未接入。
- 真实 AI 输出质量和数学正确性未系统验证。
- 套餐价格和权益需要产品最终确认。
- PDF 无水印权限和 Word 导出权限当前主要由前端本地会员状态控制，生产前需要后端鉴权。
- 生成文件 `/files/*` 30 分钟过期清理仍需运行态长时间验证。

## 当前文档

- `docs/auto-execute/01-audit-report.md`
- `docs/auto-execute/02-ui-inventory.md`
- `docs/auto-execute/03-api-contract.md`
- `docs/auto-execute/04-test-plan.md`
- `docs/auto-execute/task-01-report.md`
- `docs/auto-execute/task-02-report.md`
- `docs/auto-execute/task-03-report.md`
- `docs/auto-execute/task-04-report.md`
- `docs/auto-execute/task-05-report.md`
- `docs/auto-execute/task-06-report.md`
- `docs/auto-execute/task-07-report.md`
- `docs/auto-execute/task-08-report.md`
- `docs/auto-execute/task-09-report.md`
- `docs/auto-execute/task-10-report.md`
- `docs/auto-execute/final-acceptance-report.md`
- `docs/auto-execute/project-state.md`

## 下一步建议

1. 在安装了微信开发者工具的环境中导入小程序并进行手工点击验收。
2. 保存 6 张核心页面实际截图到 `docs/auto-execute/screenshots/`。
3. 对照 `docs/UI/` 做人工 UI 差异说明。
4. 生产前补服务端鉴权、真实支付回调、账户/点数/会员持久化和上传安全策略。
