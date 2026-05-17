# printersheet：$Auto-Execute 多 Codex Exec 一次性执行方案

> 适用项目：AI 练习卷打印助手 / AI 出题小助手  
> 目标：基于 PRD、UI 设计图和现有部分代码，拆成多个可独立执行、可交接、可验收的 Codex exec 任务，让 `$Auto-Execute` 串行调度完成开发、测试和验收。

---

## 0. 项目路径

```text
项目根目录：
D:\lyh\agent\agent-frame\printersheet

需求文档：
D:\lyh\agent\agent-frame\printersheet\docs\AI_worksheet_print_tool_PRD_v1.md

UI 设计目录：
D:\lyh\agent\agent-frame\printersheet\docs\UI\

现有部分代码：
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp
```

---

## 1. 总目标

请把现有 `ai-exam-miniapp` 开发成一个可运行、可测试、核心流程闭环完整的 AI 练习卷生成/打印小程序项目。

核心闭环必须跑通：

```text
打开小程序
↓
输入出题要求
↓
可选上传 PDF / Word / 图片 / 文档资料
↓
点击生成试题
↓
调用后端/云函数/接口生成 worksheet JSON
↓
页面预览试卷
↓
展示学生练习版、答案解析版
↓
支持导出/打开 PDF
↓
支持导出/打开 Word 或展示 Word 付费/升级提示
↓
免费额度减少
↓
额度不足或高级功能触发付费提示/购买页
```

优先级：

1. **先保证功能闭环可用。**
2. **再保证 UI 尽量一比一复刻。**
3. **最后补测试、验收报告、交接文档。**

---

## 2. 必须遵守的开发边界

### 2.1 必须做

- 根据 PRD 和 `docs/UI/` 中的 UI 图片完成页面。
- UI 要尽量一比一复刻，包括布局、字号、颜色、间距、按钮状态、卡片样式。
- 保留现有代码可用部分，不要无脑重建项目。
- 支持输入文本生成试题。
- 支持上传文件生成试题，至少覆盖文档上传主流程。
- 支持结果预览。
- 支持 PDF 导出/打开。
- 支持 Word 导出/打开，若真实 Word 能力暂未接通，也必须有清晰的付费提示和接口占位。
- 支持免费额度/点数限制。
- 支持付费页、付费弹窗或购买入口。
- 支持生成记录和购买记录：如果 UI 中已有这些页面，则 MVP 可先用本地缓存/模拟数据实现；不要因为记录功能引入复杂数据库。
- 支持整卷仿真简版：上传试卷/资料后生成结构相似、知识点相似、难度相近的新题。
- 写完整测试和验收文档。

### 2.2 暂不强求

- 不强求真实微信支付一次性接通；可以先做购买入口、套餐页、支付状态模拟和后续接口占位。
- 不强求复杂 OCR 全量能力；图片或扫描 PDF 可先走“上传成功 + 解析占位 + AI 生成”的 MVP 流程，但必须有明确降级提示。
- 不强求复杂公式、复杂几何图重绘。
- 不强求数据库；除非现有项目已经接入云开发或后端数据库。

### 2.3 严禁

- 不要把 AI API Key 写到前端。
- 不要提交真实密钥、微信支付密钥、AppSecret。
- 不要长期保存用户上传文件。
- 不要删除 `docs/UI/` 设计资产。
- 不要大面积重构到无法回滚。
- 不要只做静态页面而不打通生成流程。
- 不要只做 mock，不做真实接口封装；可以保留 mock fallback，但必须预留真实 AI 接口。
- 不要跳过测试。
- 不要在未明确授权的情况下 push 到远程 main。

---

## 3. 推荐执行方式

不要让多个 Codex 同时改同一套代码。  
建议 `$Auto-Execute` **串行执行 10 个 Codex exec 子任务**。

原因：

- UI、接口、状态、测试都会改相同文件。
- 并行容易冲突。
- 串行 + 交接文档最稳。
- 每个 Codex exec 执行完写报告，下一个 Codex 读取报告继续。

每个任务完成后必须写：

```text
docs/auto-execute/task-XX-report.md
docs/auto-execute/project-state.md
```

`project-state.md` 必须持续更新，作为下一个 Codex 的上下文入口。

---

## 4. 目录规范

请在项目中创建：

```text
docs/auto-execute/
  00-master-plan.md
  01-audit-report.md
  02-ui-inventory.md
  03-api-contract.md
  04-test-plan.md
  task-01-report.md
  task-02-report.md
  ...
  task-10-report.md
  project-state.md
  final-acceptance-report.md
```

如果项目已有类似目录，可以复用，但不要覆盖已有重要文档。

---

## 5. 任务拆解总览

| 任务 | Codex exec | 目标 | 是否改代码 |
|---|---:|---|---|
| Task 01 | 第 1 个 | 项目审计 + UI/PRD 映射 + 验收矩阵 | 少量文档 |
| Task 02 | 第 2 个 | 修复项目基础运行、依赖、启动脚本 | 是 |
| Task 03 | 第 3 个 | 数据模型、状态管理、API 合同、Mock 生成器 | 是 |
| Task 04 | 第 4 个 | 首页/核心生成页 UI 一比一复刻 | 是 |
| Task 05 | 第 5 个 | 上传文档流程：选择文件、校验、预览、传参 | 是 |
| Task 06 | 第 6 个 | 生成接口：AI 调用、JSON 校验、失败重试、fallback | 是 |
| Task 07 | 第 7 个 | 试卷预览、答案解析、整卷仿真简版 | 是 |
| Task 08 | 第 8 个 | PDF / Word 导出、下载/打开、付费墙 | 是 |
| Task 09 | 第 9 个 | 免费额度、定价页、购买记录、生成记录 | 是 |
| Task 10 | 第 10 个 | 全流程测试、截图验收、最终修复、交付报告 | 是 |

---

# 6. $Auto-Execute 总控提示词

下面这一整段可以直接复制给 `$Auto-Execute`：

```text
你现在接管项目 D:\lyh\agent\agent-frame\printersheet。

需求文档：
D:\lyh\agent\agent-frame\printersheet\docs\AI_worksheet_print_tool_PRD_v1.md

UI 设计目录：
D:\lyh\agent\agent-frame\printersheet\docs\UI\

现有代码：
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp

目标：
基于 PRD、UI 图片和现有部分代码，完成 AI 练习卷/AI 出题小助手小程序。要求 UI 尽量一比一复刻，核心功能完整可用，并完成全流程测试。

核心验收流程必须跑通：
1. 打开小程序。
2. 输入“生成 10 道初一数学一元一次方程中等题，带答案解析，适合打印”。
3. 点击生成。
4. 页面展示试卷标题、题目列表、答案解析。
5. 支持上传 PDF / Word / 图片 / 文档资料，并能进入生成试题流程。
6. 支持普通练习模式。
7. 支持整卷仿真简版：上传试卷/资料后生成结构相似、知识点相似、难度相近的新试卷。
8. 支持 PDF 导出/打开。
9. 支持 Word 导出/打开，或在 MVP 中提供清晰的付费提示与接口占位。
10. 免费额度减少。
11. 免费额度用完后出现付费提示。
12. 有定价页/购买入口。
13. 如 UI 中有“生成记录”和“购买记录”，MVP 先用本地缓存/模拟数据实现。
14. API Key 不得暴露到前端。
15. 上传文件不得长期保存。
16. 不要接真实生产支付，不要写真实密钥。
17. 不要直接 push 到远程 main，除非我单独授权。

执行方式：
请串行创建 10 个 Codex exec 子任务，每个任务完成后关闭上下文，并写交接文档。不要并行改同一批代码，避免冲突。

每个子任务必须：
1. 先阅读 docs/auto-execute/project-state.md，如果不存在就创建。
2. 先阅读 PRD 和 docs/UI 相关内容。
3. 明确本任务的文件修改范围。
4. 尽量小步修改，不做无关重构。
5. 执行可用的 lint/build/test/smoke 检查。
6. 把结果写入 docs/auto-execute/task-XX-report.md。
7. 更新 docs/auto-execute/project-state.md。
8. 如果测试失败，必须先尝试修复；无法修复时写清楚原因、复现命令、下一步建议。

任务列表：
Task 01：项目审计 + UI/PRD 映射 + 验收矩阵。
Task 02：修复项目基础运行、依赖、启动脚本。
Task 03：数据模型、状态管理、API 合同、Mock 生成器。
Task 04：首页/核心生成页 UI 一比一复刻。
Task 05：上传文档流程：选择文件、校验、预览、传参。
Task 06：生成接口：AI 调用、JSON 校验、失败重试、fallback。
Task 07：试卷预览、答案解析、整卷仿真简版。
Task 08：PDF / Word 导出、下载/打开、付费墙。
Task 09：免费额度、定价页、购买记录、生成记录。
Task 10：全流程测试、截图验收、最终修复、交付报告。

最终必须输出：
1. docs/auto-execute/final-acceptance-report.md
2. 完整启动命令
3. 完整测试命令
4. 已完成/未完成清单
5. UI 对照说明
6. 核心流程测试结果
7. 上传文档生成试题测试结果
8. PDF / Word 导出测试结果
9. 风险和后续建议
```

---

# 7. 每个 Codex Exec 的详细提示词

## Task 01：项目审计 + UI/PRD 映射 + 验收矩阵

```text
你是第 1 个 Codex exec。只做项目审计和计划，不要大规模改代码。

项目路径：
D:\lyh\agent\agent-frame\printersheet

必须阅读：
1. docs\AI_worksheet_print_tool_PRD_v1.md
2. docs\UI\ 下所有 UI 图片/说明
3. ai-exam-miniapp 下现有代码结构

你的任务：
1. 审计 ai-exam-miniapp 当前技术栈：是否微信原生小程序、uni-app、Taro、Vue、React 或其他。
2. 找出启动方式、构建方式、测试方式。
3. 扫描页面、组件、接口、配置、静态资源。
4. 盘点 docs/UI/ 中所有图片，建立 UI 页面映射表。
5. 把 PRD 功能拆成验收矩阵：
   - 输入生成
   - 上传文件
   - AI 生成
   - 预览试卷
   - 答案解析
   - PDF 导出
   - Word 导出
   - 免费额度
   - 付费提示
   - 定价页
   - 生成记录
   - 购买记录
   - 整卷仿真简版
6. 明确哪些功能已有、哪些缺失、哪些半成品。
7. 不要安装依赖，除非只是读取 package。
8. 不要删除或重构代码。

输出文档：
1. docs/auto-execute/01-audit-report.md
2. docs/auto-execute/02-ui-inventory.md
3. docs/auto-execute/04-test-plan.md
4. docs/auto-execute/task-01-report.md
5. docs/auto-execute/project-state.md

project-state.md 必须包含：
- 当前技术栈
- 运行命令
- 测试命令
- 页面列表
- 接口列表
- 已完成功能
- 缺失功能
- 下一任务建议
```

---

## Task 02：修复项目基础运行、依赖、启动脚本

```text
你是第 2 个 Codex exec。先阅读 docs/auto-execute/project-state.md 和 task-01-report.md。

目标：
让项目可以稳定启动、构建、检查。只解决基础运行问题，不做业务大功能。

任务：
1. 根据现有技术栈修复依赖、配置和启动脚本。
2. 如果是微信原生小程序，确保 project.config.json、app.json、页面路径、组件引用正确。
3. 如果有 Node/后端/云函数，确保本地 mock 或开发环境可以启动。
4. 修复明显的 TypeScript/JS/WXML/WXSS/配置错误。
5. 不要引入不必要的大依赖。
6. 如需新增依赖，必须说明原因。
7. 添加或修复基础 lint/build/check 命令。
8. 保证后续任务可以在稳定基础上继续开发。

验收：
1. 项目能被微信开发者工具打开，或对应技术栈能正常启动。
2. 无明显缺失页面路径。
3. 无基础语法错误。
4. 文档中写清楚运行方式。

输出：
1. docs/auto-execute/task-02-report.md
2. 更新 docs/auto-execute/project-state.md
```

---

## Task 03：数据模型、状态管理、API 合同、Mock 生成器

```text
你是第 3 个 Codex exec。先阅读 docs/auto-execute/project-state.md。

目标：
先把核心数据结构和接口合同搭好，后续 UI 和功能都基于统一 schema。

任务：
1. 定义 Worksheet 数据结构：
   - title
   - grade
   - subject
   - mode: practice | exam_simulation
   - questions
   - answerKey
   - cost
   - sourceFileInfo
2. 定义 Question 数据结构：
   - number
   - section
   - type
   - difficulty
   - skill
   - question
   - options
   - answer
   - explanation
3. 定义 PaperBlueprint 数据结构，用于整卷仿真简版。
4. 封装 API client：
   - generateWorksheet(params)
   - exportPdf(worksheet)
   - exportDocx(worksheet)
   - getPlans()
   - createMockPurchase(planId)
5. 增加 mock 生成器：
   - 没有真实 AI 环境变量时，仍可生成一份稳定的练习卷。
   - mock 必须包含 10 道初一一元一次方程题、答案和解析。
6. 增加 JSON 校验函数：
   - validateWorksheet
   - normalizeWorksheet
   - repairWorksheetIfPossible
7. 不要把 API Key 写入前端。
8. 如果当前只有小程序端，真实 AI 调用先通过云函数/后端接口占位，不在前端直接调用模型。

验收：
1. 前端可以调用 mock generateWorksheet 拿到标准 worksheet。
2. 数据结构有类型/注释/校验。
3. 后续页面不再各自定义混乱字段。

输出：
1. docs/auto-execute/03-api-contract.md
2. docs/auto-execute/task-03-report.md
3. 更新 docs/auto-execute/project-state.md
```

---

## Task 04：首页/核心生成页 UI 一比一复刻

```text
你是第 4 个 Codex exec。先阅读 docs/auto-execute/project-state.md 和 docs/auto-execute/02-ui-inventory.md。

目标：
根据 docs/UI/ 中的 UI 图片，把首页/核心生成页做到尽量一比一复刻。

任务：
1. 找出 UI 图片中对应首页/生成页的设计。
2. 实现页面结构：
   - 顶部标题/品牌
   - 主输入区
   - 上传区
   - 快捷题型/示例 prompt
   - 高级选项，如果 UI 有
   - 生成按钮
   - 额度提示
   - 结果预览区入口
3. 复刻：
   - 背景色
   - 卡片圆角
   - 阴影
   - 字体大小
   - 间距
   - icon/插画/按钮样式
   - 空状态
   - loading 状态
   - disabled 状态
4. 接入 Task 03 的 mock generateWorksheet，使点击生成后能出现结果。
5. 不要为了 UI 改坏 API 合同。
6. 如果 UI 图片有 6 张页面图，至少先完成首页和生成结果页的主视觉。

验收：
1. 页面可以输入。
2. 点击生成显示 loading。
3. 生成成功后出现 worksheet 结果。
4. UI 观感接近 docs/UI 图片。
5. 不出现明显布局错乱。

输出：
1. docs/auto-execute/task-04-report.md
2. 更新 docs/auto-execute/project-state.md
3. 如能截图，保存到 docs/auto-execute/screenshots/
```

---

## Task 05：上传文档流程

```text
你是第 5 个 Codex exec。先阅读 docs/auto-execute/project-state.md。

目标：
完成上传文件主流程，特别是“上传文档 → 生成试题”的核心功能链路。

任务：
1. 实现上传入口：
   - PDF
   - Word/docx
   - 图片
   - 其他微信允许选择的文档类型
2. 实现文件校验：
   - 文件类型
   - 文件大小
   - 免费版页数/数量限制提示
3. 上传后展示文件卡片：
   - 文件名
   - 文件类型
   - 文件大小
   - 删除/重新选择
   - 解析状态
4. 点击生成时，把 fileInfo/sourceFile 传入 generateWorksheet。
5. 如果没有后端解析能力，先做 MVP 降级：
   - 小程序端不直接解析复杂文档
   - 上传文件信息进入生成参数
   - mock/后端根据文件名和用户 prompt 生成题目
   - UI 上提示“文件已用于生成参考”
6. 预留后端/云函数解析接口：
   - uploadAndExtractText
   - extractPdfText
   - extractDocxText
   - ocrImage
7. 确保上传文件不会被长期保存。
8. 编写至少一个上传流程测试或手工测试说明。

验收：
1. 用户可以选择文件。
2. 文件卡片正常显示。
3. 可以删除文件。
4. 带文件点击生成后能生成试题。
5. 上传文档生成试题流程必须在最终报告中重点说明。

输出：
1. docs/auto-execute/task-05-report.md
2. 更新 docs/auto-execute/project-state.md
```

---

## Task 06：生成接口：AI 调用、JSON 校验、失败重试、fallback

```text
你是第 6 个 Codex exec。先阅读 docs/auto-execute/project-state.md 和 docs/auto-execute/03-api-contract.md。

目标：
完成真实 AI 生成接口封装，同时保留 mock fallback，保证没有密钥也能测试完整流程。

任务：
1. 根据现有架构选择正确位置实现服务端/云函数/后端接口。
2. 环境变量命名：
   - AI_API_KEY
   - AI_BASE_URL
   - AI_MODEL
   - AI_MOCK_MODE
3. 实现普通练习 prompt：
   - 中小学教研出题老师
   - 输出严格 JSON
   - 包含 title、grade、subject、mode、questions、answerKey
4. 实现整卷仿真 prompt：
   - 分析结构、题型、知识点、难度
   - 生成新题
   - 不复制原题
5. 实现 JSON 解析：
   - 提取纯 JSON
   - schema 校验
   - 字段修复
   - 失败重试 1 次
6. 实现 fallback：
   - AI_API_KEY 不存在时使用 mock worksheet
   - AI 接口失败时提示错误并可 fallback mock，方便测试
7. 小程序端不得直接持有 AI_API_KEY。
8. 打印服务端日志，但不要记录完整用户隐私文件内容。

验收：
1. 有真实 AI 配置时可走真实生成。
2. 无 AI 配置时 mock 生成可用。
3. 生成结果符合 Worksheet schema。
4. 错误状态前端可见，不会白屏。

输出：
1. docs/auto-execute/task-06-report.md
2. 更新 docs/auto-execute/project-state.md
```

---

## Task 07：试卷预览、答案解析、整卷仿真简版

```text
你是第 7 个 Codex exec。先阅读 docs/auto-execute/project-state.md。

目标：
把生成结果展示成真正像“可打印练习卷”的预览，而不是普通聊天文本。

任务：
1. 实现试卷预览组件：
   - 标题
   - 年级
   - 学科
   - 难度
   - 学生信息栏
   - 题目分区
   - 题号
   - 选择题选项
   - 填空题空线
   - 解答题答题区
2. 实现答案解析版：
   - 答案列表
   - 简洁解析
   - 可折叠/切换显示
3. 实现普通练习模式和整卷仿真模式的视觉区别。
4. 整卷仿真简版：
   - 上传文件后可选择/自动进入 exam_simulation
   - 显示“结构相似、知识点相似、难度相近”
   - 生成结果不能显示“复制原题”
5. 实现重新生成。
6. 实现空状态、失败状态、loading 状态。

验收：
1. 生成结果像正式练习卷。
2. 有学生练习版。
3. 有答案解析版。
4. 整卷仿真模式入口和结果可见。
5. UI 不明显崩坏。

输出：
1. docs/auto-execute/task-07-report.md
2. 更新 docs/auto-execute/project-state.md
```

---

## Task 08：PDF / Word 导出、下载/打开、付费墙

```text
你是第 8 个 Codex exec。先阅读 docs/auto-execute/project-state.md。

目标：
完成 PDF / Word 导出主流程，至少保证 MVP 可用。

任务：
1. 实现 PDF 导出/打开：
   - 免费版带水印或品牌标识
   - 题目排版适合打印
   - 包含答案解析页
2. 实现 Word 导出/打开：
   - 如果已有后端能力，生成 docx
   - 如果暂不具备真实 docx，做付费提示 + 接口占位 + 明确后续实现点
3. 小程序中处理文件：
   - 下载临时文件
   - openDocument
   - 错误提示
4. 实现付费墙：
   - 点击无水印 PDF
   - 点击 Word
   - 点击完整答案页
   - 点击整卷仿真高级能力
5. 不要接真实生产支付。
6. 免费 PDF 必须可测试。
7. 如果当前技术栈无法本地生成 PDF，允许先通过服务端/云函数接口占位，但前端流程必须完整。

验收：
1. 点击 PDF 可以得到文件或打开文件。
2. PDF 内容包含题目和答案解析。
3. 点击 Word 有真实导出或清晰升级提示。
4. 付费墙不会阻塞免费基础体验。
5. 错误状态清晰。

输出：
1. docs/auto-execute/task-08-report.md
2. 更新 docs/auto-execute/project-state.md
```

---

## Task 09：免费额度、定价页、购买记录、生成记录

```text
你是第 9 个 Codex exec。先阅读 docs/auto-execute/project-state.md 和 UI inventory。

目标：
完成商业闭环相关页面和状态。

任务：
1. 实现免费额度：
   - 默认 2 点
   - 普通生成扣 1 点
   - 高级/整卷可提示需要升级
   - 额度不足出现付费弹窗
2. 实现定价页/套餐页：
   - Free：¥0，2 点，带水印 PDF
   - Starter：¥9.9/月，30 点
   - Pro：¥19.9/月，80 点，PDF + Word + 答案页
   - Teacher：¥39.9/月，200 点，无水印，整卷仿真
3. 实现购买入口：
   - MVP 可模拟购买成功
   - 记录购买记录
   - 不接真实支付密钥
4. 实现生成记录：
   - 最近生成标题
   - 时间
   - 模式
   - 可再次查看
   - MVP 可用本地缓存
5. 实现购买记录：
   - 套餐名
   - 金额
   - 时间
   - 状态
   - MVP 可用本地缓存
6. 如果 UI 已有“我的”页面，按 UI 实现。
7. 如果 UI 没有完整记录页，不强行复杂化，但至少要有入口和基本列表。

验收：
1. 免费额度能显示和扣减。
2. 额度用完会弹出付费提示。
3. 定价页可打开。
4. 模拟购买后额度/套餐状态可变化。
5. 生成记录和购买记录可查看。
6. 关闭重开后本地缓存尽量保留。

输出：
1. docs/auto-execute/task-09-report.md
2. 更新 docs/auto-execute/project-state.md
```

---

## Task 10：全流程测试、截图验收、最终修复、交付报告

```text
你是第 10 个 Codex exec。先阅读所有 docs/auto-execute/task-*-report.md 和 project-state.md。

目标：
做最终全流程验收，不是继续大规模开发。发现阻塞问题要修，非阻塞问题写入报告。

必须测试的主流程：
1. 打开首页。
2. 输入：
   生成 10 道初一数学一元一次方程中等题，带答案解析，适合打印。
3. 点击生成。
4. 查看试卷预览。
5. 查看答案解析。
6. 下载/打开 PDF。
7. 点击 Word，验证导出或升级提示。
8. 上传 PDF / Word / 图片 / 文档资料。
9. 带文件生成试题。
10. 测试整卷仿真简版。
11. 连续生成 2 次，验证免费额度扣减。
12. 第 3 次验证付费提示。
13. 打开定价页。
14. 模拟购买。
15. 查看生成记录。
16. 查看购买记录。

技术检查：
1. lint/check/build/test，按项目可用命令执行。
2. 检查是否有前端泄露 AI_API_KEY。
3. 检查是否长期保存上传文件。
4. 检查是否有明显 console error。
5. 检查是否有明显 UI 崩坏。
6. 检查文档是否完整。

如能截图：
保存核心页面截图到：
docs/auto-execute/screenshots/

最终输出：
1. docs/auto-execute/final-acceptance-report.md
2. docs/auto-execute/task-10-report.md
3. 更新 docs/auto-execute/project-state.md

final-acceptance-report.md 必须包含：
1. 最终完成情况
2. 启动命令
3. 测试命令
4. 核心流程测试结果
5. 上传文档生成试题测试结果
6. PDF 测试结果
7. Word 测试结果
8. UI 一比一复刻说明
9. 未完成项
10. 风险
11. 下一步建议
```

---

# 8. 最终验收标准

## 8.1 P0 必须通过

```text
P0-01 首页可打开
P0-02 输入文本可生成试题
P0-03 上传文档后可生成试题
P0-04 试题结果可预览
P0-05 答案解析可查看
P0-06 PDF 可导出/打开
P0-07 Word 有导出或付费提示
P0-08 免费额度可扣减
P0-09 额度不足有付费提示
P0-10 定价/购买入口可打开
P0-11 生成记录可查看
P0-12 购买记录可查看
P0-13 整卷仿真简版可触发
P0-14 API Key 不在前端
P0-15 上传文件不长期保存
```

## 8.2 P1 尽量通过

```text
P1-01 UI 与 docs/UI 图片高度一致
P1-02 PDF 排版适合打印
P1-03 Word 可编辑文件真实生成
P1-04 图片 OCR 真实可用
P1-05 付费套餐状态完整
P1-06 错误提示完整
P1-07 loading/empty/error 状态完整
P1-08 测试脚本覆盖核心流程
```

---

# 9. 推荐给 Codex 的执行纪律

每个 Codex exec 都必须遵守：

```text
1. 不要假装完成。没有跑通就写未跑通。
2. 不要只写页面，不接流程。
3. 不要只接 mock，不预留真实 AI 接口。
4. 不要把密钥放前端。
5. 不要绕过上传文档生成试题这个核心验收点。
6. 不要无限扩大范围。
7. 不要引入复杂数据库。
8. 不要接真实生产支付。
9. 不要覆盖 UI 资源。
10. 不要直接 push main。
```

---

# 10. 你可以直接对 $Auto-Execute 说的简化版

如果你不想粘贴上面很长的内容，可以用这个短版：

```text
请在 D:\lyh\agent\agent-frame\printersheet 项目中，按照 docs\AI_worksheet_print_tool_PRD_v1.md 和 docs\UI\ 设计图，串行创建 10 个 codex exec 子任务，完成 ai-exam-miniapp 的全部 MVP 功能和全流程测试。

要求：
1. UI 按 docs\UI\ 尽量一比一复刻。
2. 核心流程必须跑通：输入要求/上传文档 → 生成试题 → 预览 → 答案解析 → PDF → Word/升级提示 → 免费额度扣减 → 付费提示。
3. 上传文档生成试题是重点验收项，必须测试。
4. 支持普通练习和整卷仿真简版。
5. 支持免费 2 点、定价页、购买入口、生成记录、购买记录。
6. 不要把 AI_API_KEY 放前端。
7. 不要长期保存上传文件。
8. 不要接真实生产支付，不要写真实密钥。
9. 每个 codex exec 完成后写 docs/auto-execute/task-XX-report.md，并更新 docs/auto-execute/project-state.md。
10. 最后输出 docs/auto-execute/final-acceptance-report.md，包含启动命令、测试命令、核心流程测试结果、上传测试结果、PDF/Word 测试结果、UI 对照说明、未完成项和风险。

任务拆分：
Task 01 项目审计 + UI/PRD 映射 + 验收矩阵
Task 02 修复项目基础运行、依赖、启动脚本
Task 03 数据模型、状态管理、API 合同、Mock 生成器
Task 04 首页/核心生成页 UI 一比一复刻
Task 05 上传文档流程
Task 06 生成接口：AI 调用、JSON 校验、失败重试、fallback
Task 07 试卷预览、答案解析、整卷仿真简版
Task 08 PDF / Word 导出、下载/打开、付费墙
Task 09 免费额度、定价页、购买记录、生成记录
Task 10 全流程测试、截图验收、最终修复、交付报告
```

---

# 11. 我的建议

这次不要让 Codex 一口气“自由发挥”。  
最稳的方式是：

```text
10 个任务串行
每个任务只解决一个层级
每个任务都写交接文档
最后一个任务只做验收和修复
```

这样可以最大程度避免：

- 上下文爆掉
- UI 做了一半
- 接口没接上
- 上传流程没测
- PDF/Word 只是按钮
- 免费额度只是文案
- 最后没人知道到底完成到哪里

本项目真正的 P0 不是页面多漂亮，而是：

```text
用户上传资料或输入要求后，真的能得到一份像样的、可打印的练习卷。
```
