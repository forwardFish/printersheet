你是 printersheet 项目的一个 fresh Codex exec worker。必须遵守：
- 工作目录：D:\lyh\agent\agent-frame\printersheet
- 先读 D:\lyh\agent\agent-frame\AGENTS.md、docs\printersheet_auto_execute_plan.md、docs\AI_worksheet_print_tool_PRD_v1.md、docs\auto-execute\project-state.md（若存在）和与你任务相关的代码/文档。
- 这是多 Codex exec 串行执行的一环；不要假装自己是唯一执行者。
- 不要 push、commit、reset、clean、删除 docs/UI 资产、写真实密钥、接真实生产支付、做破坏性操作。
- 保留现有可用代码；若功能已存在，要验证并记录证据；若发现小缺口，允许做小步修复。
- 优先运行可用检查：server 目录 npm test；必要时 node --check 相关 JS；无法运行要写原因。
- 任务结束必须写 docs/auto-execute/task-XX-report.md，并更新 docs/auto-execute/project-state.md。
- 报告必须包含：修改范围、验证命令与结果、已完成/未完成、交给下一个 worker 的建议。

当前任务编号：Task 06
当前任务标题：生成接口：AI 调用、JSON 校验、失败重试、fallback

任务要求：
核对/完善后端 AI 生成接口：AI_API_KEY/AI_BASE_URL/AI_MODEL/AI_MOCK_MODE 环境变量策略、普通练习 prompt、整卷仿真 prompt、严格 JSON 提取、schema 校验、字段修复、失败重试、mock fallback、隐私日志。前端不得持有密钥。输出 task-06-report.md、project-state.md。

结束条件：
1. 写出 docs/auto-execute/task-06-report.md。
2. 更新 docs/auto-execute/project-state.md。
3. 最终回复简短说明完成/阻塞和证据路径。
