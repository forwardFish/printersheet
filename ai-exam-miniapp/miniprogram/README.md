# 小程序前端说明

入口页面：`pages/index/index`

本地调试：

1. 先启动 `../server` 后端。
2. 确认 `utils/config.js` 的 `API_BASE_URL` 为后端地址。
3. 微信开发者工具勾选“不校验合法域名”。
4. 首页输入真实出题要求。
5. 点击生成后进入预览页，下载 PDF / Word。

`USE_MOCK_API` 不再提供模拟出题或 demo 练习卷；打开后，出题相关接口会直接报错。
