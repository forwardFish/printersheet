# AI 出题小助手：上线前 P0 主链路开发文档 v2

> 目标读者：Codex / oh-my-codex / 后续接手工程师  
> 项目路径：`D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp`  
> 当前版本判断：本地 MVP 闭环已完成，但不能直接真实上线收费运营  
> 下一个开发目标：补齐上线前必须完成的生产级主链路  
> P0 主链路：**微信登录 + 数据库 + 服务端点数 + 微信支付 + 权限校验 + 文件存储**  
> 推荐上线基础设施：**微信小程序 + CloudBase 云托管 Node/Express + CloudBase 数据库 + CloudBase 云存储 + 微信支付/小程序虚拟支付 + 外部 AI 大模型 API**

---

## 0. 本文档要解决什么问题

当前项目已经可以演示：

```text
输入/上传资料 → 生成试卷 → 预览 → 导出 PDF/Word → 本地记录 → 本地模拟购买
```

但这个闭环是“本地 MVP 闭环”，不是“真实收费上线闭环”。

当前最大风险不是页面，而是：

```text
1. 用户身份不可信
2. 点数余额不可信
3. 订单支付不可信
4. 生成记录不可恢复
5. 文件不持久
6. Word / 无水印 / 会员权益主要靠前端判断
7. 清缓存、换手机、重登后数据丢失
8. 用户可以篡改本地 wx.setStorageSync 绕过点数和权益
```

本次开发的目标不是继续加页面，也不是继续打磨 UI，而是把项目从：

```text
本地演示型小程序
```

升级为：

```text
可以小范围真实上线收费的轻量生产版本
```

---

## 1. 一句话结论

当前版本可以定义为：

```text
PASS_WITH_LIMITATION：本地 MVP 可演示，但不能直接真实收费上线。
```

上线前必须先完成这一条主链路：

```text
真实微信登录
  → 后端创建/识别用户
  → 数据库保存用户/点数/订单/生成记录
  → 服务端校验余额和权益
  → 服务端生成试卷并扣点
  → 服务端保存 PDF/Word 文件
  → 微信支付回调确认后发放点数/会员
  → 小程序只展示后端结果，不再相信本地缓存
```

本次 P0 改造不追求复杂系统，只追求：

```text
数据不丢
点数不能伪造
支付能闭环
生成能落库
文件能下载
权限由后端控制
```

---

## 2. 当前已完成能力

### 2.1 小程序端已完成

```text
1. 首页 / 生成入口
2. 预览页
3. 登录页
4. 套餐页
5. 订单页
6. 我的页
7. 生成记录页
8. 购买记录页
9. 本地点数展示
10. 本地会员权益判断
```

### 2.2 后端已完成

```text
1. Node/Express 服务
2. AI 调用封装
3. 文本 / PDF / DOCX 上传生成 worksheet
4. PDF 导出
5. Word 导出
6. server/files 临时文件目录
7. server/uploads 临时上传目录
8. 30 分钟临时文件清理
```

### 2.3 商业入口已完成但仅为 mock

```text
1. 套餐页
2. 订单页
3. 模拟购买
4. 本地加点数
5. 本地购买记录
6. Word / 无水印等会员权益的前端判断
```

---

## 3. 当前不能上线的核心原因

### 3.1 用户身份是伪造的

当前登录逻辑：

```text
wx.login()
  → 得到临时 code
  → 截取 code 后 6 位
  → 当成本地 userId
```

问题：

```text
1. 没有真实 openid
2. 没有服务端用户
3. 没有 token
4. 不能跨设备识别用户
5. 不能绑定订单、点数、生成记录
```

### 3.2 点数是本地缓存

当前点数在小程序本地：

```text
wx.setStorageSync('POINTS', ...)
```

问题：

```text
1. 清缓存会丢
2. 换手机会丢
3. 用户可以篡改
4. 无法做支付到账核对
5. 无法做售后补点/退款
6. 无法做失败退点
```

### 3.3 支付是 mock

当前订单页逻辑：

```text
点击购买
  → 生成 mock_${Date.now()}
  → 本地加点数
  → 本地写购买记录
```

问题：

```text
1. 没有真实订单
2. 没有微信交易号
3. 没有支付回调验签
4. 没有幂等
5. 前端可以绕过支付
6. 后端不知道用户是否真的付钱
```

### 3.4 文件是本地临时文件

当前文件路径：

```text
server/files
server/uploads
```

问题：

```text
1. 服务重启可能丢
2. 重新部署可能丢
3. 多实例部署不同步
4. 没有用户隔离权限
5. 下载地址暴露为静态路径
6. 不能长期保留生成结果
```

### 3.5 权限靠前端判断

当前风险：

```text
1. 前端传 watermark:false 后端可能直接生成无水印
2. Word 导出可能只靠前端会员状态控制
3. 生成次数只靠前端本地判断
4. 用户可以篡改 member / points 缓存
```

上线后所有权限必须后端判断。

---

## 4. 本次 P0 开发范围

### 4.1 必须完成

```text
P0-1 真实微信登录后端化
P0-2 后端 token 鉴权
P0-3 数据库保存用户、点数、点数流水、订单、生成记录、文件元数据
P0-4 服务端点数系统
P0-5 服务端生成扣点与失败退点
P0-6 微信支付/虚拟支付回调闭环
P0-7 后端会员/权益/导出权限校验
P0-8 文件从本地临时目录迁移到云存储适配层
P0-9 小程序端去除本地真实业务存储
P0-10 本地开发 mock 环境完整可跑
P0-11 生产环境禁用 mock openid / mock payment
P0-12 smoke 测试与验收文档
```

### 4.2 可以预留但不强制上线

```text
1. OCR 扫描件能力
2. 后台管理页面
3. 复杂会员体系
4. 自动续费订阅
5. 邀请奖励/分享奖励
6. 复杂数据看板
7. PDF/Word 模板高级优化
8. 几何图重绘
```

### 4.3 明确不在本次做

```text
1. 不重写 UI
2. 不重写 AI 生成核心逻辑
3. 不做大型后台
4. 不做多角色权限系统
5. 不做复杂优惠券
6. 不做分销
7. 不自建 Kubernetes / Redis / MySQL 集群
```

---

## 5. 技术路线选择

### 5.1 推荐路线：CloudBase 轻量上线

项目当前是微信小程序，且低频、单次、小工具、用户数据少、文件相对多。

推荐路线：

```text
微信小程序
  ↓
CloudBase 云托管 Node/Express
  ↓
CloudBase 文档型数据库
  ↓
CloudBase 云存储
  ↓
微信支付 / 小程序虚拟支付
  ↓
外部 AI 大模型 API
```

原因：

```text
1. 最贴合微信小程序
2. 不需要单独买服务器
3. 不需要自己配置 Nginx/SSL
4. 不需要单独维护数据库
5. 不需要单独维护对象存储
6. 可以保留现有 Node/Express 生成服务
7. 适合 MVP 小范围上线
```

### 5.2 为什么 P0 不优先 PostgreSQL + Prisma

PostgreSQL + Prisma/Supabase/Neon 也可以，但对当前小程序 MVP 来说会增加：

```text
1. 数据库连接配置
2. 网络和跨域
3. 部署复杂度
4. 微信云环境和外部数据库之间的连接问题
5. 运维成本
```

本项目当前不是高并发复杂 SaaS，而是低频 AI 出题工具。  
P0 先用 CloudBase 文档数据库即可。

### 5.3 保留后续迁移空间

代码必须通过 Adapter 层隔离数据库：

```text
DbAdapter
  - LocalDbAdapter
  - CloudBaseDbAdapter
  - FuturePostgresDbAdapter 可后续追加
```

不要把 CloudBase SDK 调用散落在业务代码中。

---

## 6. 改造后的目标架构

```text
┌─────────────────────────────┐
│          微信小程序           │
│ login / index / order/history│
└──────────────┬──────────────┘
               │ wx.request + Bearer token
               ▼
┌─────────────────────────────┐
│   CloudBase 云托管 Node API   │
│       Express / REST API      │
└───────┬──────────┬──────────┘
        │          │
        │          ▼
        │   ┌─────────────────┐
        │   │ 外部 AI 大模型 API│
        │   └─────────────────┘
        │
        ▼
┌─────────────────────────────┐
│      CloudBase 文档数据库     │
│ users / points / orders      │
│ records / files / ledger     │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│        CloudBase 云存储       │
│ uploads / generated PDF Word │
└─────────────────────────────┘
        ▲
        │
┌─────────────────────────────┐
│    微信支付/虚拟支付回调       │
└─────────────────────────────┘
```

---

## 7. 目录改造建议

### 7.1 当前核心文件

```text
miniprogram/utils/storage.js
miniprogram/pages/login/login.js
miniprogram/pages/order/order.js
miniprogram/pages/index/index.js
miniprogram/pages/history/*
miniprogram/pages/profile/*
server/src/index.js
README.md
```

### 7.2 后端建议新增目录

```text
server/src/app.js
server/src/index.js

server/src/config/env.js
server/src/config/products.js

server/src/middleware/auth.js
server/src/middleware/errorHandler.js
server/src/middleware/rateLimit.js

server/src/routes/auth.routes.js
server/src/routes/me.routes.js
server/src/routes/points.routes.js
server/src/routes/products.routes.js
server/src/routes/orders.routes.js
server/src/routes/pay.routes.js
server/src/routes/worksheets.routes.js
server/src/routes/files.routes.js
server/src/routes/dev.routes.js

server/src/services/auth.service.js
server/src/services/user.service.js
server/src/services/point.service.js
server/src/services/order.service.js
server/src/services/payment.service.js
server/src/services/worksheet.service.js
server/src/services/file.service.js
server/src/services/entitlement.service.js

server/src/adapters/db/index.js
server/src/adapters/db/localDbAdapter.js
server/src/adapters/db/cloudbaseDbAdapter.js

server/src/adapters/storage/index.js
server/src/adapters/storage/localFileAdapter.js
server/src/adapters/storage/cloudbaseStorageAdapter.js

server/src/adapters/payment/index.js
server/src/adapters/payment/mockPaymentProvider.js
server/src/adapters/payment/wechatPaymentProvider.js
server/src/adapters/payment/virtualPaymentProvider.js

server/src/utils/id.js
server/src/utils/time.js
server/src/utils/assert.js
server/src/utils/http.js
server/src/utils/safeFilename.js
server/src/utils/idempotency.js

server/scripts/smoke-all.js
server/scripts/smoke-auth.js
server/scripts/smoke-order.js
server/scripts/smoke-worksheet.js
```

### 7.3 小程序建议新增文件

```text
miniprogram/utils/config.js
miniprogram/utils/request.js
miniprogram/utils/api.js
miniprogram/utils/auth.js
```

### 7.4 文档建议新增

```text
docs/production-p0-mainline-dev-doc.md
docs/cloudbase-migration-audit.md
docs/cloudbase-deploy.md
docs/payment-integration.md
docs/verification-results.md
docs/security-checklist.md
```

---

## 8. 环境变量设计

新增 `server/.env.example`：

```env
# Runtime
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://127.0.0.1:3000

# Auth
JWT_SECRET=replace-with-a-long-random-secret
TOKEN_EXPIRES_IN=30d

# Provider selection
DB_PROVIDER=local
FILE_PROVIDER=local
PAYMENT_PROVIDER=mock

# WeChat Mini Program
WECHAT_APPID=
WECHAT_SECRET=

# CloudBase
CLOUDBASE_ENV_ID=
CLOUDBASE_SECRET_ID=
CLOUDBASE_SECRET_KEY=

# WeChat Pay / Virtual Pay
WECHAT_PAY_MCH_ID=
WECHAT_PAY_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_NOTIFY_URL=

# Internal admin / cleanup
INTERNAL_SECRET=replace-with-internal-secret

# AI Model
AI_PROVIDER=
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=

# File policy
UPLOAD_FILE_TTL_DAYS=7
GENERATED_FILE_TTL_DAYS=30

# Feature flags
ENABLE_DEV_PAYMENT=true
ENABLE_MOCK_OPENID=true
```

生产环境必须满足：

```env
NODE_ENV=production
DB_PROVIDER=cloudbase
FILE_PROVIDER=cloudbase
PAYMENT_PROVIDER=wechat
ENABLE_DEV_PAYMENT=false
ENABLE_MOCK_OPENID=false
```

生产环境禁止：

```text
1. JWT_SECRET 使用默认值
2. ENABLE_DEV_PAYMENT=true
3. ENABLE_MOCK_OPENID=true
4. PAYMENT_PROVIDER=mock
5. DB_PROVIDER=local
6. FILE_PROVIDER=local
```

---

## 9. 数据库集合设计

P0 必须有 7 个集合。

### 9.1 users

用途：保存真实微信用户。

```json
{
  "_id": "user_xxx",
  "openid": "wx_openid",
  "unionid": "wx_unionid_or_empty",
  "nickname": "微信用户",
  "avatar": "",
  "status": "active",
  "lastLoginAt": "2026-05-17T00:00:00.000Z",
  "createdAt": "2026-05-17T00:00:00.000Z",
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

索引：

```text
openid unique
unionid
createdAt
```

### 9.2 point_accounts

用途：保存用户当前余额。

```json
{
  "_id": "pa_xxx",
  "userId": "user_xxx",
  "balance": 3,
  "totalGranted": 3,
  "totalCharged": 0,
  "totalConsumed": 0,
  "totalRefunded": 0,
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

索引：

```text
userId unique
```

### 9.3 point_ledger

用途：点数流水，所有点数变化必须记录。

```json
{
  "_id": "pl_xxx",
  "userId": "user_xxx",
  "changeAmount": -1,
  "balanceBefore": 3,
  "balanceAfter": 2,
  "type": "consume",
  "bizType": "worksheet_generate",
  "bizId": "wr_xxx",
  "idempotencyKey": "consume:wr_xxx",
  "remark": "生成试卷消耗 1 点",
  "createdAt": "2026-05-17T00:00:00.000Z"
}
```

type 枚举：

```text
grant       注册赠送
recharge    支付充值
consume     生成消耗
refund      生成失败返还
adjust      后台调整
```

索引：

```text
userId + createdAt
idempotencyKey unique
bizId
```

### 9.4 orders

用途：保存订单和支付状态。

```json
{
  "_id": "order_xxx",
  "orderNo": "202605171234560001",
  "userId": "user_xxx",
  "productId": "points_10",
  "productType": "points",
  "productName": "10 次生成包",
  "pointsAmount": 10,
  "amountFen": 990,
  "currency": "CNY",
  "payChannel": "wechat_pay",
  "payStatus": "pending",
  "transactionId": "",
  "prepayId": "",
  "paidAt": null,
  "closedAt": null,
  "createdAt": "2026-05-17T00:00:00.000Z",
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

payStatus 枚举：

```text
pending
paid
closed
refunded
failed
```

索引：

```text
orderNo unique
userId + createdAt
payStatus
transactionId
```

### 9.5 worksheet_records

用途：保存生成记录。

```json
{
  "_id": "wr_xxx",
  "userId": "user_xxx",
  "requestId": "client_or_server_request_id",
  "title": "七年级数学相似题卷",
  "inputType": "text",
  "inputSummary": "整式运算、三角形三边关系、数轴",
  "difficulty": "medium",
  "questionJson": {},
  "answerJson": {},
  "status": "success",
  "pointsCost": 1,
  "sourceFileIds": ["fo_source_xxx"],
  "pdfFileId": "fo_pdf_xxx",
  "wordFileId": "fo_word_xxx",
  "entitlementSnapshot": {
    "watermarkFree": false,
    "canExportWord": true
  },
  "errorCode": "",
  "errorMessage": "",
  "createdAt": "2026-05-17T00:00:00.000Z",
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

status 枚举：

```text
generating
success
failed
cancelled
```

索引：

```text
userId + createdAt
userId + requestId unique
status
```

### 9.6 file_objects

用途：保存上传文件和生成文件元数据。

```json
{
  "_id": "fo_xxx",
  "userId": "user_xxx",
  "recordId": "wr_xxx",
  "fileRole": "generated_pdf",
  "objectKey": "generated/user_xxx/wr_xxx/paper.pdf",
  "originalName": "paper.pdf",
  "mimeType": "application/pdf",
  "size": 123456,
  "status": "active",
  "expiresAt": "2026-06-17T00:00:00.000Z",
  "createdAt": "2026-05-17T00:00:00.000Z"
}
```

fileRole 枚举：

```text
source_upload
generated_pdf
generated_word
```

status 枚举：

```text
active
expired
deleted
```

索引：

```text
userId + createdAt
recordId
objectKey
expiresAt
```

### 9.7 memberships

P0 可以预留，先不做复杂会员。

```json
{
  "_id": "mb_xxx",
  "userId": "user_xxx",
  "plan": "none",
  "status": "inactive",
  "startedAt": null,
  "expiresAt": null,
  "rights": {
    "watermarkFree": false,
    "canExportWord": false,
    "dailyLimit": null
  },
  "createdAt": "2026-05-17T00:00:00.000Z",
  "updatedAt": "2026-05-17T00:00:00.000Z"
}
```

---

## 10. 点数和商品规则

### 10.1 P0 商品

P0 不做复杂会员，先做点数包。

`server/src/config/products.js`：

```js
const PRODUCTS = [
  {
    id: 'points_10',
    type: 'points',
    name: '10 次生成包',
    points: 10,
    amountFen: 990,
    enabled: true
  },
  {
    id: 'points_30',
    type: 'points',
    name: '30 次生成包',
    points: 30,
    amountFen: 1990,
    enabled: true
  },
  {
    id: 'points_80',
    type: 'points',
    name: '80 次生成包',
    points: 80,
    amountFen: 3990,
    enabled: true
  }
]
```

### 10.2 点数规则

```text
1. 新用户注册送 3 点
2. 每生成一份试卷扣 1 点
3. PDF 下载不另扣点
4. Word 下载是否开放由后端 entitlement 判断
5. 生成失败必须退点
6. 支付成功后发放点数
7. 所有点数变化必须写 point_ledger
8. point_accounts.balance 不能小于 0
```

### 10.3 为什么采用“预扣 + 失败退点”

推荐生成流程：

```text
查余额
  → 创建生成记录
  → 预扣 1 点
  → 调 AI 生成
  → 成功保存记录和文件
  → 失败退回 1 点
```

原因：

```text
1. 避免并发生成导致余额透支
2. 避免用户重复点击多次都通过余额检查
3. 失败退点有流水可查
4. 便于售后核对
```

---

## 11. 权限模型

### 11.1 权限必须由后端计算

前端不能决定：

```text
1. 是否扣点
2. 是否无水印
3. 是否可以导出 Word
4. 是否是会员
5. 是否可以下载文件
```

### 11.2 EntitlementService

新增：

```text
server/src/services/entitlement.service.js
```

职责：

```text
1. 根据用户会员状态、订单、产品规则计算权益
2. 决定 PDF 是否带水印
3. 决定 Word 是否允许导出/下载
4. 决定某些高级生成选项是否可用
```

接口示例：

```js
async function getUserEntitlements(userId) {
  return {
    watermarkFree: false,
    canExportWord: true,
    canUseAdvancedOptions: false
  }
}
```

### 11.3 后端必须忽略前端危险参数

前端可能传：

```json
{
  "options": {
    "watermark": false,
    "exportWord": true
  }
}
```

后端不能直接相信。

正确做法：

```text
1. 后端先计算 entitlements
2. 如果用户没有 watermarkFree，则强制加水印
3. 如果用户没有 canExportWord，则拒绝 Word 导出或只生成 PDF
4. worksheet_records 保存 entitlementSnapshot
```

---

## 12. API 设计

统一返回格式：

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

错误格式：

```json
{
  "success": false,
  "code": "INSUFFICIENT_POINTS",
  "message": "生成次数不足，请先购买"
}
```

所有登录后接口都带：

```http
Authorization: Bearer <token>
```

---

### 12.1 POST `/api/auth/wechat-login`

用途：真实微信登录。

请求：

```json
{
  "code": "wx.login 返回 code",
  "profile": {
    "nickname": "用户昵称，可为空",
    "avatar": "头像，可为空"
  }
}
```

响应：

```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "user_xxx",
      "nickname": "微信用户",
      "avatar": ""
    },
    "points": {
      "balance": 3
    },
    "member": {
      "status": "inactive"
    }
  }
}
```

实现要求：

```text
1. 生产环境必须调用微信 jscode2session 换 openid
2. 根据 openid 查询 users
3. 如果不存在，创建 users
4. 创建 point_accounts
5. 新用户赠送 3 点，写 point_ledger type=grant
6. 重复登录不能重复赠送
7. 返回 JWT token
```

本地开发：

```text
NODE_ENV=development 且 ENABLE_MOCK_OPENID=true 时允许 mock openid。
```

生产环境：

```text
禁止 mock openid。
```

---

### 12.2 GET `/api/me`

用途：获取当前用户聚合状态。

响应：

```json
{
  "success": true,
  "data": {
    "user": {},
    "points": {
      "balance": 3
    },
    "member": {
      "status": "inactive"
    },
    "entitlements": {
      "watermarkFree": false,
      "canExportWord": true
    }
  }
}
```

---

### 12.3 GET `/api/points`

用途：获取点数余额和最近流水。

响应：

```json
{
  "success": true,
  "data": {
    "balance": 3,
    "recentLedger": []
  }
}
```

---

### 12.4 GET `/api/products`

用途：获取商品列表。

响应：

```json
{
  "success": true,
  "data": [
    {
      "id": "points_10",
      "name": "10 次生成包",
      "points": 10,
      "amountFen": 990
    }
  ]
}
```

---

### 12.5 POST `/api/orders/create`

用途：创建支付订单。

请求：

```json
{
  "productId": "points_10"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "orderId": "order_xxx",
    "orderNo": "202605171234560001",
    "payParams": {
      "timeStamp": "",
      "nonceStr": "",
      "package": "",
      "signType": "RSA",
      "paySign": ""
    }
  }
}
```

实现要求：

```text
1. 校验登录
2. 校验商品存在且 enabled
3. 创建 orders，状态 pending
4. 调用 PaymentProvider.createPrepay
5. 返回 wx.requestPayment 所需参数
```

---

### 12.6 POST `/api/pay/notify`

用途：接收微信支付回调。

实现要求：

```text
1. 验签
2. 解密/解析通知
3. 根据 orderNo 查询订单
4. 如果订单已 paid，直接返回成功
5. 如果订单 pending，则更新为 paid
6. 写 transactionId / paidAt
7. 发放点数
8. 写 point_ledger type=recharge
9. 使用 idempotencyKey=recharge:${orderNo}
10. 重复回调不得重复发点
```

---

### 12.7 POST `/api/dev/pay/mock-success`

用途：本地开发模拟支付成功。

请求：

```json
{
  "orderNo": "202605171234560001"
}
```

限制：

```text
1. NODE_ENV=production 时必须禁用
2. PAYMENT_PROVIDER=mock 时才可用
3. ENABLE_DEV_PAYMENT=true 时才可用
```

---

### 12.8 GET `/api/orders`

用途：订单列表。

响应：

```json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": ""
  }
}
```

权限：

```text
只能返回当前登录用户自己的订单。
```

---

### 12.9 POST `/api/worksheets/generate`

用途：生成试卷。

请求：

```json
{
  "requestId": "client_generated_uuid",
  "inputType": "text",
  "content": "用户输入的题目或知识点",
  "fileIds": [],
  "difficulty": "medium",
  "options": {
    "withAnswers": true,
    "exportPdf": true,
    "exportWord": true,
    "watermarkFree": false
  }
}
```

响应：

```json
{
  "success": true,
  "data": {
    "recordId": "wr_xxx",
    "title": "七年级数学相似题卷",
    "questionJson": {},
    "answerJson": {},
    "pdfFile": {
      "fileId": "fo_pdf_xxx",
      "downloadUrl": ""
    },
    "wordFile": {
      "fileId": "fo_word_xxx",
      "downloadUrl": ""
    },
    "points": {
      "balance": 2
    }
  }
}
```

实现流程：

```text
1. 校验 token
2. 校验 requestId 幂等
3. 校验余额 >= 1
4. 创建 worksheet_records，status=generating
5. 预扣 1 点，idempotencyKey=consume:${recordId}
6. 计算用户权益 entitlements
7. 调用现有 AI 生成逻辑
8. 生成 PDF/Word
9. 上传文件到 FileAdapter
10. 写 file_objects
11. 更新 worksheet_records，status=success
12. 返回记录和文件下载信息
```

失败处理：

```text
1. worksheet_records.status=failed
2. 写 errorCode / errorMessage
3. 如果已扣点，退回 1 点
4. 写 point_ledger type=refund
5. 返回错误码 WORKSHEET_GENERATE_FAILED
```

幂等要求：

```text
同一个 userId + requestId 重复提交，不得重复扣点。
如果第一次已成功，直接返回已有 record。
如果第一次仍在 generating，返回 GENERATION_IN_PROGRESS。
```

---

### 12.10 GET `/api/worksheets`

用途：生成记录列表。

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "wr_xxx",
        "title": "七年级数学相似题卷",
        "status": "success",
        "pointsCost": 1,
        "createdAt": "2026-05-17T00:00:00.000Z"
      }
    ],
    "nextCursor": ""
  }
}
```

权限：

```text
只返回当前用户自己的记录。
```

---

### 12.11 GET `/api/worksheets/:id`

用途：生成记录详情。

响应：

```json
{
  "success": true,
  "data": {
    "id": "wr_xxx",
    "title": "",
    "questionJson": {},
    "answerJson": {},
    "pdfFile": {
      "fileId": "fo_pdf_xxx",
      "available": true,
      "downloadUrl": ""
    },
    "wordFile": {
      "fileId": "fo_word_xxx",
      "available": true,
      "downloadUrl": ""
    }
  }
}
```

权限：

```text
只能访问当前用户自己的记录。
```

---

### 12.12 GET `/api/worksheets/:id/download?type=pdf`

用途：获取文件下载地址。

响应：

```json
{
  "success": true,
  "data": {
    "downloadUrl": "临时下载地址",
    "expiresIn": 3600
  }
}
```

要求：

```text
1. 校验 token
2. 校验 record.userId === currentUser.id
3. 校验文件属于该 record
4. 校验文件未过期
5. 校验 Word/无水印等权限
6. 返回临时下载链接
```

---

### 12.13 POST `/api/files/upload`

用途：上传原始资料。

要求：

```text
1. 校验 token
2. 校验文件类型
3. 校验文件大小
4. 上传到 FileAdapter
5. 写 file_objects，fileRole=source_upload
6. 返回 fileId
```

响应：

```json
{
  "success": true,
  "data": {
    "fileId": "fo_xxx",
    "name": "source.pdf",
    "size": 123456
  }
}
```

---

## 13. 后端服务设计

### 13.1 AuthService

文件：

```text
server/src/services/auth.service.js
```

职责：

```text
1. 微信 code 换 openid
2. 本地开发 mock openid
3. 创建或查找用户
4. 初始化 point account
5. 新用户赠送点数
6. 签发 JWT
7. 校验 JWT
```

关键函数：

```js
async function wechatLogin({ code, profile }) {}
async function exchangeCodeForSession(code) {}
async function issueToken(user) {}
async function verifyToken(token) {}
```

验收：

```text
1. 新用户首次登录赠送 3 点
2. 老用户重复登录不重复赠送
3. token 可访问 /api/me
4. 生产环境不允许 mock openid
```

---

### 13.2 PointService

文件：

```text
server/src/services/point.service.js
```

职责：

```text
1. 初始化账户
2. 查询余额
3. 注册赠送
4. 支付充值
5. 生成消耗
6. 失败退款
7. 写流水
8. 幂等控制
```

关键函数：

```js
async function ensureAccount(userId) {}
async function getBalance(userId) {}
async function grantSignupPoints(userId) {}
async function rechargePoints({ userId, points, orderId, idempotencyKey }) {}
async function consumePoints({ userId, points, recordId, idempotencyKey }) {}
async function refundPoints({ userId, points, recordId, idempotencyKey }) {}
```

硬性要求：

```text
1. 余额不能为负
2. 每次变化必须写 ledger
3. idempotencyKey 必须唯一
4. 重复 idempotencyKey 不重复执行
```

---

### 13.3 OrderService

文件：

```text
server/src/services/order.service.js
```

职责：

```text
1. 创建订单
2. 查询订单
3. 订单状态机
4. 支付成功处理
5. 幂等发放点数
```

关键函数：

```js
async function createOrder({ userId, productId }) {}
async function markOrderPaid({ orderNo, transactionId, paidAt }) {}
async function listOrders(userId) {}
async function getOrderByOrderNo(orderNo) {}
```

状态机：

```text
pending → paid
pending → closed
paid → refunded
```

禁止：

```text
paid → pending
paid → paid 后重复发点
closed → paid
```

---

### 13.4 PaymentService

文件：

```text
server/src/services/payment.service.js
```

职责：

```text
1. 创建预支付
2. 处理支付回调
3. 屏蔽 mock / wechat / virtual payment 差异
```

Provider 接口：

```js
class PaymentProvider {
  async createPrepay(order, user) {}
  async verifyNotify(req) {}
}
```

实现：

```text
MockPaymentProvider
WeChatPaymentProvider
VirtualPaymentProvider
```

P0 要求：

```text
1. 本地 mock 必须跑通
2. 生产 provider 必须校验配置
3. 微信回调处理必须幂等
4. 具体普通微信支付还是虚拟支付，要根据小程序类目和审核要求选择
```

---

### 13.5 EntitlementService

文件：

```text
server/src/services/entitlement.service.js
```

职责：

```text
1. 后端计算用户权益
2. 控制 Word 导出
3. 控制 PDF 水印
4. 控制高级功能
```

关键函数：

```js
async function getUserEntitlements(userId) {}
function canExportWord(entitlements) {}
function shouldAddWatermark(entitlements) {}
```

---

### 13.6 WorksheetService

文件：

```text
server/src/services/worksheet.service.js
```

职责：

```text
1. 生成试卷主流程编排
2. requestId 幂等
3. 点数预扣
4. 调用现有 AI 生成逻辑
5. 调用现有 PDF/Word 导出逻辑
6. 文件上传
7. 记录保存
8. 失败退点
```

关键函数：

```js
async function generateWorksheet({ userId, requestId, inputType, content, fileIds, difficulty, options }) {}
async function listWorksheets({ userId, cursor }) {}
async function getWorksheetDetail({ userId, recordId }) {}
async function getDownloadUrl({ userId, recordId, type }) {}
```

---

### 13.7 FileService

文件：

```text
server/src/services/file.service.js
```

职责：

```text
1. 上传源文件
2. 上传生成文件
3. 记录 file_objects
4. 生成临时下载地址
5. 校验用户权限
6. 过期文件清理
```

关键函数：

```js
async function uploadSourceFile({ userId, file }) {}
async function uploadGeneratedFile({ userId, recordId, buffer, filename, mimeType, role }) {}
async function getDownloadUrl({ userId, fileId }) {}
async function cleanupExpiredFiles() {}
```

---

## 14. Adapter 设计

### 14.1 DbAdapter

文件：

```text
server/src/adapters/db/index.js
```

接口：

```js
class DbAdapter {
  async findUserByOpenid(openid) {}
  async createUser(data) {}
  async getUserById(userId) {}

  async getPointAccount(userId) {}
  async createPointAccount(data) {}
  async updatePointAccount(userId, patch) {}
  async createPointLedger(data) {}
  async findPointLedgerByIdempotencyKey(key) {}

  async createOrder(data) {}
  async updateOrder(orderId, patch) {}
  async getOrderByOrderNo(orderNo) {}
  async listOrdersByUser(userId, options) {}

  async createWorksheetRecord(data) {}
  async updateWorksheetRecord(recordId, patch) {}
  async getWorksheetRecordById(recordId) {}
  async getWorksheetRecordByRequestId(userId, requestId) {}
  async listWorksheetRecordsByUser(userId, options) {}

  async createFileObject(data) {}
  async getFileObjectById(fileId) {}
  async updateFileObject(fileId, patch) {}
}
```

### 14.2 LocalDbAdapter

用途：

```text
本地开发可跑完整闭环。
```

存储：

```text
server/.data/dev-db.json
```

要求：

```text
1. 不依赖 CloudBase 账号
2. 支持基础 CRUD
3. 支持唯一键检查
4. 支持 idempotencyKey 检查
5. 支持重启后数据仍存在
```

### 14.3 CloudBaseDbAdapter

用途：

```text
生产环境连接 CloudBase 文档数据库。
```

要求：

```text
1. 所有集合名和字段与第 9 节保持一致
2. 不允许业务 service 直接调用 CloudBase SDK
3. 所有 SDK 调用封装在 adapter 内
```

---

### 14.4 FileAdapter

接口：

```js
class FileAdapter {
  async upload({ objectKey, buffer, contentType }) {}
  async getTemporaryUrl({ objectKey, expiresIn }) {}
  async deleteObject({ objectKey }) {}
}
```

实现：

```text
LocalFileAdapter
CloudBaseStorageAdapter
```

LocalFileAdapter：

```text
server/files
server/uploads
```

CloudBaseStorageAdapter：

```text
CloudBase 云存储
```

---

### 14.5 PaymentProvider

接口：

```js
class PaymentProvider {
  async createPrepay({ order, user }) {}
  async verifyNotify(req) {}
}
```

实现：

```text
MockPaymentProvider
WeChatPaymentProvider
VirtualPaymentProvider
```

---

## 15. 前端小程序改造

### 15.1 `utils/storage.js`

当前真实业务数据必须废弃：

```text
POINTS
USER
MEMBER
RECORDS
PURCHASES
```

改成只存：

```text
TOKEN
USER_CACHE
POINTS_CACHE
```

建议接口：

```js
function setToken(token) {}
function getToken() {}
function clearAuth() {}
function setUserCache(user) {}
function getUserCache() {}
function setPointsCache(points) {}
function getPointsCache() {}
```

保留旧函数时必须标注 deprecated，并且不再作为真实业务来源：

```text
addPoints      deprecated
consumePoints  deprecated
addPurchase    deprecated
addRecord       deprecated
setMember       deprecated
```

---

### 15.2 新增 `utils/config.js`

```js
const config = {
  apiBaseUrl: 'http://127.0.0.1:3000'
}

module.exports = config
```

生产改成 CloudBase 云托管 HTTPS 地址。

---

### 15.3 新增 `utils/request.js`

职责：

```text
1. 自动拼接 apiBaseUrl
2. 自动带 Authorization
3. 统一处理 success/error
4. token 过期跳登录
```

---

### 15.4 新增 `utils/api.js`

接口：

```js
module.exports = {
  wechatLogin(data) {},
  getMe() {},
  getPoints() {},
  getProducts() {},
  createOrder(productId) {},
  mockPaySuccess(orderNo) {},
  getOrders() {},
  generateWorksheet(data) {},
  uploadFile(filePath) {},
  getWorksheets() {},
  getWorksheetDetail(id) {},
  getWorksheetDownloadUrl(id, type) {}
}
```

---

### 15.5 修改 `pages/login/login.js`

旧逻辑删除：

```text
code 后 6 位伪造 userId
```

新逻辑：

```text
用户点击登录
  → wx.login()
  → api.wechatLogin({ code })
  → 保存 token/user/points
  → 跳转首页
```

---

### 15.6 修改 `pages/index/index.js`

旧逻辑删除：

```text
前端判断点数
前端 consumePoints
前端 addRecord
```

新逻辑：

```text
用户输入/上传
  → 生成 requestId
  → api.generateWorksheet
  → 后端完成扣点、生成、存储、落库
  → 前端展示结果
  → 更新 points cache
```

前端只做：

```text
1. 输入校验
2. loading
3. 错误提示
4. 结果展示
5. 跳转详情页
```

---

### 15.7 修改 `pages/order/order.js`

旧逻辑删除：

```text
mock_${Date.now()}
本地 addPoints
本地 addPurchase
```

新逻辑：

```text
进入页面
  → api.getProducts()
  → 用户选择套餐
  → api.createOrder(productId)
  → wx.requestPayment(payParams)
  → 前端提示支付处理中
  → 轮询或手动刷新 api.getPoints()
```

本地开发：

```text
如果后端返回 mock 支付参数，可以显示“模拟支付成功”按钮。
点击后调用 /api/dev/pay/mock-success。
```

生产环境：

```text
不显示模拟支付按钮。
```

---

### 15.8 修改历史记录页

旧数据源：

```text
storage.getRecords()
```

新数据源：

```text
api.getWorksheets()
api.getWorksheetDetail(id)
```

验收：

```text
清缓存后重新登录，历史记录仍然存在。
```

---

### 15.9 修改我的页

旧数据源：

```text
本地 USER / POINTS / MEMBER / PURCHASES
```

新数据源：

```text
api.getMe()
api.getPoints()
api.getOrders()
```

展示：

```text
1. 用户头像/昵称
2. 剩余生成次数
3. 购买记录入口
4. 生成记录入口
5. 联系客服
```

---

### 15.10 修改预览/导出页

必须改成：

```text
1. PDF 下载调用 /api/worksheets/:id/download?type=pdf
2. Word 下载调用 /api/worksheets/:id/download?type=word
3. 不允许前端自己决定无水印
4. 不允许前端直接访问 server/files 静态路径
```

---

## 16. 文件存储策略

### 16.1 文件路径规范

上传文件：

```text
uploads/{userId}/{yyyyMMdd}/{fileId}-{safeFilename}
```

生成文件：

```text
generated/{userId}/{recordId}/paper.pdf
generated/{userId}/{recordId}/paper.docx
```

### 16.2 保存周期

```text
上传原文件：7 天
生成 PDF：30 天
生成 Word：30 天
题目 JSON：长期保存
```

### 16.3 文件过期后的表现

```text
1. 历史记录仍可见
2. 题目内容仍可看
3. PDF/Word 下载按钮显示“文件已过期”
4. P0 不做重新生成文件
```

### 16.4 下载权限

下载必须满足：

```text
1. 当前用户已登录
2. record.userId === currentUser.id
3. file.recordId === record.id
4. file.userId === currentUser.id
5. 文件未过期
6. Word/无水印符合后端权益
```

---

## 17. 支付闭环设计

### 17.1 正确支付流程

```text
用户选择点数包
  → POST /api/orders/create
  → 后端创建 pending 订单
  → 后端调支付 provider 创建预支付
  → 小程序 wx.requestPayment
  → 微信支付异步通知 /api/pay/notify
  → 后端验签
  → 后端订单改 paid
  → 后端发放点数
  → 写 point_ledger
  → 前端刷新余额
```

### 17.2 不能做的事情

禁止：

```text
1. wx.requestPayment success 后直接加点
2. 前端写订单 paid
3. 前端写购买记录
4. 前端决定会员权益
5. 前端 mock 支付暴露到生产
```

### 17.3 幂等规则

支付回调 idempotencyKey：

```text
recharge:${orderNo}
```

要求：

```text
1. 同一 orderNo 只能发放一次点数
2. 重复回调直接返回成功
3. 不能重复写充值流水
4. paid 订单不能再次发点
```

### 17.4 普通微信支付 vs 小程序虚拟支付

由于本产品卖的是：

```text
点数
生成次数
AI 生成服务
PDF/Word 数字文件
会员权益
```

可能涉及小程序虚拟支付规则。  
代码层面必须抽象为 PaymentProvider，不要写死普通微信支付。

Provider 预留：

```text
wechat_pay
virtual_pay
mock
```

实际走哪一种，以微信公众平台类目和审核结果为准。

---

## 18. 幂等和并发安全

### 18.1 生成 requestId

前端每次点击生成时生成：

```text
requestId = uuid
```

提交给后端：

```json
{
  "requestId": "xxx"
}
```

后端唯一约束：

```text
userId + requestId unique
```

### 18.2 防重复扣点

扣点 key：

```text
consume:${recordId}
```

退款 key：

```text
refund:${recordId}
```

充值 key：

```text
recharge:${orderNo}
```

### 18.3 并发余额控制

要求：

```text
1. 点数扣减必须在服务端完成
2. 余额不足直接失败
3. 同一用户并发生成不能让余额变负
4. 如果 CloudBase 事务可用，优先事务
5. 如果暂时没有事务，至少用 idempotencyKey + 状态机 + 二次余额检查
```

### 18.4 状态机

生成记录：

```text
generating → success
generating → failed
```

订单：

```text
pending → paid
pending → closed
paid → refunded
```

禁止非法回退：

```text
success → generating
paid → pending
closed → paid
```

---

## 19. 安全要求

### 19.1 Token 鉴权

所有核心接口必须校验 token：

```text
/api/me
/api/points
/api/orders/*
/api/worksheets/*
/api/files/*
```

公开接口只允许：

```text
/api/auth/wechat-login
/api/products
/api/pay/notify
```

### 19.2 上传安全

要求：

```text
1. 限制文件类型：pdf/doc/docx/png/jpg/jpeg
2. 限制文件大小
3. 文件名清洗 safeFilename
4. 不允许直接用用户文件名作为 objectKey
5. 不允许执行上传文件
6. 错误日志不要打印文件敏感内容
```

### 19.3 CORS / 域名

生产环境：

```text
1. 只允许小程序合法 request 域名
2. 后端必须 HTTPS
3. 微信后台配置 request/upload/download 合法域名
```

### 19.4 密钥管理

禁止提交：

```text
.env
微信支付私钥
CloudBase secret
JWT_SECRET
AI_API_KEY
```

### 19.5 日志脱敏

日志中禁止输出：

```text
openid 全量
session_key
JWT
支付私钥
AI key
用户上传文件全文
```

---

## 20. 错误码设计

```text
UNAUTHORIZED              未登录
INVALID_TOKEN             token 无效
WECHAT_LOGIN_FAILED       微信登录失败
USER_DISABLED             用户不可用

INSUFFICIENT_POINTS       点数不足
POINT_LEDGER_DUPLICATED   点数流水重复
POINT_ACCOUNT_NOT_FOUND   点数账户不存在

PRODUCT_NOT_FOUND         商品不存在
ORDER_NOT_FOUND           订单不存在
ORDER_STATUS_INVALID      订单状态不合法
PAYMENT_CREATE_FAILED     创建支付失败
PAYMENT_NOTIFY_INVALID    支付回调无效
PAYMENT_PROVIDER_DISABLED 支付 provider 未启用

GENERATION_IN_PROGRESS    正在生成中
WORKSHEET_NOT_FOUND       生成记录不存在
WORKSHEET_GENERATE_FAILED 试卷生成失败
WORKSHEET_FORBIDDEN       无权访问该记录
WORKSHEET_FILE_EXPIRED    文件已过期

ENTITLEMENT_REQUIRED      当前权益不足
WORD_EXPORT_FORBIDDEN     无权导出 Word
WATERMARK_FREE_FORBIDDEN  无权生成无水印文件

FILE_UPLOAD_FAILED        文件上传失败
FILE_NOT_FOUND            文件不存在
FILE_FORBIDDEN            无权访问文件
FILE_TOO_LARGE            文件过大
FILE_TYPE_NOT_ALLOWED     文件类型不支持

INTERNAL_ERROR            系统错误
```

---

## 21. 本地开发模式

### 21.1 本地环境变量

```env
NODE_ENV=development
DB_PROVIDER=local
FILE_PROVIDER=local
PAYMENT_PROVIDER=mock
ENABLE_DEV_PAYMENT=true
ENABLE_MOCK_OPENID=true
```

### 21.2 本地必须能跑通

不配置 CloudBase、不配置微信支付，也必须能跑通：

```text
登录
  → 赠送 3 点
  → 生成扣 1 点
  → 保存历史记录
  → 创建订单
  → mock 支付成功
  → 点数增加
  → 再次生成
```

### 21.3 本地数据位置

```text
server/.data/dev-db.json
server/files
server/uploads
```

这些目录需要加入 `.gitignore`。

---

## 22. 生产部署模式

### 22.1 生产环境变量

```env
NODE_ENV=production
DB_PROVIDER=cloudbase
FILE_PROVIDER=cloudbase
PAYMENT_PROVIDER=wechat
ENABLE_DEV_PAYMENT=false
ENABLE_MOCK_OPENID=false
```

### 22.2 生产启动时必须校验

如果缺少以下配置，服务必须启动失败：

```text
JWT_SECRET
WECHAT_APPID
WECHAT_SECRET
CLOUDBASE_ENV_ID
支付相关配置
AI_API_KEY
```

### 22.3 CloudBase 部署文档必须包含

```text
1. 如何创建 CloudBase 环境
2. 如何创建数据库集合
3. 如何创建云存储目录
4. 如何配置云托管
5. 如何配置环境变量
6. 如何配置小程序合法域名
7. 如何配置微信支付回调地址
8. 如何切换小程序 apiBaseUrl
```

---

## 23. 测试计划

### 23.1 后端单元测试

至少覆盖：

```text
1. 新用户登录创建 users
2. 新用户登录创建 point_accounts
3. 新用户登录赠送 3 点
4. 重复登录不重复赠送
5. 无 token 访问受保护接口返回 401
6. 点数不足不能生成
7. 生成成功扣 1 点
8. 生成失败退 1 点
9. 重复 requestId 不重复扣点
10. 创建订单 status=pending
11. mock 支付成功 status=paid
12. 重复支付回调不重复发点
13. 用户不能访问别人的记录
14. 用户不能下载别人的文件
15. 文件过期后不能下载
```

### 23.2 后端 smoke

新增：

```text
server/scripts/smoke-all.js
```

流程：

```text
1. POST /api/auth/wechat-login
2. GET /api/me
3. GET /api/products
4. POST /api/orders/create
5. POST /api/dev/pay/mock-success
6. GET /api/points
7. POST /api/worksheets/generate
8. GET /api/worksheets
9. GET /api/worksheets/:id
10. GET /api/worksheets/:id/download?type=pdf
```

输出：

```text
docs/verification-results.md
```

### 23.3 小程序手工验收

必须验证：

```text
1. 首次登录成功
2. 首页显示后端点数
3. 生成一次后点数减少
4. 生成结果展示正常
5. PDF 下载可用
6. Word 权限由后端控制
7. 历史记录来自后端
8. 清除小程序缓存后重新登录，历史记录仍在
9. 购买点数后余额增加
10. 点数不足时提示购买
11. 修改本地 storage 不能增加真实点数
12. 修改本地 member 不能下载无权限文件
```

---

## 24. Codex 执行任务拆解

### Task 0：代码审计与现状确认

目标：

```text
先确认当前代码真实状态，不直接大改。
```

读取：

```text
README.md
miniprogram/utils/storage.js
miniprogram/pages/login/login.js
miniprogram/pages/order/order.js
miniprogram/pages/index/index.js
server/src/index.js
```

输出：

```text
docs/cloudbase-migration-audit.md
```

验收：

```text
文档必须列出当前登录、点数、订单、生成记录、文件保存、导出流程的真实代码依据。
```

---

### Task 1：后端模块化与环境配置

目标：

```text
将 server/src/index.js 拆出 app、env、routes、services 的基础结构。
```

改动：

```text
1. 新增 server/src/app.js
2. 新增 server/src/config/env.js
3. 新增统一 errorHandler
4. 保留原有生成/PDF/Word 能力
5. 不破坏当前可用接口
```

验收：

```text
1. 服务可以启动
2. 原有生成接口仍可用
3. .env.example 完整
4. production 缺关键配置会失败
```

---

### Task 2：实现 LocalDbAdapter

目标：

```text
本地开发不依赖 CloudBase，仍可完整跑通上线主链路。
```

改动：

```text
1. 新增 server/src/adapters/db/localDbAdapter.js
2. 数据落到 server/.data/dev-db.json
3. 实现 users、point_accounts、point_ledger、orders、worksheet_records、file_objects 基础 CRUD
4. 实现唯一键和 idempotencyKey 检查
```

验收：

```text
1. 重启后本地数据仍存在
2. 同 openid 不重复创建用户
3. 同 idempotencyKey 不重复写流水
```

---

### Task 3：实现 AuthService 和 token 鉴权

目标：

```text
替换伪 userId。
```

改动：

```text
1. POST /api/auth/wechat-login
2. GET /api/me
3. JWT 签发和校验
4. auth middleware
5. 新用户赠送 3 点
6. 老用户重复登录不重复赠送
```

验收：

```text
1. 登录返回 token
2. token 可访问 /api/me
3. 不带 token 访问 /api/me 返回 401
4. 新用户有 3 点
5. 重复登录仍是 3 点，不会变 6 点
```

---

### Task 4：实现 PointService

目标：

```text
点数完全以后端为准。
```

改动：

```text
1. GET /api/points
2. grantSignupPoints
3. consumePoints
4. refundPoints
5. rechargePoints
6. point_ledger 写入
7. 幂等控制
```

验收：

```text
1. 余额不能为负
2. 每次变化都有流水
3. 重复 idempotencyKey 不重复执行
4. 本地 storage 改点数不影响后端余额
```

---

### Task 5：实现商品、订单、mock 支付

目标：

```text
先跑通本地购买点数闭环。
```

改动：

```text
1. GET /api/products
2. POST /api/orders/create
3. GET /api/orders
4. MockPaymentProvider
5. POST /api/dev/pay/mock-success
```

验收：

```text
1. 创建订单 status=pending
2. mock 支付后 status=paid
3. 点数增加
4. 充值流水存在
5. 重复 mock-success 不重复加点
6. production 禁用 dev pay
```

---

### Task 6：实现 PaymentProvider 生产骨架

目标：

```text
支付逻辑不能写死 mock。
```

改动：

```text
1. PaymentProvider interface
2. WeChatPaymentProvider skeleton
3. VirtualPaymentProvider skeleton
4. POST /api/pay/notify
5. docs/payment-integration.md
```

验收：

```text
1. mock 支付仍可跑
2. production + PAYMENT_PROVIDER=wechat 时校验配置
3. pay notify 使用统一 order paid 处理逻辑
4. 重复回调不重复发点
```

---

### Task 7：实现 EntitlementService

目标：

```text
Word / 无水印 / 高级权益由后端判断。
```

改动：

```text
1. 新增 entitlement.service.js
2. /api/me 返回 entitlements
3. 生成和下载时校验 entitlements
4. 后端忽略前端 watermarkFree 等危险参数
```

验收：

```text
1. 改本地 MEMBER 不影响后端权益
2. 无权限不能下载 Word 或无水印文件
3. 权益快照写入 worksheet_records.entitlementSnapshot
```

---

### Task 8：改造 WorksheetService 生成主流程

目标：

```text
生成必须走服务端扣点和落库。
```

改动：

```text
1. POST /api/worksheets/generate
2. requestId 幂等
3. 创建 generating 记录
4. 预扣 1 点
5. 调用现有 AI 生成逻辑
6. 调用现有 PDF/Word 导出逻辑
7. 成功写 success
8. 失败写 failed 并退款
9. GET /api/worksheets
10. GET /api/worksheets/:id
```

验收：

```text
1. 点数不足不能生成
2. 成功扣 1 点
3. 失败退 1 点
4. 重复 requestId 不重复扣点
5. 用户不能读取别人的记录
```

---

### Task 9：实现 FileAdapter 和下载权限

目标：

```text
文件不再依赖生产本地临时目录。
```

改动：

```text
1. LocalFileAdapter
2. CloudBaseStorageAdapter skeleton
3. FileService
4. file_objects 元数据
5. GET /api/worksheets/:id/download?type=pdf|word
6. 文件过期判断
```

验收：

```text
1. 生成 PDF/Word 后有 file_objects
2. 下载接口校验用户权限
3. 文件过期返回 WORKSHEET_FILE_EXPIRED
4. 不再让前端直接依赖 /files/* 静态路径
```

---

### Task 10：小程序接入真实后端

目标：

```text
小程序本地 storage 不再作为真实业务数据源。
```

改动：

```text
1. 新增 utils/config.js
2. 新增 utils/request.js
3. 新增 utils/api.js
4. 改 storage.js 只保留 token/cache
5. 改 login.js
6. 改 index.js
7. 改 order.js
8. 改 history 页
9. 改 profile 页
10. 改 preview/export 下载逻辑
```

验收：

```text
1. 清缓存后重新登录，历史记录仍在
2. 本地改 POINTS 不影响真实余额
3. 本地改 MEMBER 不影响真实导出权限
4. 购买记录来自后端
5. 生成记录来自后端
```

---

### Task 11：CloudBase 生产适配与部署文档

目标：

```text
让代码具备 CloudBase 部署能力。
```

改动：

```text
1. CloudBaseDbAdapter
2. CloudBaseStorageAdapter
3. Dockerfile 或云托管配置
4. docs/cloudbase-deploy.md
5. README 更新
```

验收：

```text
1. local provider 可运行
2. cloudbase provider 不缺模块
3. 文档说明数据库集合、环境变量、云托管、小程序域名配置
4. 不泄露密钥
```

---

### Task 12：测试、smoke、验收报告

目标：

```text
形成可交付验收证据。
```

改动：

```text
1. server/scripts/smoke-all.js
2. docs/verification-results.md
3. docs/security-checklist.md
```

验收：

```text
1. smoke-all 跑通登录、订单、mock 支付、生成、记录、下载
2. verification-results.md 写明通过/失败项
3. security-checklist.md 写明生产上线前人工配置项
```

---

## 25. Codex 总提示词

把下面整段直接交给 Codex：

```text
你现在接手项目：
D:\lyh\agent\agent-frame\printersheet\ai-exam-miniapp

当前状态：
这是一个 AI 出题小程序，本地 MVP 已经可以演示。小程序页面、文本/PDF/DOCX 上传生成 worksheet、PDF/Word 导出、本地点数、本地购买记录、mock 支付都已经有了。但它不能真实上线收费，因为用户、点数、会员、生成记录、购买记录都在 wx.setStorageSync；登录只是 wx.login 后把 code 后 6 位伪造成本地用户 ID；支付是本地 mock；文件写在 server/files 和 server/uploads；Word/无水印等权益主要靠前端判断。

你的目标：
完成上线前 P0 主链路改造：
真实微信登录 + 数据库 + 服务端点数 + 微信支付/支付回调 + 后端权限校验 + 文件存储。

技术方向：
1. 采用微信小程序 + CloudBase 云托管 Node/Express + CloudBase 文档数据库 + CloudBase 云存储。
2. 外部 AI 大模型保持现有封装，不要重写核心生成逻辑。
3. 本地开发必须能在没有 CloudBase 和微信支付配置的情况下跑通：LocalDbAdapter + LocalFileAdapter + MockPaymentProvider。
4. 生产环境通过 env 切换：CloudBaseDbAdapter + CloudBaseStorageAdapter + WeChatPaymentProvider/VirtualPaymentProvider。
5. 业务代码必须通过 adapter 调用数据库/文件/支付，不允许把 CloudBase SDK 或支付逻辑散落在业务 service 中。

必须实现：
1. POST /api/auth/wechat-login：后端换 openid，创建/查找用户，返回 JWT。
2. GET /api/me：返回 user、points、member、entitlements。
3. GET /api/points：返回后端真实点数余额和最近流水。
4. GET /api/products：返回点数包商品。
5. POST /api/orders/create：创建 pending 订单并返回支付参数。
6. POST /api/dev/pay/mock-success：仅开发环境可用，模拟支付成功。
7. POST /api/pay/notify：支付回调，验签/解析/幂等/订单 paid/发放点数。
8. POST /api/worksheets/generate：校验 token、requestId 幂等、余额、预扣点数、调用现有生成逻辑、生成 PDF/Word、保存文件、保存记录、失败退点。
9. GET /api/worksheets：返回当前用户生成记录。
10. GET /api/worksheets/:id：返回当前用户生成记录详情。
11. GET /api/worksheets/:id/download?type=pdf|word：校验权限并返回下载链接。
12. POST /api/files/upload：上传原始资料并保存 file_objects。

数据库集合：
users、point_accounts、point_ledger、orders、memberships、worksheet_records、file_objects。

关键安全要求：
1. 小程序本地 storage 只能存 token/cache，不能作为真实业务数据源。
2. 生产环境禁止 mock openid、mock payment、local db、local file。
3. 点数余额不能为负。
4. 所有点数变化必须写 point_ledger。
5. 支付回调必须幂等，同一 orderNo 不得重复发点。
6. 生成 requestId 必须幂等，同一次请求不得重复扣点。
7. 用户只能访问自己的记录和文件。
8. Word/无水印等权益必须由后端 EntitlementService 判断，不能相信前端参数。
9. 文件下载必须走接口校验，不允许前端直接依赖 /files/* 静态路径。
10. .env、私钥、API key 不得提交。

执行顺序：
1. 审计当前代码，输出 docs/cloudbase-migration-audit.md。
2. 后端模块化：app/env/routes/services/adapters。
3. 实现 LocalDbAdapter、LocalFileAdapter、MockPaymentProvider。
4. 实现 auth、points、orders、payment notify、entitlements。
5. 改造 worksheet 生成主流程，接入扣点、记录、文件。
6. 改造小程序端 request/api/storage/login/index/order/history/profile/preview。
7. 实现 CloudBaseDbAdapter 和 CloudBaseStorageAdapter skeleton。
8. 补 docs/cloudbase-deploy.md、docs/payment-integration.md、docs/security-checklist.md。
9. 补 server/scripts/smoke-all.js。
10. 运行可用测试/smoke，把结果写入 docs/verification-results.md。

验收标准：
1. 首次登录后端创建用户并赠送 3 点。
2. 重复登录不重复赠送。
3. 修改本地 storage 不能增加真实点数。
4. 点数不足不能生成。
5. 生成成功扣 1 点并写流水。
6. 生成失败退 1 点并写流水。
7. 重复 requestId 不重复扣点。
8. 购买点数通过订单和支付成功处理发放。
9. 重复支付回调不重复发点。
10. 清除小程序缓存后重新登录，历史记录仍在。
11. 用户不能访问别人的记录和文件。
12. Word/无水印权限由后端控制。
13. PDF/Word 文件有 file_objects 元数据。
14. 本地 local/mock 环境可以完整跑通。
15. production 环境禁止 mock payment 和 mock openid。
```

---

## 26. 最终上线验收清单

### 26.1 后端

```text
[ ] POST /api/auth/wechat-login 可用
[ ] GET /api/me 可用
[ ] GET /api/points 可用
[ ] GET /api/products 可用
[ ] POST /api/orders/create 可用
[ ] POST /api/dev/pay/mock-success 仅开发可用
[ ] POST /api/pay/notify 具备幂等处理
[ ] GET /api/orders 可用
[ ] POST /api/worksheets/generate 可用
[ ] GET /api/worksheets 可用
[ ] GET /api/worksheets/:id 可用
[ ] GET /api/worksheets/:id/download 可用
[ ] POST /api/files/upload 可用
[ ] 点数流水完整
[ ] 订单状态机完整
[ ] 生成失败退款完整
[ ] 文件权限校验完整
[ ] 权益校验完整
```

### 26.2 小程序

```text
[ ] 登录不再伪造 userId
[ ] token 保存正常
[ ] 首页显示后端点数
[ ] 生成走后端接口
[ ] 前端不再 consumePoints/addPoints
[ ] 支付页读取后端商品
[ ] 支付后刷新后端余额
[ ] 历史记录来自后端
[ ] 我的页面来自后端
[ ] 预览/下载走后端下载接口
[ ] 清缓存后数据不丢
```

### 26.3 安全

```text
[ ] production 禁用 mock payment
[ ] production 禁用 mock openid
[ ] JWT_SECRET 不使用默认值
[ ] 支付回调验签
[ ] 用户只能访问自己的记录
[ ] 用户只能下载自己的文件
[ ] Word/无水印不能靠前端绕过
[ ] .env 不提交
[ ] 私钥不入库
[ ] 日志不打印敏感信息
```

### 26.4 文件

```text
[ ] 上传文件有 file_objects
[ ] PDF 有 file_objects
[ ] Word 有 file_objects
[ ] 文件 objectKey 带 userId/recordId
[ ] 下载链接为临时 URL
[ ] 文件过期能正确提示
```

---

## 27. 推荐开发节奏

### 第 1 步：本地生产主链路

```text
LocalDbAdapter + LocalFileAdapter + MockPaymentProvider
```

先跑通：

```text
登录 → 赠送点数 → 生成扣点 → 历史记录 → 创建订单 → mock 支付 → 点数增加 → 再生成
```

### 第 2 步：小程序接真实后端

```text
storage 改缓存
login/index/order/history/profile 全部接 API
```

验证：

```text
清缓存后重新登录，记录仍在。
```

### 第 3 步：CloudBase 数据和文件

```text
CloudBaseDbAdapter + CloudBaseStorageAdapter
```

验证：

```text
数据进 CloudBase，文件进云存储。
```

### 第 4 步：真实支付

```text
WeChatPaymentProvider / VirtualPaymentProvider
```

验证：

```text
真实支付 → 回调 → 后端发点 → 前端刷新余额。
```

### 第 5 步：小范围内测

建议：

```text
20-50 个真实用户
```

观察：

```text
1. 支付是否顺畅
2. 生成是否稳定
3. 文件下载是否稳定
4. 生成失败率
5. 单次 AI 成本
6. 用户是否愿意为次数包付费
```

---

## 28. 最终判断

本次不是继续做页面，而是做上线前的“信用底座”。

最重要的是：

```text
用户可信
余额可信
订单可信
扣点可信
文件可信
权限可信
```

只有这条主链路打通，这个小程序才具备真实收费运营的基础。

当前最合理的下一步：

```text
先让 Codex 按 Task 0 → Task 12 执行。
先完成 local/mock 闭环。
再切 CloudBase。
最后接真实支付。
```
