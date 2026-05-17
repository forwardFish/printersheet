// 修改这里接入真实后端。
// 微信开发者工具本地调试时：设置为 http://127.0.0.1:8787，并勾选“不校验合法域名”。
// 线上小程序必须改成 HTTPS 合法域名。
module.exports = {
  API_BASE_URL: 'http://127.0.0.1:8787',
  USE_MOCK_API: false,
  REQUEST_TIMEOUT_MS: 300000,
  UPLOAD_TIMEOUT_MS: 300000,
  DOWNLOAD_TIMEOUT_MS: 300000,
  APP_NAME: 'AI出题小助手'
}
