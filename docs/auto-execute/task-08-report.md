# Task 08 执行报告

执行日期：2026-05-16  
任务：PDF / Word 导出、下载/打开、付费墙  
结论：`PASS_WITH_LIMITATION`

## 本轮目标

补齐预览页 PDF / Word 的真实导出闭环：在已有 worksheet 预览基础上，支持按需生成临时 PDF/DOCX 文件、下载并调用微信 `openDocument` 打开；同时保留 Word 会员付费墙和清晰升级提示。

## 修改范围

- `ai-exam-miniapp/miniprogram/pages/preview/preview.js`
- `ai-exam-miniapp/miniprogram/pages/preview/preview.wxml`
- `ai-exam-miniapp/miniprogram/pages/preview/preview.wxss`
- `ai-exam-miniapp/miniprogram/services/api.js`
- `docs/auto-execute/task-08-report.md`
- `docs/auto-execute/project-state.md`

未执行 `push`、`commit`、`reset`、`clean`。未修改或删除 `docs/UI/` 资产。未写入真实密钥。

## 已完成

1. PDF 下载入口改为可测闭环：
   - 若已有 `pdfUrl`，直接下载并调用 `wx.openDocument`。
   - 若没有 `pdfUrl`，调用 `/api/export/pdf?returnUrl=1` 生成临时 PDF URL。
   - 非会员生成带水印 PDF；会员生成并缓存 `memberPdfUrl`，用于无水印 PDF。
2. Word 下载入口接入会员付费墙：
   - 非会员点击 Word 时弹出升级提示，不调用 DOCX 导出接口。
   - 提示文案说明升级后会生成 DOCX 临时文件并用 `openDocument` 打开。
   - 会员点击 Word 时，若没有 `wordUrl`，调用 `/api/export/docx?returnUrl=1` 生成临时 DOCX URL。
3. 小程序 API client 增强：
   - `downloadAndOpen(url, fileType)` 改为 Promise，可被页面等待和捕获错误。
   - 拆出 `downloadFile`、`openDocument` 包装，下载失败、打开失败会显示明确错误弹窗。
4. 预览页增加导出状态：
   - PDF / Word 卡片显示“生成中...”。
   - 页面显示导出成功、付费墙、失败原因等状态文本。
   - 导出中会阻止重复点击。
5. 保持后端导出合同不变：
   - `/api/export/pdf?returnUrl=1` 仍返回 `{ success, pdfUrl }`。
   - `/api/export/docx?returnUrl=1` 仍返回 `{ success, wordUrl }`。
   - 没有引入服务端会员、订单或生产支付状态。

## 验证命令与结果

### 单文件 JS 语法检查

```powershell
cd D:\lyh\agent\agent-frame\printersheet
node --check ai-exam-miniapp\miniprogram\pages\preview\preview.js
node --check ai-exam-miniapp\miniprogram\services\api.js
```

结果：通过，无输出错误。

### 全量 JS 静态语法检查

```powershell
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
foreach ($f in $files) { node --check $f }
```

结果：通过。

```text
node --check PASS 25 JS files
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
duration_ms 1523.4061
```

### server smoke

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
$env:PORT='8799'
$env:PUBLIC_BASE_URL='http://127.0.0.1:8799'
$env:AI_MOCK_MODE='true'
node src/index.js
Invoke-WebRequest http://127.0.0.1:8799/health -UseBasicParsing
Invoke-RestMethod http://127.0.0.1:8799/api/generate -Method POST -ContentType 'application/json' -Body ...
Invoke-RestMethod http://127.0.0.1:8799/api/export/pdf?returnUrl=1 -Method POST -ContentType 'application/json' -Body ...
Invoke-RestMethod http://127.0.0.1:8799/api/export/docx?returnUrl=1 -Method POST -ContentType 'application/json' -Body ...
```

结果：通过。

```text
health_status=200
generate_success=True
generate_source=mock
question_count=5
pdf_url=http://127.0.0.1:8799/files/e4086ec8-cd9d-4956-9e17-a51269b40908.pdf
word_url=http://127.0.0.1:8799/files/34125dc6-567d-4abc-8a4a-b374cdcb517f.docx
```

本轮启动的 8799 端口进程已关闭。

## 未完成 / 限制

- 未打开微信开发者工具做真机/模拟器点击验证。
- 未实际验证 `wx.downloadFile` 与 `wx.openDocument` 在微信开发者工具中的弹窗、菜单和文件预览效果。
- 未做 `docs/UI/` 像素级对比。
- Word 会员状态仍使用本地模拟会员，不接真实微信登录、真实支付或服务端会员持久化。
- PDF 无水印权限由前端会员态控制，服务端暂不做鉴权；上线前需要后端鉴权。
- 生成文件仍是 `/files/*` 临时文件，30 分钟过期清理的长时间运行态未验证。

## 交给下一个 worker

Task 09 可继续处理免费额度、定价页、购买记录和生成记录。注意：

1. 预览页已经完成 PDF/DOCX 按需导出、下载、打开和 Word 会员提示。
2. 不要在 Task 09 重定义 worksheet、PDF 或 DOCX 合同。
3. 会员态当前来自 `storage.getMember()`，购买页和订单页仍是本地模拟支付。
4. Task 09 可以围绕点数扣减、套餐权益展示、记录字段补齐和购买后会员/点数状态一致性继续。
5. 若需要验证导出按钮真实点击，必须使用微信开发者工具导入 `ai-exam-miniapp/miniprogram`。
