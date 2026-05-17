# Task 01 项目审计报告

生成日期：2026-05-16  
项目路径：`D:\lyh\agent\agent-frame\printersheet`  
审计范围：`docs/AI_worksheet_print_tool_PRD_v1.md`、`docs/UI/`、`ai-exam-miniapp/`、`docs/auto-execute/ACCEPTANCE_REPORT.md`

## 结论

当前项目已经不是空壳。现有实现是：

- 前端：微信原生小程序，目录为 `ai-exam-miniapp/miniprogram`。
- 后端：Node.js 18+、Express、ESM 模块，目录为 `ai-exam-miniapp/server`。
- 数据：小程序本地缓存保存点数、会员、生成记录、购买记录；服务端不建数据库。
- AI：服务端读取 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`，无密钥时走 mock fallback。
- 文件：服务端临时处理上传文件，生成 PDF/DOCX 临时文件，并通过 `/files/*` 暴露 30 分钟左右。

Task 01 未启动服务、未运行 `npm test`，只做静态审计和交接。已执行的低风险检查：

```powershell
node --check ai-exam-miniapp\server\src\index.js
node --check ai-exam-miniapp\miniprogram\pages\index\index.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('ai-exam-miniapp/server/package.json','utf8')); JSON.parse(fs.readFileSync('ai-exam-miniapp/miniprogram/app.json','utf8')); console.log('json ok')"
```

补充批量检查结果：

```text
node --check PASS for JS files: 24
json ok
```

## 当前架构

```text
ai-exam-miniapp/
  miniprogram/                 微信原生小程序
    app.json                   页面注册和全局组件
    project.config.json        微信开发者工具项目配置
    pages/
      index/                   首页/生成页/上传入口
      preview/                 练习卷预览、答案解析、PDF/Word 入口
      login/                   本地模拟登录 UI
      packages/                套餐选择页
      order/                   本地模拟支付确认页
      my/                      我的页、点数、记录入口
      more/                    更多页
      records/                 生成记录
      purchase-records/        购买记录
    components/
      nav-bar/
      bottom-tab/
    services/api.js            小程序请求、上传、下载打开文件封装
    utils/storage.js           点数、会员、记录本地缓存
    utils/worksheet.js         前端 sample worksheet 和分组工具
    utils/config.js            API_BASE_URL、USE_MOCK_API
  server/
    package.json               dev/start/test 脚本
    src/index.js               Express 入口和 API 路由
    src/lib/ai.js              AI 调用、JSON 提取、mock fallback
    src/lib/mockWorksheet.js   mock 练习卷
    src/lib/worksheet.js       worksheet normalize/validate/points
    src/lib/parseFile.js       PDF/DOCX/图片上传解析策略
    src/lib/buildPdf.js        PDF 生成
    src/lib/buildDocx.js       DOCX 生成
    test/api.test.js           Node test API 覆盖
```

## 启动方式

服务端：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm install
Copy-Item .env.example .env
npm run dev
```

默认服务地址：

```text
http://127.0.0.1:8787
```

小程序：

```text
1. 打开微信开发者工具。
2. 导入 D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram。
3. 使用测试 AppID 或正式 AppID。
4. 本地调试时勾选“不校验合法域名”。
5. 确认 miniprogram/utils/config.js 的 API_BASE_URL 指向 http://127.0.0.1:8787。
```

## 构建和测试方式

当前可见测试脚本：

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
```

`package.json` 脚本：

```json
{
  "dev": "node --watch src/index.js",
  "start": "node src/index.js",
  "test": "node --test"
}
```

Task 01 未执行 `npm test`，因为本任务只做审计交接，且用户要求避免启动服务和重验证。后续 Task 02 应在安装依赖后运行。

## 页面盘点

| 页面 | 文件 | 当前作用 | 状态 |
| --- | --- | --- | --- |
| 首页/生成页 | `pages/index/index` | prompt 输入、点数、年级/科目/难度、模式、题量、上传、生成 | 已实现，需真机/开发者工具验证 |
| 预览页 | `pages/preview/preview` | 学生练习版、答案解析版、PDF/Word 打开、升级提示 | 已实现，需视觉和文件打开验证 |
| 登录页 | `pages/login/login` | 微信一键登录样式、本地模拟登录 | MVP 模拟 |
| 套餐页 | `pages/packages/packages` | 月/年套餐、推荐套餐、选择套餐 | 已实现，价格和 PRD 存在差异需产品确认 |
| 订单页 | `pages/order/order` | 本地模拟支付、发放点数和会员 | MVP 模拟，不是真实支付 |
| 我的页 | `pages/my/my` | 用户信息、会员、点数、生成/购买记录入口 | 已实现 |
| 更多页 | `pages/more/more` | 分享、协议、隐私、客服、关于 | 已实现基础入口 |
| 生成记录 | `pages/records/records` | 本地生成记录列表 | MVP 本地缓存 |
| 购买记录 | `pages/purchase-records/purchase-records` | 本地购买记录列表 | MVP 本地缓存 |

## API 盘点

| API | 方法 | 实现位置 | 当前能力 |
| --- | --- | --- | --- |
| `/health` | GET | `server/src/index.js` | 健康检查 |
| `/api/worksheet/generate` | POST multipart/json | `server/src/index.js` | 小程序主入口，支持 prompt 和可选文件 |
| `/api/generate` | POST multipart/json | `server/src/index.js` | PRD 兼容入口，行为同上 |
| `/api/export/pdf` | POST json | `server/src/index.js` | 根据 worksheet 生成 PDF，支持二进制或 `returnUrl=1` |
| `/api/export/docx` | POST json | `server/src/index.js` | 根据 worksheet 生成 DOCX，支持二进制或 `returnUrl=1` |
| `/files/*` | GET static | `server/src/index.js` | 暂时访问生成文件 |

## PRD 功能状态矩阵

| PRD 能力 | 当前状态 | 证据 | 缺口/风险 |
| --- | --- | --- | --- |
| 输入要求生成试题 | 已实现主链路 | `pages/index/index.js` 调 `services/api.js`，服务端 `/api/worksheet/generate` | 未在 Task 01 动态跑通 |
| 上传 PDF/Word/图片 | 部分实现 | `wx.chooseMessageFile`，`multer`，`parseFile.js` | 图片 OCR 只是占位；扫描 PDF 无 OCR |
| AI 生成 worksheet JSON | 已实现封装 | `server/src/lib/ai.js` | 真实 AI 质量依赖模型；数学正确性未验证 |
| 无密钥 fallback | 已实现 | `createMockWorksheet` | fallback 是演示能力，不等于真实 AI |
| 预览试卷 | 已实现 | `pages/preview` | 需要开发者工具视觉验证 |
| 答案解析 | 已实现 | `preview` answer tab、服务端 answerKey | 未验证真实题目答案正确性 |
| PDF 导出/打开 | 已实现接口和小程序打开入口 | `buildPdf.js`、`downloadAndOpen` | 需运行后端验证文件可打开、中文字体正常 |
| Word 导出/打开 | 已实现服务端 DOCX，前端非会员弹升级 | `buildDocx.js`、`preview.js` | PRD 允许作为付费能力；免费态不直接开放 |
| 免费点数 | 已实现本地 2 点 | `utils/storage.js` | 点数在小程序本地，服务端无账号态防刷 |
| 点数不足付费提示 | 已实现入口 | `index.js`、`preview.js` | 真实支付未接入 |
| 定价页/购买入口 | 已实现 | `packages`、`order` | 当前套餐价格和 PRD 推荐套餐不完全一致 |
| 生成记录 | 已实现本地缓存 | `storage.addRecord`、`pages/records` | 不跨设备、不跨登录态 |
| 购买记录 | 已实现本地缓存 | `storage.addPurchase`、`pages/purchase-records` | 不是真实订单 |
| 整卷仿真简版 | 部分实现 | `mode: paper`、10 点消耗、要求上传文件 | 结构分析主要靠 prompt/模型，非确定性 blueprint |
| API Key 不在前端 | 静态检查未发现 JS 暴露 | node/文本检查计划见 `04-test-plan.md` | 仍需最终 secret guard |
| 上传文件不长期保存 | 服务端 `parseUploadedFile` finally 删除上传；生成文件定时清理 | `parseFile.js`、`cleanExpiredFiles` | 异常/进程退出场景仍需运行验证 |

## 已知风险

1. `docs/auto-execute/ACCEPTANCE_REPORT.md` 声称 `PASS_WITH_LIMITATION`，但 Task 01 没有复跑 `npm test`、真机/开发者工具、截图对比或真实 AI。后续不能把旧报告当作当前最终验收。
2. 当前产品形态是微信原生小程序，与 PRD 推荐的 Web/H5 + Next.js 不一致。用户当前任务要求审计现有 `ai-exam-miniapp`，因此本轮接受当前技术栈作为现状。
3. UI 静态参考图有 6 张，当前小程序页面数量更多。记录页、购买记录页、更多页没有明确静态参考图，需要按 PRD 和现有风格做一致性检查。
4. 套餐页实现的年卡价格为 19.9/39.9/79.9，PRD 推荐为 Free/Starter 9.9/月、Pro 19.9/月、Teacher 39.9/月，并包含更多套餐形态。需要后续确认是否按 UI 图优先还是按 PRD 价格优先。
5. 小程序端本地缓存点数和会员适合 MVP 演示，但不能作为上线计费依据。
6. OCR、真实支付、真实微信登录、服务端账号点数、跨设备记录均未接入。

## Task 02 建议

Task 02 应只处理基础运行和验证，不扩业务功能：

1. 在 `ai-exam-miniapp/server` 安装依赖并运行 `npm test`。
2. 如测试失败，先修复语法、依赖、路径、临时目录、PDF 字体、Node 版本等基础问题。
3. 用微信开发者工具导入 `miniprogram`，确认页面路径、组件引用、API_BASE_URL、上传/下载合法域名调试设置。
4. 不接真实支付、不接生产 AI 密钥、不做大规模 UI 重构。
