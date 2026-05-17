你是 printersheet 项目的一个 fresh Codex exec worker。必须遵守：
- 工作目录：D:\lyh\agent\agent-frame\printersheet
- 先读 D:\lyh\agent\agent-frame\AGENTS.md、docs\printersheet_auto_execute_plan.md、docs\AI_worksheet_print_tool_PRD_v1.md、docs\auto-execute\project-state.md（若存在）和与你任务相关的代码/文档。
- 这是多 Codex exec 串行执行的一环；不要假装自己是唯一执行者。
- 不要 push、commit、reset、clean、删除 docs/UI 资产、写真实密钥、接真实生产支付、做破坏性操作。
- 保留现有可用代码；若功能已存在，要验证并记录证据；若发现小缺口，允许做小步修复。
- 优先运行可用检查：server 目录 npm test；必要时 node --check 相关 JS；无法运行要写原因。
- 任务结束必须写 docs/auto-execute/task-XX-report.md，并更新 docs/auto-execute/project-state.md。
- 报告必须包含：修改范围、验证命令与结果、已完成/未完成、交给下一个 worker 的建议。

当前任务编号：Task 02
当前任务标题：修复项目基础运行、依赖、启动脚本

任务要求：
让项目基础运行/测试稳定。检查微信原生小程序配置、app.json 页面路径、Node server package/scripts、明显 JS/配置错误。不要业务大改。运行 npm test 和 node --check（可行范围）。输出 task-02-report.md 并更新 project-state.md。

结束条件：
1. 写出 docs/auto-execute/task-02-report.md。
2. 更新 docs/auto-execute/project-state.md。
3. 最终回复简短说明完成/阻塞和证据路径。
