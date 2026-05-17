# printersheet MVP 验收报告

生成日期：2026-05-16

## 结论

`PASS_WITH_LIMITATION`

已完成并验证小程序 + Node 轻后端 MVP 核心闭环：文本生成、PDF 上传生成、DOCX 上传生成、练习卷 JSON、PDF/Word 文件生成、PRD 兼容接口、点数规则、前端密钥扫描。

限制项：微信开发者工具内的 6 张 UI 逐像素截图核对仍需人工运行；登录、支付、会员账户为 PRD 允许的 MVP 本地模拟；图片 OCR 未启用，图片上传只保留入口和限制提示。

## 自动化验收结果

命令：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
```

结果：

```text
tests 5
pass 5
fail 0
```

覆盖项：

- `GET /health` 可用。
- `POST /api/generate` 文本生成返回 `worksheet`、`cost`、`source`、`pdfUrl`、`wordUrl`。
- PDF 上传生成练习卷，并清理上传临时文件。
- DOCX 上传生成练习卷，并清理上传临时文件。
- `POST /api/export/pdf` 默认返回二进制 PDF。
- `POST /api/export/docx` 默认返回二进制 DOCX。
- `?returnUrl=1` 返回 JSON 文件 URL，兼容小程序下载。
- 点数规则：10 题 1 点、20 题 2 点、整卷仿真固定 10 点。
- `miniprogram` 前端未出现 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`。

## DeepSeek 真实 AI 验收

使用运行时环境变量注入 DeepSeek OpenAI-compatible 配置，未写入仓库文件。

结果：

```json
{
  "text": {
    "source": "ai",
    "questions": 5,
    "hasPdf": true,
    "hasWord": true
  },
  "pdfUpload": {
    "source": "ai",
    "questions": 5,
    "hasPdf": true,
    "hasWord": true
  },
  "docxUpload": {
    "source": "ai",
    "questions": 5,
    "hasPdf": true,
    "hasWord": true
  }
}
```

补充修复：首次真实 AI 验收发现模型在部分请求中只返回 1 题。服务端已加入题量硬校验：少于请求题量会自动重试，重试后仍不足则失败，不再把不足题量当作成功。

## PRD 覆盖

- 输入要求生成试题：已完成。
- 上传 PDF / Word 生成试题：已完成。
- 图片上传：入口保留，OCR 未启用，明确提示为增强能力。
- 结果预览：小程序预览页使用真实后端 worksheet 数据。
- PDF 下载：已生成带水印 PDF。
- Word 下载：已生成可编辑 DOCX，前端非会员会弹升级提示。
- 答案解析页：预览页支持答案解析 tab，PDF/DOCX 包含答案解析区。
- 免费次数 / 点数限制：小程序本地 2 点，生成后按后端 `pointsUsed` 扣减。
- 付费弹窗 / 定价页：点数不足和 Word 非会员均引导升级；支付为本地模拟。
- 整卷仿真：小程序要求先上传资料；后端通过 mode/prompt 约束模型生成相似结构新卷，MVP 简版已覆盖。

## 手工验收清单

需在微信开发者工具中完成：

1. 导入 `D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram`。
2. 启动后端并设置 `miniprogram/utils/config.js` 的 `API_BASE_URL` 指向本机后端。
3. 首页输入“生成 10 道初一数学一元一次方程中等题，带答案解析，适合打印”，点击生成。
4. 核对预览页学生练习版、答案解析版、PDF 下载、Word 非会员升级弹窗。
5. 上传 PDF/DOCX 后分别生成练习卷。
6. 切换整卷仿真模式，不上传文件应出现“需要上传试卷”提示。
7. 点数不足时应出现付费提示。
8. 对照 `docs/UI` 6 张图检查首页、预览、套餐、登录、订单、我的页面；微信系统状态栏和胶囊按钮允许平台差异。

## 已知限制

- 未接入真实微信登录、微信支付、服务端点数账户。
- 未接入图片 OCR 或多模态识图。
- 生成文件为 10-30 分钟临时访问，适合 MVP 验证。
- 真实 AI 输出质量仍依赖模型，服务端已做 JSON、必填字段、题量校验，但未做数学正确性证明。
