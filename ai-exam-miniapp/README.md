# AI出题小助手 微信小程序 + 轻后端

本项目按上传的 UI 图和 PRD 重新生成：微信原生小程序前端 + Node.js 轻后端。

## 已实现功能

### 小程序前端

- 首页一比一复刻：banner、剩余点数、输入框、年级/学科/难度选择、更多选项、一键生成、上传资料。
- 练习卷预览页：学生练习版 / 答案解析版切换、练习卷纸张样式、PDF / Word 下载、升级会员卡片。
- 登录页：微信一键登录 UI、协议勾选、本地模拟登录。
- 套餐页：按月 / 按年切换、基础版 / 标准版 / 高级版、推荐样式、立即升级。
- 订单页：确认订单、微信支付 UI、余额支付 UI、本地模拟支付。
- 我的页：用户信息、会员卡、剩余点数、生成记录、购买记录、推广 banner。
- 更多页：分享、协议、隐私、客服、关于。
- 生成记录 / 购买记录页面。
- 点数系统：本地缓存，默认 2 点。
- 会员系统：本地模拟支付后发放点数和会员。
- 文件上传：支持 PDF / Word / 图片选择，上传到后端。
- 后端开通后支持 `wx.downloadFile + wx.openDocument` 打开 PDF / Word。

### 轻后端

- `POST /api/worksheet/generate`
  - 小程序当前调用入口。
- `POST /api/generate`
  - PRD 兼容入口，与 `/api/worksheet/generate` 行为一致。
  - 接收 prompt 和可选文件。
  - 临时解析 PDF / Word。
  - 调用 OpenAI-compatible 大模型。
  - 如果没有配置 API Key，自动使用内置模拟题目，方便立刻跑通。
  - 生成 PDF / Word 文件并返回 URL、`source`、`cost.pointsUsed`。

- `POST /api/export/pdf`
- `POST /api/export/docx`
  - 默认返回二进制文件。
  - 增加 `?returnUrl=1` 时返回临时下载 URL，供小程序打开文档。
- `/files/*` 临时文件访问。
- 30 分钟自动清理生成文件。
- 不建数据库，不保存用户资料，不保存历史文件。

## 目录结构

```text
ai-exam-miniapp/
  miniprogram/     微信原生小程序
  server/          Node.js 轻后端
```

## 本地运行后端

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

默认地址：

```text
http://127.0.0.1:8787
```

如果没有填写 `AI_API_KEY`，会使用内置模拟数据，也能完整返回 PDF / Word 文件。

## 自动化验收

```bash
cd server
npm test
```

测试覆盖：文本生成、PDF 上传生成、DOCX 上传生成、PDF/Word 导出、点数规则、上传临时文件清理，以及前端不暴露 AI Key。

### 接入真实大模型

编辑 `server/.env`：

```env
PORT=8787
PUBLIC_BASE_URL=http://127.0.0.1:8787
AI_API_KEY=你的 API Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

支持 OpenAI-compatible 接口。火山方舟、DeepSeek、通义千问等兼容接口可按实际地址配置。

## 运行小程序

1. 打开微信开发者工具。
2. 导入 `miniprogram` 目录。
3. 使用测试 AppID 或你的正式 AppID。
4. 开发阶段勾选：`详情 -> 本地设置 -> 不校验合法域名`。
5. 确认 `miniprogram/utils/config.js`：

```js
API_BASE_URL: 'http://127.0.0.1:8787'
USE_MOCK_API: false
```

6. 运行后端后，在小程序首页输入要求，点击“一键生成练习卷”。

## 真实上线注意事项

### 1. 后端域名

线上小程序必须使用 HTTPS 域名，并在微信小程序后台配置合法 request/download/upload 域名。

### 2. 微信支付

当前订单页是本地模拟支付。上线要替换为：

```text
小程序点击支付
↓
后端创建微信支付订单
↓
返回支付参数
↓
wx.requestPayment
↓
后端支付回调
↓
发放点数/会员
```

### 3. 用户额度

当前点数和会员存储在小程序本地缓存，适合 MVP 演示。上线必须改为服务端记录：

```text
openid
剩余点数
会员类型
过期时间
订单记录
```

### 4. OCR

当前图片上传未接入 OCR，只保留接口入口。上线可接入：

- 百度 OCR
- 腾讯 OCR
- 火山 OCR
- 多模态模型读图

### 5. PDF 中文字体

PDFKit 需要中文字体。后端会自动尝试系统常见字体路径，也可在 `.env` 设置：

```env
PDF_FONT_PATH=/path/to/chinese-font.ttc
```

不要把字体文件提交到仓库。

## UI 说明

前端已按提供的 6 张 UI 图复刻：

- 首页
- 练习卷预览页
- 登录页
- 确认订单页
- 我的页
- 选择套餐页

由于微信小程序真机顶部状态栏、右上角胶囊按钮由系统控制，代码使用 `navigationStyle: custom` 并自绘标题区域，实际真机和静态图片会有轻微差异。

## 下一步建议

1. 接真实微信登录，拿 openid。
2. 接服务端点数系统。
3. 接微信支付。
4. 接真实 OCR。
5. 优化 PDF/Word 模板。
6. 增加分享得点数。
7. 增加免费 PDF 水印二维码。
8. 增加整卷仿真蓝图分析。
