你是 printersheet 项目的一个 fresh Codex exec worker。必须遵守：
- 工作目录：D:\lyh\agent\agent-frame\printersheet
- 先读 D:\lyh\agent\agent-frame\AGENTS.md、docs\printersheet_auto_execute_plan.md、docs\AI_worksheet_print_tool_PRD_v1.md、docs\auto-execute\project-state.md（若存在）和与你任务相关的代码/文档。
- 这是多 Codex exec 串行执行的一环；不要假装自己是唯一执行者。
- 不要 push、commit、reset、clean、删除 docs/UI 资产、写真实密钥、接真实生产支付、做破坏性操作。
- 保留现有可用代码；若功能已存在，要验证并记录证据；若发现小缺口，允许做小步修复。
- 优先运行可用检查：server 目录 npm test；必要时 node --check 相关 JS；无法运行要写原因。
- 任务结束必须写 docs/auto-execute/task-XX-report.md，并更新 docs/auto-execute/project-state.md。
- 报告必须包含：修改范围、验证命令与结果、已完成/未完成、交给下一个 worker 的建议。

当前任务编号：Task 10
当前任务标题：全流程测试、截图验收、最终修复、交付报告

任务要求：
最终全流程验收和小修：文本生成、预览、答案、PDF、Word/升级提示、PDF/DOCX 上传生成、整卷仿真、连续生成点数扣减、点数不足提示、定价页、模拟购买、生成/购买记录、密钥守卫、上传临时文件清理。必须运行 npm test；可行时 node --check。输出 task-10-report.md、final-acceptance-report.md、project-state.md。

结束条件：
1. 写出 docs/auto-execute/task-10-report.md。
2. 更新 docs/auto-execute/project-state.md。
3. 最终回复简短说明完成/阻塞和证据路径。
