# Task 05 执行报告

执行日期：2026-05-16  
任务：上传文档流程  
结论：`PASS_WITH_LIMITATION`

## 本轮目标

核对并完善上传 PDF / Word / 图片 / 文档主流程：文件选择、类型与大小校验、文件卡片、删除/重新选择、解析状态、生成参数传入、后端临时解析/清理、降级提示、接口占位。

## 修改范围

- `ai-exam-miniapp/miniprogram/pages/index/index.js`
- `ai-exam-miniapp/miniprogram/pages/index/index.wxml`
- `ai-exam-miniapp/miniprogram/pages/index/index.wxss`
- `ai-exam-miniapp/miniprogram/services/api.js`
- `ai-exam-miniapp/server/src/index.js`
- `ai-exam-miniapp/server/src/lib/parseFile.js`
- `ai-exam-miniapp/server/src/lib/worksheet.js`
- `ai-exam-miniapp/server/test/api.test.js`
- `docs/auto-execute/task-05-report.md`
- `docs/auto-execute/project-state.md`

未执行 `push`、`commit`、`reset`、`clean`。未修改或删除 `docs/UI/` 资产。未写入真实密钥、未接真实生产支付。

## 已完成

1. 首页上传入口从单纯 `filePath/fileName` 扩展为完整文件状态：类型标签、大小标签、扩展名、解析状态、解析/降级提示。
2. 前端选择文件时校验扩展名和 10MB 大小限制；支持 PDF、Word、PNG、JPG、JPEG、WEBP；不支持类型会给出明确弹窗。
3. 上传卡片补齐文件卡片、删除、点击重新选择、待后端解析、图片占位解析提示。
4. `generateWorksheet` 继续沿用 Task 03 生成合同，并在 multipart 上传时透传 `fileName/fileType/fileSize`。
5. 后端上传入口增加统一 `uploadSingleFile` 包装：限制文件大小、拒绝不支持类型，并返回 JSON 错误。
6. 后端图片上传保持 MVP OCR 占位，不误标为 `parsed`；`sourceFileInfo.parserStatus` 会返回 `placeholder`。
7. 扫描 PDF 或不可提取文本 PDF 改为占位降级提示进入生成流程，不因 OCR 未接入直接中断。
8. `sourceFileInfo` 保留 `parserMessage`，供后续预览页或调试信息使用。
9. 后端测试新增图片占位解析、非法类型拒绝、上传临时目录清理断言。

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
tests 8
pass 8
fail 0
duration_ms 1876.4836
```

覆盖点包括：健康检查、文字生成、schema 归一化、PDF/DOCX 上传解析与临时上传清理、图片占位解析、非法类型拒绝、导出接口、点数策略、前端密钥防泄漏、套餐/模拟购买接口。

### server 启动 smoke

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
$env:PORT='8797'
node src/index.js
Invoke-WebRequest http://127.0.0.1:8797/health -UseBasicParsing
```

结果：通过。

```json
{"ok":true}
```

本轮启动的 8797 端口进程已关闭。

## 未完成 / 限制

- 未在微信开发者工具中做真机/模拟器渲染截图。
- 未做 `docs/UI/` 设计图像素级对比。
- 图片 OCR、扫描 PDF OCR 仍是 MVP 占位能力，不是真实 OCR。
- 生成文件 `/files/*` 的 30 分钟过期清理保留原实现；本轮验证了上传临时目录清理，未等待 30 分钟验证生成文件过期清理。
- 真实 AI 输出质量和数学正确性仍留给 Task 06 之后的专项验证。

## 交给下一个 worker

Task 06 可聚焦生成接口的 AI 调用、JSON 校验、失败重试和 fallback。建议从以下文件开始：

1. `ai-exam-miniapp/server/src/lib/ai.js`
2. `ai-exam-miniapp/server/src/lib/worksheet.js`
3. `ai-exam-miniapp/server/src/lib/mockWorksheet.js`
4. `ai-exam-miniapp/server/test/api.test.js`
5. `docs/auto-execute/03-api-contract.md`

保持 Task 05 已建立的上传合同：有文件时 `sourceFileInfo.parserStatus` 可能是 `parsed` 或 `placeholder`，Task 06 不应把 `placeholder` 当作失败。
