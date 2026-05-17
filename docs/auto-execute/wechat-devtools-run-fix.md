# 微信开发者工具运行修复记录

时间：2026-05-16

## 问题

微信开发者工具日志出现：

```text
app.json: 在项目根目录未找到 app.json
```

原因是 DevTools 打开的目录是父目录或仓库根目录，而 `app.json` 实际在：

```text
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram\app.json
```

## 已修复

1. `ai-exam-miniapp/project.config.json` 增加：

```json
"miniprogramRoot": "miniprogram/"
```

现在打开 `ai-exam-miniapp` 父目录也能正确定位小程序源码。

2. 仓库根目录 `project.config.json` 增加：

```json
"miniprogramRoot": "ai-exam-miniapp/miniprogram/"
```

即使误打开 `printersheet` 根目录，也能定位小程序。

3. `ai-exam-miniapp/miniprogram/app.json` 增加：

```json
"lazyCodeLoading": "requiredComponents"
```

用于解决代码质量里的“启用组件按需注入”未通过。

4. 本地调试 AppID 统一为：

```text
touristappid
```

这样不需要真实小程序账号即可本地看效果。

## 当前正确打开方式

推荐在微信开发者工具中打开：

```text
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp
```

或者直接打开：

```text
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp\miniprogram
```

## 后端状态

后端已启动：

```text
http://127.0.0.1:8787
```

健康检查：

```text
GET /health => {"ok":true}
```

## 仍需你在 DevTools 内操作

如果仍白屏/报网络：

1. 点击“编译”或 Ctrl+B。
2. 详情 -> 本地设置 -> 勾选“不校验合法域名”。
3. 如果提示登录，可选择游客/测试号本地调试；当前配置不要求真实 AppID。

