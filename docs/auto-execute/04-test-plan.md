# Task 01 测试与验收计划

生成日期：2026-05-16

## 本轮已执行检查

Task 01 只做审计，不启动 server，不运行 `npm test`。已执行静态检查：

```powershell
cd D:\lyh\agent\agent-frame\printersheet
node --check ai-exam-miniapp\server\src\index.js
node --check ai-exam-miniapp\miniprogram\pages\index\index.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('ai-exam-miniapp/server/package.json','utf8')); JSON.parse(fs.readFileSync('ai-exam-miniapp/miniprogram/app.json','utf8')); console.log('json ok')"
```

批量 JS 语法检查：

```powershell
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
$failures = @()
foreach ($f in $files) {
  node --check $f 2>&1 | ForEach-Object { if ($_){ $failures += "$f :: $_" } }
}
if ($failures.Count) { $failures | Select-Object -First 80 } else { 'node --check PASS for JS files: ' + ($files | Measure-Object).Count }
```

结果：

```text
json ok
node --check PASS for JS files: 24
```

## Task 02 基础运行验证

目标：证明后端依赖、测试、临时目录、PDF/DOCX 生成和 API 基础可用。

建议命令：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm install
npm test
```

预期：

- `GET /health` 返回 `{ ok: true }`。
- 文本生成返回 worksheet、cost、source、pdfUrl、wordUrl。
- PDF 上传生成 worksheet，并清理 upload 临时文件。
- DOCX 上传生成 worksheet，并清理 upload 临时文件。
- `/api/export/pdf` 返回 PDF 二进制或 URL。
- `/api/export/docx` 返回 DOCX 二进制或 URL。
- 点数规则：普通 10 题 1 点，20 题 2 点，整卷仿真固定 10 点。
- 小程序前端文件不出现 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`。

若失败，Task 02 只修复基础运行问题，不做大功能。

## API 手工 smoke 计划

启动后端：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm run dev
```

健康检查：

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health'
```

文本生成：

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:8787/api/generate' `
  -ContentType 'application/json' `
  -Body (@{
    prompt = '生成 10 道初一数学一元一次方程中等题，带答案解析，适合打印'
    grade = '初一'
    subject = '数学'
    difficulty = '中等'
    mode = 'practice'
    questionCount = 10
  } | ConvertTo-Json)
```

导出 PDF URL：

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:8787/api/export/pdf?returnUrl=1' `
  -ContentType 'application/json' `
  -Body (@{ worksheet = $worksheet } | ConvertTo-Json -Depth 20)
```

导出 DOCX URL：

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:8787/api/export/docx?returnUrl=1' `
  -ContentType 'application/json' `
  -Body (@{ worksheet = $worksheet } | ConvertTo-Json -Depth 20)
```

## 小程序手工验收计划

环境：

- 微信开发者工具。
- 导入 `D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram`。
- 本地设置勾选“不校验合法域名”。
- 后端运行在 `http://127.0.0.1:8787`。

主流程：

1. 打开首页。
2. 输入：`生成 10 道初一数学一元一次方程中等题，带答案解析，适合打印`。
3. 点击一键生成练习卷。
4. 确认进入预览页。
5. 查看学生练习版。
6. 切换答案解析版。
7. 点击下载 PDF，确认 `wx.downloadFile + wx.openDocument` 可打开。
8. 非会员点击 Word，确认出现升级提示。
9. 升级后或模拟会员状态下点击 Word，确认可打开 DOCX。
10. 回到首页上传 PDF/DOCX，再生成练习卷。
11. 上传图片，确认 OCR 未启用时有明确降级逻辑或提示。
12. 切换整卷仿真模式，不上传文件时应提示需要上传试卷。
13. 连续生成验证点数扣减。
14. 点数不足时应跳转或提示升级。
15. 打开套餐页、订单页、我的页、生成记录、购买记录。

## UI 验收计划

必须覆盖 6 张主 UI：

- 首页：`docs/UI/ChatGPT Image 2026年5月16日 11_37_32 (1).png`
- 预览页：`docs/UI/ChatGPT Image 2026年5月16日 11_37_32 (2).png`
- 套餐页：`docs/UI/ChatGPT Image 2026年5月16日 11_37_33 (3).png`
- 登录页：`docs/UI/ChatGPT Image 2026年5月16日 11_37_33 (4).png`
- 订单页：`docs/UI/ChatGPT Image 2026年5月16日 11_37_34 (5).png`
- 我的页：`docs/UI/ChatGPT Image 2026年5月16日 11_48_53.png`

截图输出建议：

```text
docs/auto-execute/screenshots/home.png
docs/auto-execute/screenshots/preview.png
docs/auto-execute/screenshots/packages.png
docs/auto-execute/screenshots/login.png
docs/auto-execute/screenshots/order.png
docs/auto-execute/screenshots/my.png
```

验收口径：

- 结构一致：必需。
- 主视觉接近：必需。
- 文案无乱码：必需。
- 微信系统状态栏和胶囊按钮差异：可接受。
- 像素级一致：需要截图和 diff 工具，本轮不声明。

## PRD 验收矩阵

| ID | 验收项 | 类型 | 验收方法 | 当前 Task 01 状态 |
| --- | --- | --- | --- | --- |
| P0-01 | 首页可打开 | UI | 微信开发者工具打开首页 | 待运行 |
| P0-02 | 文本输入可生成试题 | API/UI | 输入 prompt，点击生成 | 待运行 |
| P0-03 | 上传 PDF/Word 后可生成试题 | API/UI | 上传文件并生成 | 待运行 |
| P0-04 | 图片上传有可理解降级 | UI/API | 上传图片并检查提示/生成链路 | 待运行 |
| P0-05 | 试题结果可预览 | UI | 预览页检查题目 | 待运行 |
| P0-06 | 答案解析可查看 | UI | 切换答案解析 tab | 待运行 |
| P0-07 | PDF 可导出/打开 | API/UI | 点击 PDF | 待运行 |
| P0-08 | Word 可导出或付费提示 | API/UI | 点击 Word | 待运行 |
| P0-09 | 免费点数可扣减 | State | 连续生成检查点数 | 待运行 |
| P0-10 | 点数不足出现付费提示 | State/UI | 消耗点数后生成 | 待运行 |
| P0-11 | 定价/购买入口可打开 | UI | 进入套餐和订单页 | 待运行 |
| P0-12 | 生成记录可查看 | State/UI | 生成后打开记录页 | 待运行 |
| P0-13 | 购买记录可查看 | State/UI | 模拟购买后打开记录页 | 待运行 |
| P0-14 | 整卷仿真简版可触发 | UI/API | paper mode + 上传文件 | 待运行 |
| P0-15 | API Key 不在前端 | Security | grep/测试 secret guard | 静态计划已列 |
| P0-16 | 上传文件不长期保存 | Security/API | 测试上传清理和生成文件 TTL | 待运行 |

## 停止条件

后续任务不能声称纯 PASS，除非同时满足：

1. `npm test` 通过。
2. 小程序主流程在开发者工具中跑通。
3. 6 张 UI 都有当前实际截图。
4. PDF/DOCX 文件能实际打开。
5. 上传文件临时清理有测试证据。
6. 前端无 AI 密钥。
7. 真实未接入能力用 `PASS_WITH_LIMITATION` 或 `MANUAL_REVIEW_REQUIRED` 标注。
