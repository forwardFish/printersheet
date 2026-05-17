# AI 出题小助手微信小程序：定价 / 点数 / 分享奖励 / 整卷仿真增量开发说明 v1.0

> 适用项目：微信小程序版「AI 出题小助手 / AI 练习卷打印助手」  
> 适用场景：项目已经开发到一半，需要把最新讨论确定的商业规则、点数规则、分享奖励规则、整卷仿真规则合并进现有代码。  
> 文档目标：给 Codex / 开发智能体直接执行，用于修改现有小程序与后端逻辑。  
> 核心原则：**极简、好懂、好开发、好统计、好验收。**

---

## 0. 本次修改的核心结论

本次不是重新开发完整产品，而是在已有微信小程序基础上，统一修改以下规则：

1. **只为“生成”扣点。**
2. **下载 PDF 不扣点。**
3. **免费版 PDF 有水印，付费版 PDF 无水印。**
4. **Word 下载不扣点，但仅 Pro / Teacher 用户可用。**
5. **整卷仿真固定 10 点，不按页、不按 OCR、不按解析拆分扣点。**
6. **朋友圈分享：每天首次分享，分享人奖励 1 点。**
7. **邀请购买：好友通过邀请链接首次购买成功，邀请人奖励 5 点。**
8. **不做双方各得。**
9. **不做点击奖励、注册奖励、首次生成奖励。**
10. **国内小程序 V1 先按“月卡权益”实现，不强制实现自动续费订阅。**

---

## 1. 必须删除或停止使用的旧规则

如果当前代码里已经存在以下逻辑，需要删除、停用或替换。

### 1.1 删除复杂点数经济系统

不要实现：

- PDF 下载扣点。
- 答案页另扣点。
- Word 下载另扣点。
- OCR 按页复杂扣点。
- 不同题型分别扣点。
- 优先队列另扣点。
- 解析页另扣点。
- 多级邀请奖励。
- 双方各得奖励。
- 注册奖励。
- 点击奖励。
- 首次生成邀请奖励。

### 1.2 删除或替换旧套餐文案

如果页面上存在类似：

```text
Word 下载消耗 1 点
答案解析消耗 1 点
OCR 每页 1 点
整卷仿真 5 点起
分享成功双方各得 3 点
```

全部替换为本文最终规则。

### 1.3 删除“免费额度 2 点”的旧设定

新版 Free 为：

```text
新用户免费 3 点
```

---

## 2. V1 点数消耗最终规则

### 2.1 用户能看到的规则

小程序前端只展示这一张表，不展示更复杂的计费说明。

| 用户操作 | 消耗点数 |
|---|---:|
| 普通练习卷，10 题以内 | 1 点 |
| 加长练习卷，20 题以内 | 2 点 |
| 错题同类题 | 2 点 |
| 上传资料生成 | 3 点 |
| 整卷仿真 | 10 点 |
| 下载 PDF | 0 点 |
| 下载 Word | 0 点，但仅 Pro / Teacher 可用 |
| 去水印 | 0 点，但仅付费版可用 |

### 2.2 后端统一计费函数

必须实现一个统一的点数计算函数，避免页面和接口各算各的。

建议文件名：

```text
lib/billing/points.ts
```

或按当前项目结构放在：

```text
utils/points.ts
services/billing.ts
```

建议函数：

```ts
export type GenerationMode =
  | 'normal'
  | 'extended'
  | 'wrong_question_similar'
  | 'upload_material'
  | 'full_paper_simulation';

export function getGenerationPointCost(mode: GenerationMode): number {
  switch (mode) {
    case 'normal':
      return 1;
    case 'extended':
      return 2;
    case 'wrong_question_similar':
      return 2;
    case 'upload_material':
      return 3;
    case 'full_paper_simulation':
      return 10;
    default:
      return 1;
  }
}
```

### 2.3 重要规则

生成前必须检查点数：

```text
如果 points_balance < 本次消耗点数：
    不允许生成
    返回额度不足
    前端弹出充值 / 购买套餐弹窗
```

生成成功后才扣点：

```text
AI 生成成功
↓
保存生成记录
↓
扣除点数
↓
写入点数流水
↓
返回结果
```

如果 AI 生成失败：

```text
不扣点
```

如果生成中途失败：

```text
不扣点
```

如果导出 PDF 失败：

```text
不额外扣点，因为 PDF 不扣点
```

---

## 3. PDF / Word 权益最终规则

### 3.1 PDF 下载

PDF 是核心交付，不再单独扣点。

| 用户类型 | PDF 下载 | 水印 |
|---|---|---|
| Free | 可以 | 有水印 |
| Starter | 可以 | 无水印 |
| Pro | 可以 | 无水印 |
| Teacher | 可以 | 无水印 |

免费版 PDF 水印文案建议：

```text
由 AI 出题小助手生成
扫码生成你的专属练习卷
```

### 3.2 Word 下载

Word 不扣点，但作为套餐权益控制。

| 用户类型 | Word 下载 |
|---|---|
| Free | 不支持，点击后弹出升级提示 |
| Starter | 建议不支持，或后续再开放 |
| Pro | 支持 |
| Teacher | 支持 |

MVP 建议：

```text
只有 Pro / Teacher 支持 Word 下载。
```

### 3.3 去水印

去水印不扣点，只判断是否为付费套餐。

| 用户类型 | 无水印 PDF |
|---|---|
| Free | 不支持 |
| Starter | 支持 |
| Pro | 支持 |
| Teacher | 支持 |

---

## 4. 国内小程序套餐最终版本

### 4.1 国内套餐

| 套餐 | 价格 | 点数 | 权益说明 |
|---|---:|---:|---|
| Free | ¥0 | 3 点，一次性 | 可体验生成，PDF 带水印，不支持 Word |
| Starter | ¥9.9/月 | 30 点/月 | 适合普通家长，PDF 无水印 |
| Pro | ¥19.9/月 | 80 点/月 | 适合高频家长，PDF 无水印，支持 Word，答案解析完整 |
| Teacher | ¥39.9/月 | 200 点/月 | 适合老师/家教，支持整卷仿真，Word，批量使用 |

### 4.2 国内点数包

MVP 只保留两个点数包：

| 点数包 | 价格 | 点数 |
|---|---:|---:|
| 小加量包 | ¥9.9 | 25 点 |
| 大加量包 | ¥29.9 | 100 点 |

### 4.3 为什么点数包比会员略贵

这是为了引导用户购买月卡。

示例：

```text
Pro：¥19.9/月 = 80 点
大加量包：¥29.9 = 100 点
```

经常使用的用户会自然选择 Pro。

### 4.4 月卡实现方式

国内小程序 V1 不强制实现自动续费订阅，先实现为“月卡权益”。

购买月卡后：

```text
1. 增加对应点数到 points_balance。
2. 设置 plan_code。
3. 设置 plan_expires_at = 当前时间 + 31 天。
4. 在有效期内享受对应权益。
```

如果用户重复购买同一套餐：

推荐简单处理：

```text
点数立即到账。
会员有效期从当前有效期结束后顺延 31 天。
```

如果用户升级套餐：

推荐简单处理：

```text
新套餐点数立即到账。
plan_code 更新为更高套餐。
plan_expires_at 至少延长 31 天。
```

MVP 不做复杂差价升级。

---

## 5. 海外 Web 定价预留

当前开发重点是国内微信小程序，但后端配置可以预留海外价格，未来 Web 复用。

### 5.1 海外套餐

| Plan | Price | Credits |
|---|---:|---:|
| Free | $0 | 5 credits once |
| Starter | $4.99/mo | 50 credits/month |
| Pro | $9.99/mo | 150 credits/month |
| Teacher | $19.99/mo | 400 credits/month |

### 5.2 海外加量包

| Pack | Price | Credits |
|---|---:|---:|
| Small Pack | $4.99 | 40 credits |
| Large Pack | $14.99 | 150 credits |

### 5.3 当前小程序阶段要求

本次 Codex 修改小程序时：

```text
必须落地国内套餐。
海外价格可以只放在配置文件中，不需要在国内小程序页面展示。
```

---

## 6. 分享与邀请奖励最终规则

这是本次修改重点。

### 6.1 朋友圈分享奖励

规则：

```text
每天首次分享到朋友圈，分享人奖励 1 点。
每天最多奖励 1 次。
```

表格：

| 行为 | 奖励对象 | 奖励 |
|---|---|---:|
| 每天首次分享到朋友圈 | 当前用户本人 | +1 点 |
| 当天重复分享到朋友圈 | 无 | 0 点 |

用户侧文案：

```text
每天分享到朋友圈，可领取 1 点。
每天限领 1 次。
```

按钮文案：

```text
分享到朋友圈，领取 1 点
```

### 6.2 分享奖励的技术处理

由于小程序端可能无法百分百证明用户真的完成朋友圈发布，MVP 按以下方式处理：

```text
用户点击“分享到朋友圈”入口
↓
触发小程序分享流程
↓
回到小程序后点击“领取今日分享奖励”
↓
后端检查今天是否已领取
↓
未领取则发放 1 点
```

后端只需要保证：

```text
同一个 user_id + reward_date + reward_type = timeline_share
每天只能成功一次
```

### 6.3 邀请购买奖励

规则：

```text
好友通过你的邀请链接进入，并完成首次购买成功，邀请人奖励 5 点。
```

表格：

| 行为 | 奖励对象 | 奖励 |
|---|---|---:|
| 好友点击链接 | 无 | 0 点 |
| 好友注册/登录 | 无 | 0 点 |
| 好友首次生成 | 无 | 0 点 |
| 好友首次购买成功 | 邀请人 | +5 点 |

用户侧文案：

```text
好友通过你的链接首次购买成功，你获得 5 点奖励。
```

### 6.4 明确不做的邀请奖励

不要做：

```text
双方各得 3 点
点击链接奖励
注册奖励
首次生成奖励
多级分销
现金返佣
```

被邀请的新用户不额外奖励点数，因为他已经有新人免费 3 点。

### 6.5 邀请关系绑定规则

当新用户通过邀请链接进入小程序时：

```text
如果该用户之前没有绑定过邀请人：
    绑定 inviter_user_id
否则：
    不覆盖原邀请关系
```

限制：

```text
一个 invitee_user_id 只能绑定一个 inviter_user_id。
一个 invitee_user_id 的首次购买只能奖励一次。
不能自己邀请自己。
```

---

## 7. 整卷仿真最终规则

### 7.1 命名规范

不要在产品里写：

```text
复制整张考卷
复制原卷
一键复制试卷
```

统一使用：

```text
整卷仿真
同结构练习卷
同难度变式卷
根据原卷生成新卷
```

### 7.2 产品解释

整卷仿真不是复制原题，而是：

```text
分析原试卷结构、题型、知识点、难度
然后生成一份新的同结构、同难度、不同题目的练习卷
```

### 7.3 点数消耗

MVP 固定：

| 功能 | 点数 |
|---|---:|
| 整卷仿真 | 10 点 |

### 7.4 上传限制

MVP 限制：

```text
最多上传 5 页
超过 5 页提示用户拆分上传
```

提示文案：

```text
当前版本最多支持上传 5 页试卷进行整卷仿真。
如试卷较长，请先拆分后上传。
```

### 7.5 版权与合规提示

在整卷仿真入口处展示：

```text
系统会根据原卷的知识点、题型和难度生成新的练习卷，不会复制原题。
生成内容仅供学习练习参考，请在使用前自行检查。
```

---

## 8. 小程序页面需要修改的内容

以下为建议页面结构。请 Codex 结合当前项目已有页面进行修改，不要求重做 UI，只要求规则和交互正确。

---

### 8.1 生成页

页面目标：

```text
用户输入要求或上传资料，选择生成类型，看到本次消耗点数，然后点击生成。
```

必须展示：

1. 输入框。
2. 上传入口。
3. 生成类型选择。
4. 本次消耗点数。
5. 当前剩余点数。
6. 生成按钮。
7. 额度不足时的购买入口。

生成类型：

| 类型 | mode | 消耗 |
|---|---|---:|
| 普通练习卷 | normal | 1 点 |
| 加长练习卷 | extended | 2 点 |
| 错题同类题 | wrong_question_similar | 2 点 |
| 上传资料生成 | upload_material | 3 点 |
| 整卷仿真 | full_paper_simulation | 10 点 |

按钮附近文案：

```text
本次生成将消耗 1 点
当前剩余 12 点
```

额度不足时：

```text
点数不足，本次生成需要 10 点。
请购买套餐或点数包后继续生成。
```

---

### 8.2 结果页 / 练习卷详情页

必须展示：

1. 试卷标题。
2. 题目列表。
3. 答案区。
4. PDF 下载按钮。
5. Word 下载按钮。
6. 重新生成按钮。
7. 分享按钮。

PDF 下载按钮：

```text
下载 PDF
```

免费用户下载 PDF 时：

```text
生成带水印 PDF
```

付费用户下载 PDF 时：

```text
生成无水印 PDF
```

Word 按钮权限：

```text
Free / Starter 用户点击 Word：
弹出升级 Pro 提示

Pro / Teacher 用户：
直接下载 Word
```

---

### 8.3 历史记录页

如果当前小程序已经做了历史记录，应按以下规则展示：

列表字段：

```text
标题
生成类型
消耗点数
生成时间
是否可重新打开
```

免费用户历史记录建议限制：

```text
最近 3 条
```

付费用户：

```text
全部历史记录
```

如果当前 MVP 暂时没有历史记录，不强制实现。但如果现有 UI 已有 History，则必须保持可用。

---

### 8.4 我的 / 个人中心页

必须展示：

1. 当前套餐。
2. 套餐到期时间。
3. 当前剩余点数。
4. 购买套餐入口。
5. 购买点数包入口。
6. 购买记录。
7. 分享得点数入口。

示例：

```text
当前套餐：Pro
到期时间：2026-06-17
剩余点数：72 点
```

免费用户：

```text
当前套餐：Free
剩余点数：3 点
升级后可解锁无水印 PDF、Word 下载、整卷仿真。
```

---

### 8.5 定价 / 购买页

国内小程序只展示国内套餐：

| 套餐 | 价格 | 点数 | 推荐文案 |
|---|---:|---:|---|
| Starter | ¥9.9/月 | 30 点 | 适合轻量练习 |
| Pro | ¥19.9/月 | 80 点 | 推荐，适合每天练 |
| Teacher | ¥39.9/月 | 200 点 | 适合老师和家教 |

加量包：

| 点数包 | 价格 | 点数 |
|---|---:|---:|
| 小加量包 | ¥9.9 | 25 点 |
| 大加量包 | ¥29.9 | 100 点 |

Pro 推荐标签：

```text
推荐
```

Pro 文案：

```text
每月 80 点，约可生成 80 份普通练习卷，或 8 份整卷仿真。
支持无水印 PDF、Word 下载、完整答案解析。
```

---

### 8.6 分享得点数页 / 弹窗

可以做成弹窗，不一定单独页面。

文案：

```text
赚点数

1. 每天分享到朋友圈，可领取 1 点，每天限 1 次。
2. 好友通过你的链接首次购买成功，你获得 5 点。
```

按钮：

```text
分享到朋友圈
复制邀请链接
```

状态提示：

如果今天已领取：

```text
你今天已经领取过分享奖励，明天再来吧。
```

如果领取成功：

```text
领取成功，已获得 1 点。
```

---

## 9. 后端 / 云函数 / API 修改要求

根据当前项目实际架构，可以是自建后端、云开发云函数、Next.js API、Node 服务。无论用哪种架构，都要实现同样的业务接口。

---

### 9.1 获取当前用户权益

```http
GET /api/me
```

返回：

```json
{
  "userId": "xxx",
  "openid": "xxx",
  "planCode": "pro",
  "planExpiresAt": "2026-06-17T00:00:00.000Z",
  "pointsBalance": 72,
  "isPaid": true,
  "canDownloadWord": true,
  "canRemoveWatermark": true
}
```

---

### 9.2 计算生成点数

```http
POST /api/generation/estimate
```

请求：

```json
{
  "mode": "full_paper_simulation"
}
```

返回：

```json
{
  "mode": "full_paper_simulation",
  "pointsRequired": 10,
  "pointsBalance": 72,
  "canGenerate": true
}
```

---

### 9.3 生成练习卷

```http
POST /api/generate
```

请求：

```json
{
  "mode": "normal",
  "prompt": "生成10道初一数学一元一次方程中等题，带答案解析",
  "fileIds": []
}
```

处理逻辑：

```text
1. 登录校验。
2. 根据 mode 计算本次消耗点数。
3. 判断用户点数是否足够。
4. 点数不足则返回错误。
5. 调用 AI 生成。
6. 生成成功后扣点。
7. 写入 point_transactions。
8. 写入 generation_records。
9. 返回 worksheet。
```

点数不足返回：

```json
{
  "success": false,
  "code": "POINTS_NOT_ENOUGH",
  "message": "点数不足，本次生成需要 10 点。",
  "pointsRequired": 10,
  "pointsBalance": 3
}
```

生成成功返回：

```json
{
  "success": true,
  "worksheetId": "xxx",
  "pointsUsed": 1,
  "pointsBalance": 71,
  "worksheet": {}
}
```

---

### 9.4 PDF 导出

```http
POST /api/export/pdf
```

请求：

```json
{
  "worksheetId": "xxx"
}
```

处理：

```text
如果用户是 Free：
    返回带水印 PDF

如果用户是 Starter / Pro / Teacher 且未过期：
    返回无水印 PDF
```

注意：

```text
PDF 导出不扣点。
```

---

### 9.5 Word 导出

```http
POST /api/export/docx
```

请求：

```json
{
  "worksheetId": "xxx"
}
```

处理：

```text
如果用户是 Pro / Teacher 且未过期：
    返回 Word

否则：
    返回需要升级提示
```

错误返回：

```json
{
  "success": false,
  "code": "PLAN_REQUIRED",
  "message": "Word 下载仅 Pro / Teacher 用户可用。"
}
```

注意：

```text
Word 导出不扣点。
```

---

### 9.6 购买套餐

```http
POST /api/orders/create
```

请求：

```json
{
  "productCode": "pro_monthly"
}
```

返回：

```json
{
  "orderId": "xxx",
  "paymentParams": {}
}
```

支付成功回调处理：

```text
1. 校验支付结果。
2. 更新订单状态为 paid。
3. 给用户发放对应点数。
4. 更新用户套餐和到期时间。
5. 写入 point_transactions。
6. 如果这是被邀请用户的首次购买，则给邀请人奖励 5 点。
```

---

### 9.7 每日朋友圈分享奖励

```http
POST /api/rewards/share-timeline
```

请求：

```json
{
  "channel": "timeline"
}
```

处理：

```text
1. 判断用户今天是否已经领取 timeline_share 奖励。
2. 如果已经领取，返回已领取。
3. 如果未领取，给用户 +1 点。
4. 写入 share_reward_logs。
5. 写入 point_transactions。
```

成功返回：

```json
{
  "success": true,
  "pointsAdded": 1,
  "pointsBalance": 73,
  "message": "领取成功，已获得 1 点。"
}
```

已领取返回：

```json
{
  "success": false,
  "code": "ALREADY_CLAIMED",
  "message": "你今天已经领取过分享奖励，明天再来吧。"
}
```

---

### 9.8 绑定邀请关系

```http
POST /api/invite/bind
```

请求：

```json
{
  "inviteCode": "abc123"
}
```

处理：

```text
1. 当前用户不能绑定自己。
2. 如果当前用户已有邀请人，不重复绑定。
3. 如果 inviteCode 有效，则绑定 inviter_user_id。
```

---

## 10. 数据库表设计

如果当前项目已经有数据库，请按现有命名适配。没有的话，建议增加以下最小表。

---

### 10.1 users

```sql
CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  openid VARCHAR(128) UNIQUE,
  unionid VARCHAR(128),
  nickname VARCHAR(128),
  avatar_url TEXT,
  plan_code VARCHAR(32) DEFAULT 'free',
  plan_expires_at TIMESTAMP NULL,
  points_balance INT DEFAULT 0,
  invite_code VARCHAR(32) UNIQUE,
  invited_by_user_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### 10.2 point_transactions

```sql
CREATE TABLE point_transactions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  related_id VARCHAR(64),
  remark TEXT,
  created_at TIMESTAMP NOT NULL
);
```

type 建议：

```text
new_user_bonus
generate_cost
plan_purchase_bonus
point_pack_purchase
daily_share_reward
invite_purchase_reward
manual_adjustment
```

### 10.3 orders

```sql
CREATE TABLE orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(64) NOT NULL,
  product_type VARCHAR(32) NOT NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(16) DEFAULT 'CNY',
  status VARCHAR(32) NOT NULL,
  payment_provider VARCHAR(32),
  payment_transaction_id VARCHAR(128),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

product_type：

```text
plan
point_pack
```

status：

```text
pending
paid
failed
refunded
closed
```

### 10.4 generation_records

```sql
CREATE TABLE generation_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  mode VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  points_used INT NOT NULL,
  worksheet_json JSON,
  created_at TIMESTAMP NOT NULL
);
```

如果担心保存完整内容有隐私风险，可以只保存：

```text
title
mode
points_used
created_at
file_path / temporary worksheet id
```

但小程序如果要做历史记录，至少需要保存生成结果或可重新生成的信息。

### 10.5 share_reward_logs

```sql
CREATE TABLE share_reward_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  reward_date DATE NOT NULL,
  reward_type VARCHAR(64) NOT NULL,
  points INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(user_id, reward_date, reward_type)
);
```

reward_type：

```text
timeline_share
```

### 10.6 invite_reward_logs

```sql
CREATE TABLE invite_reward_logs (
  id VARCHAR(64) PRIMARY KEY,
  inviter_user_id VARCHAR(64) NOT NULL,
  invitee_user_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  points INT NOT NULL DEFAULT 5,
  created_at TIMESTAMP NOT NULL,
  UNIQUE(invitee_user_id)
);
```

说明：

```text
一个被邀请用户的首次购买，只能触发一次邀请奖励。
```

---

## 11. 套餐与商品配置

建议把套餐配置集中在一个配置文件中，不要散落在页面和后端。

建议文件：

```text
config/products.ts
```

内容示例：

```ts
export const CN_PLANS = {
  starter_monthly: {
    code: 'starter_monthly',
    planCode: 'starter',
    name: 'Starter',
    priceCents: 990,
    points: 30,
    durationDays: 31,
    canRemoveWatermark: true,
    canDownloadWord: false,
  },
  pro_monthly: {
    code: 'pro_monthly',
    planCode: 'pro',
    name: 'Pro',
    priceCents: 1990,
    points: 80,
    durationDays: 31,
    canRemoveWatermark: true,
    canDownloadWord: true,
  },
  teacher_monthly: {
    code: 'teacher_monthly',
    planCode: 'teacher',
    name: 'Teacher',
    priceCents: 3990,
    points: 200,
    durationDays: 31,
    canRemoveWatermark: true,
    canDownloadWord: true,
  },
};

export const CN_POINT_PACKS = {
  small_pack: {
    code: 'small_pack',
    name: '小加量包',
    priceCents: 990,
    points: 25,
  },
  large_pack: {
    code: 'large_pack',
    name: '大加量包',
    priceCents: 2990,
    points: 100,
  },
};
```

---

## 12. 权限判断函数

建议统一实现权限判断，避免页面和接口不一致。

```ts
export function isPaidPlan(user: User): boolean {
  return (
    user.planCode !== 'free' &&
    user.planExpiresAt &&
    new Date(user.planExpiresAt).getTime() > Date.now()
  );
}

export function canRemoveWatermark(user: User): boolean {
  return isPaidPlan(user);
}

export function canDownloadWord(user: User): boolean {
  return (
    isPaidPlan(user) &&
    ['pro', 'teacher'].includes(user.planCode)
  );
}
```

---

## 13. 前端状态与提示文案

### 13.1 生成按钮文案

普通生成：

```text
生成练习卷（消耗 1 点）
```

整卷仿真：

```text
生成同结构练习卷（消耗 10 点）
```

### 13.2 点数不足弹窗

```text
点数不足

本次生成需要 10 点，你当前剩余 3 点。
购买套餐或点数包后即可继续生成。
```

按钮：

```text
购买套餐
购买点数包
```

### 13.3 Word 升级弹窗

```text
Word 下载仅 Pro / Teacher 用户可用

升级后可下载可编辑 Word，并解锁无水印 PDF、完整答案解析和更多生成点数。
```

按钮：

```text
升级 Pro
```

### 13.4 水印提示

免费用户 PDF 下载按钮旁提示：

```text
免费版 PDF 会带有水印。
升级后可下载无水印 PDF。
```

### 13.5 分享奖励提示

```text
每天分享到朋友圈，可领取 1 点。
好友通过你的链接首次购买成功，你获得 5 点。
```

---

## 14. 测试验收清单

Codex 修改完成后，必须跑通以下测试。

---

### 14.1 点数消耗测试

| 测试项 | 期望 |
|---|---|
| Free 新用户首次登录 | points_balance = 3 |
| 普通生成成功 | 扣 1 点 |
| 加长生成成功 | 扣 2 点 |
| 错题同类题生成成功 | 扣 2 点 |
| 上传资料生成成功 | 扣 3 点 |
| 整卷仿真生成成功 | 扣 10 点 |
| AI 生成失败 | 不扣点 |
| 点数不足 | 不生成，不扣点，提示购买 |

---

### 14.2 PDF / Word 测试

| 测试项 | 期望 |
|---|---|
| Free 下载 PDF | 成功，带水印，不扣点 |
| Starter 下载 PDF | 成功，无水印，不扣点 |
| Pro 下载 PDF | 成功，无水印，不扣点 |
| Teacher 下载 PDF | 成功，无水印，不扣点 |
| Free 下载 Word | 拦截，提示升级 |
| Starter 下载 Word | 拦截，提示升级 Pro |
| Pro 下载 Word | 成功，不扣点 |
| Teacher 下载 Word | 成功，不扣点 |

---

### 14.3 套餐购买测试

| 测试项 | 期望 |
|---|---|
| 购买 Starter | +30 点，plan=starter，有效期 +31 天 |
| 购买 Pro | +80 点，plan=pro，有效期 +31 天 |
| 购买 Teacher | +200 点，plan=teacher，有效期 +31 天 |
| 购买小加量包 | +25 点，不改变 plan |
| 购买大加量包 | +100 点，不改变 plan |
| 重复购买月卡 | 点数到账，有效期顺延 |
| 支付失败 | 不发点，不改权益 |
| 支付回调重复 | 不重复发点 |

---

### 14.4 分享奖励测试

| 测试项 | 期望 |
|---|---|
| 当天首次领取朋友圈分享奖励 | +1 点 |
| 当天第二次领取 | 不加点，提示已领取 |
| 第二天再次领取 | 可再次 +1 点 |
| 分享奖励流水 | point_transactions 有记录 |
| share_reward_logs 唯一约束 | 同一天不能重复发放 |

---

### 14.5 邀请购买测试

| 测试项 | 期望 |
|---|---|
| 新用户通过邀请链接进入 | 绑定 inviter |
| 新用户首次购买成功 | 邀请人 +5 点 |
| 被邀请人自己不额外得点 | 只保留新人 3 点 |
| 同一个被邀请人第二次购买 | 不再奖励邀请人 |
| 自己邀请自己 | 不允许 |
| 退款场景 | MVP 可暂不自动扣回，但订单状态必须可追踪 |

---

### 14.6 整卷仿真测试

| 测试项 | 期望 |
|---|---|
| 选择整卷仿真 | 显示消耗 10 点 |
| 点数不足 10 点 | 不允许生成 |
| 上传 5 页以内 | 允许 |
| 上传超过 5 页 | 拦截提示拆分 |
| 生成结果 | 不是复制原题，而是同结构新题 |
| 导出 PDF | 成功 |
| 导出 Word | Pro / Teacher 成功 |

---

## 15. Codex 执行指令

把下面这段直接发给 Codex：

```text
你现在接手的是一个已经开发到一半的微信小程序项目：AI 出题小助手 / AI 练习卷打印助手。

不要重做整个项目。请在当前代码基础上完成以下增量修改：

一、统一点数规则
1. 只为“生成”扣点，下载 PDF、下载 Word、去水印都不扣点。
2. 点数消耗固定为：
   - 普通练习卷，10 题以内：1 点
   - 加长练习卷，20 题以内：2 点
   - 错题同类题：2 点
   - 上传资料生成：3 点
   - 整卷仿真：10 点
3. 生成成功后才扣点，生成失败不扣点。
4. 点数不足时禁止生成，并提示购买套餐或点数包。

二、修改免费/付费权益
1. Free 新用户一次性获得 3 点。
2. PDF 下载不扣点：
   - Free：可下载带水印 PDF
   - Starter / Pro / Teacher：可下载无水印 PDF
3. Word 下载不扣点，但仅 Pro / Teacher 用户可用。
4. Starter 不支持 Word，点击时提示升级 Pro。
5. 去水印不扣点，只判断是否为有效付费套餐。

三、修改国内套餐
1. 国内小程序套餐：
   - Free：¥0，3 点
   - Starter：¥9.9/月，30 点
   - Pro：¥19.9/月，80 点
   - Teacher：¥39.9/月，200 点
2. 点数包：
   - 小加量包：¥9.9，25 点
   - 大加量包：¥29.9，100 点
3. 国内小程序 V1 先按月卡实现：
   - 购买后发放点数
   - 设置 plan_code
   - 设置 plan_expires_at = 当前时间 + 31 天
   - 不要求实现自动续费

四、修改分享奖励
1. 朋友圈分享奖励：
   - 每天首次分享到朋友圈，分享人获得 1 点
   - 每天最多奖励一次
2. 邀请购买奖励：
   - 好友通过邀请链接进入并完成首次购买成功，邀请人获得 5 点
   - 被邀请人不额外获得点数，只享受新人 3 点
3. 不做双方各得。
4. 不做点击奖励、注册奖励、首次生成奖励。
5. 防重复：
   - 同一用户同一天只能领取一次朋友圈分享奖励
   - 同一被邀请用户的首次购买只能奖励一次邀请人
   - 不允许自己邀请自己

五、修改整卷仿真
1. 产品文案统一为“整卷仿真 / 同结构练习卷 / 同难度变式卷”，不要写“复制考卷”。
2. 整卷仿真固定消耗 10 点。
3. MVP 最多上传 5 页，超过 5 页提示用户拆分上传。
4. 输出必须是新题，不能复制原题。
5. 整卷仿真生成成功后扣 10 点，失败不扣点。

六、页面修改
1. 生成页要显示：
   - 当前剩余点数
   - 本次生成消耗点数
   - 生成按钮
   - 点数不足时购买入口
2. 结果页要显示：
   - 下载 PDF
   - 下载 Word
   - 分享按钮
   - 免费 PDF 水印提示
3. 我的页面要显示：
   - 当前套餐
   - 到期时间
   - 剩余点数
   - 购买套餐
   - 购买点数包
   - 分享得点数入口
4. 定价页只展示国内套餐：
   - Starter ¥9.9/月 30 点
   - Pro ¥19.9/月 80 点
   - Teacher ¥39.9/月 200 点
   - 小加量包 ¥9.9 25 点
   - 大加量包 ¥29.9 100 点

七、后端/数据库
1. 如果当前项目已经有数据库，请复用现有表并补字段。
2. 如果没有，请增加最小表：
   - users
   - point_transactions
   - orders
   - generation_records
   - share_reward_logs
   - invite_reward_logs
3. 所有点数变动必须写 point_transactions。
4. 支付回调必须幂等，不能重复发放点数。
5. 分享奖励必须按 user_id + 日期唯一。
6. 邀请购买奖励必须按 invitee_user_id 唯一。

八、必须验收
1. Free 新用户有 3 点。
2. 普通生成扣 1 点。
3. 整卷仿真扣 10 点。
4. PDF 下载不扣点。
5. Free PDF 有水印。
6. Pro PDF 无水印。
7. Free / Starter 下载 Word 会提示升级。
8. Pro / Teacher 可以下载 Word。
9. 每日朋友圈分享只奖励 1 点一次。
10. 好友首次购买成功，邀请人获得 5 点。
11. 同一好友第二次购买不再奖励。
12. 点数不足时不能生成。
13. AI 生成失败不扣点。
14. 整卷仿真超过 5 页会提示拆分。
15. 所有测试通过后，输出一份开发完成报告，说明改了哪些文件、哪些功能已验证、还有哪些风险。
```

---

## 16. 最终确认版本

本次小程序开发以以下规则为准：

```text
国内 Free：3 点
Starter：¥9.9/月，30 点
Pro：¥19.9/月，80 点
Teacher：¥39.9/月，200 点

普通生成：1 点
加长生成：2 点
错题同类题：2 点
上传资料生成：3 点
整卷仿真：10 点

PDF 下载：0 点
Word 下载：0 点，但仅 Pro / Teacher
免费 PDF：有水印
付费 PDF：无水印

朋友圈分享：每天一次，分享人 +1 点
邀请购买：好友首次购买成功，邀请人 +5 点
不做双方奖励
不做注册奖励
不做点击奖励
```

这就是当前微信小程序 V1 的最终商业规则和开发规则。
