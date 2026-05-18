# round1 UI 复刻像素验收

## 结论

- 当前最强 verdict：`BLOCKED_BY_ENVIRONMENT`。
- 已完成：微信开发者工具 CLI 路径确认、`miniprogram-automator` / `pngjs` / `pixelmatch` 工具链落地、分享海报静态 PNG 像素对比。
- 未完成：真实小程序页面截图。开发者工具自动化端口未能稳定提供可用的小程序页面会话，`capture-summary.json` 中记录为环境阻塞。

## 证据

- 微信开发者工具 CLI：`D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`。
- 截图报告：`docs/UI/小程序/复刻对比/round1/capture-summary.json`。
- 像素报告：`docs/UI/小程序/复刻对比/round1/pixelmatch-summary.json`。
- 分享海报对比：`share-poster/metrics.json`，差异比例 `0%`。

## 复跑命令

```powershell
cd D:\lyh\agent\agent-frame\printersheet\tools\ui-visual
npm run capture
npm run compare
```

如 `capture` 继续失败，请先在微信开发者工具中确认：

1. 已导入 `D:\lyh\agent\agent-frame\printersheet`。
2. 已开启“设置 -> 安全设置 -> 服务端口”。
3. 项目 AppID/测试号配置可以正常进入模拟器页面。
