# Task 04 执行报告

执行日期：2026-05-16  
任务：首页 / 核心生成页 UI 复刻与状态完善  
结论：`PASS_WITH_LIMITATION`

## 本轮目标

根据 `docs/UI/` 中 UI-01 首页/核心生成页参考图，完善首页主视觉、输入区、上传区、快捷示例、高级选项、生成按钮、额度提示、结果预览入口，并补齐空状态、loading 状态、disabled 视觉态和错误提示。

## 修改范围

- `ai-exam-miniapp/miniprogram/pages/index/index.js`
- `ai-exam-miniapp/miniprogram/pages/index/index.wxml`
- `ai-exam-miniapp/miniprogram/pages/index/index.wxss`
- `ai-exam-miniapp/miniprogram/components/bottom-tab/bottom-tab.wxml`
- `ai-exam-miniapp/miniprogram/components/nav-bar/nav-bar.wxml`
- `docs/auto-execute/task-04-report.md`
- `docs/auto-execute/project-state.md`

未执行 `push`、`commit`、`reset`、`clean`。未修改 `docs/UI/`。

## 已完成

1. 首页文案从乱码修正为可读中文，标题为 `AI 出题小助手`。
2. 首页主视觉改为卡片式 banner，继续复用 `assets/hero-banner.png`。
3. 输入框补齐 300 字计数、示例 prompt 快捷填入、错误边框和空态提示。
4. 快捷条件保留年级、学科、难度选择。
5. 高级选项保留普通练习 / 整卷仿真、5 / 10 / 20 题选择，并把整卷仿真模式对齐 Task 03 合同 `exam_simulation`。
6. 生成按钮保留 `generateWorksheet` 调用，不重写 API 合同；loading 时展示按钮 loading 和内联状态。
7. 上传卡片补齐已选文件状态、移除入口、10MB 错误提示。
8. 补齐首页结果预览入口：无结果时展示空状态，有 `globalData.lastWorksheet` 时展示最近生成卡片并可进入预览页。
9. 首页可见底部 tab 文案修正为 `首页 / 我的 / 更多`。
10. 导航组件返回符号从乱码修正为 `‹`。

## 验收结果

### JS 语法检查

```powershell
cd D:\lyh\agent\agent-frame\printersheet
$files = rg --files ai-exam-miniapp -g '*.js' -g '!**/node_modules/**' -g '!**/files/**' -g '!**/uploads/**'
foreach ($f in $files) { node --check $f }
```

结果：通过。命令无错误输出。

### 后端自动化测试

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm test
```

结果：

```text
tests 7
pass 7
fail 0
duration_ms 1996.7869
```

### server 启动 smoke

```powershell
cd D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\server
npm.cmd run start
GET http://127.0.0.1:8787/health
```

结果：

```json
{"ok":true}
```

本轮 smoke 结束后已关闭本轮启动的 8787 监听进程。

### 文案乱码回归检查

对本轮触达的首页 WXML/JS、底部 tab WXML、导航 WXML 检查常见乱码片段：

```powershell
Select-String -LiteralPath `
  ai-exam-miniapp\miniprogram\pages\index\index.wxml,`
  ai-exam-miniapp\miniprogram\pages\index\index.js,`
  ai-exam-miniapp\miniprogram\components\bottom-tab\bottom-tab.wxml,`
  ai-exam-miniapp\miniprogram\components\nav-bar\nav-bar.wxml `
  -Pattern '鈥|鎴|棣|鏇|鍒|涓€|馃|鉁|�' -SimpleMatch
```

结果：无匹配。

## 截图状态

未保存截图到 `docs/auto-execute/screenshots/`。原因：本轮没有打开微信开发者工具或可渲染小程序的截图工具；已用静态文件检查、JS 语法检查、后端测试和 server smoke 作为可执行证据。Task 10 仍需补正式小程序截图和 UI 对照。

## 限制与风险

- 尚未在微信开发者工具中做真机/模拟器渲染验证，不能声明像素级 UI PASS。
- 仅修复首页及首页可见组件文案；其他页面仍可能存在历史乱码，留给对应页面任务处理。
- 上传文件真实解析、整卷仿真上传链路细节属于 Task 05/06，不在本轮闭环内。
- 真实 AI、真实微信登录、真实支付、生产会员持久化均未接入。

## 交给 Task 05

下一轮应聚焦上传文档流程：

1. 保持 `pages/index` 已有 `filePath/fileName` 状态和 `generateWorksheet` 参数合同。
2. 深化 `chooseFile` 后的文件类型、大小、预览、错误提示和传参。
3. 用 PDF / Word / 图片样例验证“上传资料 -> 生成试题”链路。
4. 不要改动 `docs/UI/`，不要引入真实生产支付或密钥。
