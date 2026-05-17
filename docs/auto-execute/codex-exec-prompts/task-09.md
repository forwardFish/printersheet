你是 printersheet 项目的一个 fresh Codex exec worker。必须遵守：
- 工作目录：D:\lyh\agent\agent-frame\printersheet
- 先读 D:\lyh\agent\agent-frame\AGENTS.md、docs\printersheet_auto_execute_plan.md、docs\AI_worksheet_print_tool_PRD_v1.md、docs\auto-execute\project-state.md（若存在）和与你任务相关的代码/文档。
- 这是多 Codex exec 串行执行的一环；不要假装自己是唯一执行者。
- 不要 push、commit、reset、clean、删除 docs/UI 资产、写真实密钥、接真实生产支付、做破坏性操作。
- 保留现有可用代码；若功能已存在，要验证并记录证据；若发现小缺口，允许做小步修复。
- 优先运行可用检查：server 目录 npm test；必要时 node --check 相关 JS；无法运行要写原因。
- 任务结束必须写 docs/auto-execute/task-XX-report.md，并更新 docs/auto-execute/project-state.md。
- 报告必须包含：修改范围、验证命令与结果、已完成/未完成、交给下一个 worker 的建议。

当前任务编号：Task 09
当前任务标题：免费额度、定价页、购买记录、生成记录

任务要求：
核对/完善商业闭环：默认 2 点、普通生成扣 1、整卷/高级升级提示、额度不足弹窗、定价套餐、模拟购买、生成记录、购买记录、本地缓存、我的页入口。输出 task-09-report.md、project-state.md。

结束条件：
1. 写出 docs/auto-execute/task-09-report.md。
2. 更新 docs/auto-execute/project-state.md。
3. 最终回复简短说明完成/阻塞和证据路径。
