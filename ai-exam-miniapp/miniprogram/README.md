# 小程序前端说明

入口页面：`pages/index/index`

本地调试：

1. 先启动 `../server` 后端。
2. 确认 `utils/config.js` 的 `API_BASE_URL` 为后端地址。
3. 微信开发者工具勾选“不校验合法域名”。
4. 首页输入：`生成10道初一数学一元一次方程中等题，带答案解析`。
5. 点击“一键生成练习卷”。
6. 进入预览页，点击下载 PDF / Word。

如果想纯前端演示，把 `utils/config.js` 的 `USE_MOCK_API` 改成 `true`。
