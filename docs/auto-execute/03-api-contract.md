# Task 03 API 合同

最后更新：2026-05-16  
范围：Worksheet / Question / PaperBlueprint 数据结构、小程序 API client、服务端 mock fallback、套餐和模拟购买合同。

## 1. 统一数据模型

### Worksheet

```json
{
  "title": "初一数学一元一次方程练习卷",
  "grade": "初一",
  "subject": "数学",
  "mode": "practice",
  "questions": [],
  "answerKey": [],
  "cost": {
    "pointsUsed": 1,
    "ocrPages": 0,
    "wordExportRequired": false
  },
  "sourceFileInfo": {
    "name": "sample.pdf",
    "type": "application/pdf",
    "size": 1024,
    "parsedTextLength": 120,
    "parserStatus": "parsed"
  },
  "paperBlueprint": {}
}
```

字段规则：

- `mode` 只允许 `practice` 或 `exam_simulation`。旧字段 `paper`、`simulation`、`exam` 会 normalize 为 `exam_simulation`。
- `questions` 必须至少 1 道题。
- `answerKey` 必须与 `questions` 一一对应。
- `cost.pointsUsed` 使用点数合同：10 题以内普通练习 1 点，10 题以上普通练习 2 点，整卷仿真固定 10 点。
- `sourceFileInfo` 仅在上传文件生成时返回；纯文本 prompt 可为空。

### Question

```json
{
  "number": 1,
  "section": "一、选择题（每题 3 分，共 15 分）",
  "type": "选择题",
  "difficulty": "中等",
  "skill": "一元一次方程",
  "question": "方程 2x-1=5 的解是（    ）",
  "options": ["A. x=2", "B. x=3", "C. x=4", "D. x=5"],
  "answer": "B",
  "explanation": "2x-1=5，两边加 1 得 2x=6，所以 x=3。"
}
```

校验规则：

- `question`、`answer`、`explanation` 必填。
- `options` 可为空数组；选择题建议提供 4 个选项。
- `number` 由 normalize 按数组顺序兜底生成。

### PaperBlueprint

```json
{
  "sourceType": "prompt_or_upload",
  "totalQuestions": 10,
  "targetDifficulty": "中等",
  "similarityGoal": "题型结构、知识点和难度相似，不复制原题",
  "sections": [
    {
      "name": "一、选择题（每题 3 分，共 15 分）",
      "type": "选择题",
      "questionCount": 5,
      "difficulty": "中等",
      "skills": ["一元一次方程概念", "解一元一次方程"]
    }
  ]
}
```

用途：

- 普通练习：记录生成结构，供预览和后续测试读取。
- 整卷仿真：记录上传资料/试卷对应的题型结构、知识点、难度和相似目标。

## 2. 服务端 API

基础地址：`http://127.0.0.1:8787`

| 接口 | 方法 | 请求 | 响应重点 |
| --- | --- | --- | --- |
| `/health` | GET | 无 | `{ ok: true }` |
| `/api/worksheet/generate` | POST JSON 或 multipart | `prompt, grade, subject, difficulty, mode, questionCount, file?` | `success, worksheetId, worksheet, source, pointsUsed, cost, pdfUrl, wordUrl` |
| `/api/generate` | POST JSON 或 multipart | 同上，PRD 兼容入口 | 同上 |
| `/api/export/pdf?returnUrl=1` | POST JSON | `{ worksheet, watermark }` | `{ success, pdfUrl }` |
| `/api/export/docx?returnUrl=1` | POST JSON | `{ worksheet }` | `{ success, wordUrl }` |
| `/api/plans` | GET | 无 | `{ success, plans: { month, year } }` |
| `/api/purchases/mock` | POST JSON | `{ planId }` | `{ success, orderId, paymentStatus, plan, member, pointsAdded, paidAt }` |
| `/files/*` | GET | 临时文件路径 | PDF/DOCX 文件 |

错误响应：

```json
{ "success": false, "message": "错误原因" }
```

## 3. 小程序 API Client

文件：`ai-exam-miniapp/miniprogram/services/api.js`

已封装：

- `generateWorksheet(params)`
- `exportPdf(worksheet, options)`
- `exportDocx(worksheet)`
- `getPlans()`
- `createMockPurchase(planId)`
- `downloadAndOpen(url, fileType)`

`generateWorksheet` 行为：

- `config.USE_MOCK_API=true` 时使用前端稳定 mock，不请求服务端。
- 有 `filePath` 时走 `wx.uploadFile`，字段仍使用同一合同。
- 无 `filePath` 时走 JSON POST。
- 服务端返回后会在前端再执行一次 `normalizeWorksheet`，避免页面拿到旧字段。

## 4. Mock 与 Normalize/Validate

服务端：

- `server/src/lib/mockWorksheet.js`
- `server/src/lib/worksheet.js`

小程序端：

- `miniprogram/utils/worksheet.js`

当前 mock 能力：

- 无 `AI_API_KEY` 时生成稳定练习卷。
- 默认生成 10 道初一数学一元一次方程题。
- 包含题目、答案、解析、`answerKey`、`cost`、`paperBlueprint`。
- 支持按 `questionCount` 生成指定题量，用于后续测试和 UI 入口。

校验函数：

- `normalizeWorksheet(data, defaults)`
- `validateWorksheet(worksheet)`
- `assertValidWorksheet(worksheet)`

## 5. 验证证据

```text
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
=> tests 7, pass 7, fail 0
```

```text
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
foreach ($f in $files) { node --check $f }
=> node --check PASS for JS files: 25
```

```text
npm.cmd run start smoke:
GET /health => ok true
GET /api/plans => yearPlans 3
POST /api/purchases/mock standard-year => paymentStatus paid
```

## 6. Task 03 边界

已完成：

- 统一 Worksheet / Question / PaperBlueprint 合同。
- 增强 mock 生成器和 JSON normalize/validate。
- 封装小程序 API client。
- 增加套餐和模拟购买服务端合同。
- 增加后端测试覆盖。

未做：

- 未接真实微信支付。
- 未接真实账号、会员、订单持久化。
- 未打开微信开发者工具做 UI 截图。
- 未做 Task 04+ 的 UI 重构、上传流程细化、真实 AI 重试策略或导出付费墙完善。
