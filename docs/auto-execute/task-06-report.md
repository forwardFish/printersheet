# Task 06 执行报告

执行日期：2026-05-16  
任务：生成接口 AI 调用、JSON 校验、失败重试与 fallback  
结论：`PASS_WITH_LIMITATION`

## 本轮目标

补齐服务端真实 AI 生成链路：读取 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`AI_MOCK_MODE`，向 OpenAI-compatible chat completions 接口发送明确 JSON schema prompt；对模型返回 JSON 做结构校验和业务字段校验；无密钥、mock 模式、调用失败或返回不合格时稳定 fallback 到 mock worksheet。

## 修改范围

- `ai-exam-miniapp/server/src/lib/ai.js`
- `ai-exam-miniapp/server/src/index.js`
- `ai-exam-miniapp/server/test/api.test.js`
- `ai-exam-miniapp/server/.env.example`
- `docs/auto-execute/task-06-report.md`
- `docs/auto-execute/project-state.md`

未执行 `push`、`commit`、`reset`、`clean`。未修改或删除 `docs/UI/` 资产。未写入真实密钥。

## 已完成

1. 新增 `AI_MOCK_MODE` 配置；`true/1/yes/on` 会强制使用 mock，不触发真实 AI 请求。
2. 保留无 `AI_API_KEY` 的 mock fallback；同时支持 `AI_BASE_URL` 和 `AI_MODEL` 控制真实 OpenAI-compatible 请求。
3. AI prompt 明确写入 worksheet JSON schema、题量要求、必填字段、整卷仿真约束和上传资料摘要。
4. 模型响应先提取 JSON，再校验 `questions` 数组、题量、每题 `question/answer/explanation` 必填字段和 `options` 类型。
5. AI 请求失败、非 2xx、响应缺少 content、JSON 解析失败或 schema 不合格时重试 2 次；仍失败则 fallback 到 mock worksheet。
6. fallback 结果返回 `source: "mock"` 和 `fallbackReason`，便于后续 UI/验收定位降级原因。
7. 服务端测试新增真实 AI 配置与 prompt schema 断言、`AI_MOCK_MODE` 断言、无效 AI JSON 降级断言。
8. 保持 Task 05 上传合同：`sourceFileInfo.parserStatus` 的 `parsed | placeholder` 继续由生成入口 normalize 合并，不把 placeholder 当作失败。

## 验证命令与结果

### JS 静态语法检查

```powershell
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
foreach ($f in $files) { node --check $f }
```

结果：通过。

```text
node --check PASS 25 files
```

### 后端自动化测试

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
```

结果：通过。

```text
tests 10
pass 10
fail 0
duration_ms 1992.2007
```

新增覆盖点：

- AI 请求使用 `AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY`。
- prompt 内包含明确 JSON schema 和目标题量。
- `AI_MOCK_MODE=true` 时不调用 fetch。
- AI 返回题量不合格时重试 2 次后 fallback 到 mock。
- fallback worksheet 仍通过统一 worksheet 校验。

### server smoke

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
$env:PORT='8798'
$env:PUBLIC_BASE_URL='http://127.0.0.1:8798'
$env:AI_MOCK_MODE='true'
node src/index.js
Invoke-WebRequest http://127.0.0.1:8798/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8798/api/generate -Method POST -ContentType 'application/json' -Body ...
```

结果：通过。

```text
health={"ok":true}
generate=success source=mock questions=3 fallbackReason=AI_MOCK_MODE enabled
```

本轮启动的 8798 端口进程已关闭。

## 未完成 / 限制

- 未接入真实生产 AI Key；真实模型输出质量、数学正确性和成本控制仍需后续带 key 验证。
- 当前 schema 校验聚焦 MVP 必填结构与题量；没有做完整 JSON Schema 草案级校验库接入。
- fallback 会返回可用 mock 练习卷，但无法代表真实 AI 题目质量。
- 未在微信开发者工具中做真机/模拟器截图验收。
- 未做 `docs/UI/` 像素级对比。

## 交给下一个 worker

Task 07 可继续处理预览页、答案解析和整卷仿真简版。注意：

1. 生成接口成功时 `source` 可能是 `ai` 或 `mock`。
2. fallback 时可能带 `fallbackReason`，预览页不应把它当作失败。
3. `worksheet.questions`、`answerKey`、`paperBlueprint` 已由服务端 normalize/validate，可作为预览页主数据源。
4. `sourceFileInfo.parserStatus` 可能是 `parsed` 或 `placeholder`，placeholder 代表上传资料降级解析，不代表生成失败。
