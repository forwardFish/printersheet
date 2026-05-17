# Task 03 执行报告

任务：数据模型、状态管理、API 合同、Mock 生成器  
执行日期：2026-05-16  
执行范围：`ai-exam-miniapp/server` 数据模型/API/mock/tests；`ai-exam-miniapp/miniprogram` API client 和 worksheet 本地 normalize/mock；`docs/auto-execute` 合同与交接文档。

## 已完成

1. 阅读父级 `D:\lyh\agent\agent-frame\AGENTS.md`，按窄范围检查 `docs`、`ai-exam-miniapp/server`、`ai-exam-miniapp/miniprogram`。
2. 阅读 `docs/printersheet_auto_execute_plan.md`、`docs/AI_worksheet_print_tool_PRD_v1.md`、`docs/auto-execute/project-state.md`、`docs/auto-execute/task-02-report.md`。
3. 统一服务端 Worksheet 合同：
   - `mode` 规范为 `practice | exam_simulation`。
   - 兼容旧值 `paper | simulation | exam`。
   - 增加 `answerKey`、`cost`、`sourceFileInfo`、`paperBlueprint`。
   - 增加 `validateWorksheet` 和强化 `assertValidWorksheet`。
4. 增强服务端 mock：
   - 默认生成 10 道初一数学一元一次方程题。
   - 包含答案、解析、点数、整卷仿真 blueprint。
   - 支持按 `questionCount` 生成，用于 UI/测试入口。
5. 补齐服务端 API 合同：
   - `GET /api/plans`
   - `POST /api/purchases/mock`
   - 上传生成结果返回 `sourceFileInfo`。
6. 封装小程序 API client：
   - `generateWorksheet(params)`
   - `exportPdf(worksheet, options)`
   - `exportDocx(worksheet)`
   - `getPlans()`
   - `createMockPurchase(planId)`
7. 小程序本地 mock/normalize 与服务端合同保持一致，后续页面可直接消费统一 `worksheet`。
8. 新增 `docs/auto-execute/03-api-contract.md`。

## 修改范围

- `ai-exam-miniapp/server/src/lib/worksheet.js`
- `ai-exam-miniapp/server/src/lib/mockWorksheet.js`
- `ai-exam-miniapp/server/src/lib/plans.js`
- `ai-exam-miniapp/server/src/index.js`
- `ai-exam-miniapp/server/test/api.test.js`
- `ai-exam-miniapp/miniprogram/services/api.js`
- `ai-exam-miniapp/miniprogram/utils/worksheet.js`
- `docs/auto-execute/03-api-contract.md`
- `docs/auto-execute/task-03-report.md`
- `docs/auto-execute/project-state.md`

未执行 push、commit、reset、clean。

## 验证命令与结果

后端自动化测试：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
```

结果：

```text
tests 7
pass 7
fail 0
duration_ms 2731.6977
```

JS 静态语法检查：

```powershell
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
foreach ($f in $files) { node --check $f }
```

结果：

```text
node --check PASS for JS files: 25
```

服务端 smoke：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm.cmd run start
GET http://127.0.0.1:8787/health
GET http://127.0.0.1:8787/api/plans
POST http://127.0.0.1:8787/api/purchases/mock {"planId":"standard-year"}
```

结果：

```json
{"healthOk":true,"yearPlans":3,"purchaseStatus":"paid","purchasePlan":"standard-year"}
```

说明：第一次 smoke 使用 `Start-Process npm`，Windows 未能解析为 `npm.cmd`，未启动服务；改用 `npm.cmd` 后通过。该问题属于命令形式问题，不是业务失败。smoke 结束后已确认并关闭本轮遗留的 8787 监听进程。

## 已完成/未完成

已完成：

- Worksheet / Question / PaperBlueprint 合同。
- `generateWorksheet`、`exportPdf`、`exportDocx`、`getPlans`、`createMockPurchase` API client。
- 无 AI Key 时稳定 mock 练习卷。
- JSON normalize/validate/repair 基础能力。
- 服务端套餐/模拟购买 API。
- 自动化测试和语法检查。

未完成：

- 未打开微信开发者工具做真实小程序运行。
- 未做 UI 截图或像素 diff。
- 未接真实 AI Key、真实微信登录、真实支付、生产订单或会员持久化。
- 未改 Task 04+ 页面视觉和上传流程细节。

## 交给 Task 04

Task 04 可直接使用：

- 小程序端：`miniprogram/services/api.js` 的 `generateWorksheet`
- 小程序端：`miniprogram/utils/worksheet.js` 的 `normalizeWorksheet`、`sampleWorksheet`、`groupBySection`
- 后端生成：`POST /api/worksheet/generate`
- 合同文档：`docs/auto-execute/03-api-contract.md`

注意：

- 页面里仍有历史 mode 值 `paper`，服务端和前端 normalize 已兼容；后续 UI 改造时建议逐步显示为“整卷仿真”，内部可继续传 `paper` 或改为 `exam_simulation`。
- 购买页目前仍以本地模拟为主，`/api/purchases/mock` 已提供后续接入点。
- 真实 AI 重试和输出质量收敛属于 Task 06，不在本轮闭环内。
