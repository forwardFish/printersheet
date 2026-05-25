import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { WechatPaymentProvider } from '../src/adapters/payment.js'
import { OrderService } from '../src/services/orderService.js'

function keyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
}

function privatePem(keyObject) {
  return keyObject.export({ type: 'pkcs8', format: 'pem' })
}

function publicPem(keyObject) {
  return keyObject.export({ type: 'spki', format: 'pem' })
}

function encryptNotifyResource(apiV3Key, payload, resourceNonce = 'notify-nonce-001', associatedData = 'transaction') {
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(resourceNonce, 'utf8'))
  cipher.setAAD(Buffer.from(associatedData, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return {
    algorithm: 'AEAD_AES_256_GCM',
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64'),
    associated_data: associatedData,
    nonce: resourceNonce,
    original_type: 'transaction'
  }
}

test('WeChat JSAPI prepay creates signed request and requestPayment params', async () => {
  const merchant = keyPair()
  const attached = []
  const provider = new WechatPaymentProvider({
    env: {
      wechatAppId: 'wx-test-app',
      wechatPayMchId: '1112933433',
      wechatPaySerialNo: 'serial-001',
      wechatPayPrivateKey: privatePem(merchant.privateKey),
      wechatPayNotifyUrl: 'https://example.test/api/pay/notify',
      wechatPayDescription: 'AI test order'
    },
    orderService: {
      attachPrepay(orderNo, patch) {
        attached.push({ orderNo, patch })
      }
    },
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi')
      assert.match(init.headers.Authorization, /WECHATPAY2-SHA256-RSA2048/)
      assert.match(init.headers.Authorization, /mchid="1112933433"/)
      assert.match(init.headers.Authorization, /serial_no="serial-001"/)
      assert.match(init.headers.Authorization, /^WECHATPAY2-SHA256-RSA2048 mchid="1112933433",nonce_str="[A-F0-9]+",signature="[^"]+",timestamp="\d+",serial_no="serial-001"$/)
      const body = JSON.parse(init.body)
      assert.equal(body.appid, 'wx-test-app')
      assert.equal(body.mchid, '1112933433')
      assert.equal(body.out_trade_no, 'ord_20260520_debug')
      assert.equal(body.amount.total, 100)
      assert.equal(body.payer.openid, 'openid-debug-user')
      return new Response(JSON.stringify({ prepay_id: 'wx-prepay-debug' }), { status: 200 })
    }
  })

  const result = await provider.createPrepay({
    order: { id: 'order-id-1', orderNo: 'ord_20260520_debug', amountCents: 100 },
    user: { openid: 'openid-debug-user' }
  })

  assert.equal(result.prepayId, 'wx-prepay-debug')
  assert.equal(result.payment.package, 'prepay_id=wx-prepay-debug')
  assert.equal(result.payment.signType, 'RSA')
  assert.ok(result.payment.paySign)
  assert.deepEqual(attached, [{ orderNo: 'ord_20260520_debug', patch: { prepayId: 'wx-prepay-debug' } }])
})

test('payment test mode forces paid products to one cent while keeping original amount', () => {
  const service = new OrderService({
    db: {},
    authService: {},
    env: { paymentTestMode: true, wechatPayTestAmountCents: 1 }
  })
  const products = service.listProducts()
  const pro = products.find(item => item.id === 'pro_monthly')

  assert.equal(pro.amountCents, 1)
  assert.equal(pro.price, '0.01')
  assert.equal(pro.originalAmountCents, 1990)
  assert.equal(pro.paymentTestMode, true)
})

test('payment production mode keeps normal product price', () => {
  const service = new OrderService({
    db: {},
    authService: {},
    env: { paymentTestMode: false, wechatPayTestAmountCents: 1 }
  })
  const products = service.listProducts()
  const pro = products.find(item => item.id === 'pro_monthly')

  assert.equal(pro.amountCents, 1990)
  assert.equal(pro.price, '19.90')
  assert.equal(pro.paymentTestMode, false)
})

test('WeChat order refresh queries out_trade_no and fulfills successful transaction', async () => {
  const merchant = keyPair()
  const paid = []
  const provider = new WechatPaymentProvider({
    env: {
      wechatAppId: 'wx-test-app',
      wechatPayMchId: '1112933433',
      wechatPaySerialNo: 'serial-001',
      wechatPayPrivateKey: privatePem(merchant.privateKey),
      wechatPayNotifyUrl: 'https://example.test/api/pay/notify',
      wechatPayDescription: 'AI test order'
    },
    orderService: {
      db: {
        findOrderByOrderNo(orderNo) {
          return { orderNo, userId: 'user-refresh', amountCents: 1 }
        },
        findUserById(userId) {
          return { id: userId, openid: 'openid-debug-user' }
        }
      },
      markPaid(orderNo, patch) {
        paid.push({ orderNo, patch })
        return { order: { orderNo, status: 'paid' }, fulfilled: true }
      }
    },
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/ord_refresh_001?mchid=1112933433')
      assert.equal(init.method, 'GET')
      assert.match(init.headers.Authorization, /WECHATPAY2-SHA256-RSA2048/)
      return new Response(JSON.stringify({
        appid: 'wx-test-app',
        mchid: '1112933433',
        out_trade_no: 'ord_refresh_001',
        transaction_id: '420000000020260521000001',
        trade_type: 'JSAPI',
        trade_state: 'SUCCESS',
        success_time: '2026-05-21T12:00:00+08:00',
        payer: { openid: 'openid-debug-user' },
        amount: { total: 1, payer_total: 1, currency: 'CNY', payer_currency: 'CNY' }
      }), { status: 200 })
    }
  })

  const result = await provider.refreshOrder('ord_refresh_001')

  assert.equal(result.order.status, 'paid')
  assert.equal(paid[0].orderNo, 'ord_refresh_001')
  assert.equal(paid[0].patch.channel, 'wechat_pay')
  assert.equal(paid[0].patch.transactionId, '420000000020260521000001')
  assert.equal(paid[0].patch.notifyPayload.amount.total, 1)
  assert.equal(paid[0].patch.notifyPayload.refreshedFromQuery, true)
})

test('WeChat payment notify verifies signature, decrypts resource, and marks order paid', async () => {
  const platform = keyPair()
  const apiV3Key = '12345678901234567890123456789012'
  const transaction = {
    appid: 'wx-test-app',
    mchid: '1112933433',
    out_trade_no: 'ord_20260520_notify',
    transaction_id: '420000000020260520000001',
    trade_type: 'JSAPI',
    trade_state: 'SUCCESS',
    success_time: '2026-05-20T12:00:00+08:00',
    payer: { openid: 'openid-debug-user' },
    amount: { total: 100, payer_total: 100, currency: 'CNY', payer_currency: 'CNY' }
  }
  const body = {
    id: 'EV-20260520-debug',
    create_time: '2026-05-20T12:00:01+08:00',
    event_type: 'TRANSACTION.SUCCESS',
    resource_type: 'encrypt-resource',
    summary: 'payment success',
    resource: encryptNotifyResource(apiV3Key, transaction)
  }
  const rawBody = JSON.stringify(body)
  const timestamp = '1779259201'
  const notifyNonce = 'notify-header-nonce'
  const signature = crypto.createSign('RSA-SHA256')
    .update(`${timestamp}\n${notifyNonce}\n${rawBody}\n`)
    .sign(platform.privateKey, 'base64')
  const paid = []
  const provider = new WechatPaymentProvider({
    env: {
      wechatAppId: 'wx-test-app',
      wechatPayMchId: '1112933433',
      wechatPayApiV3Key: apiV3Key,
      wechatPayPlatformCert: publicPem(platform.publicKey)
    },
    orderService: {
      db: {
        findOrderByOrderNo(orderNo) {
          return { orderNo, userId: 'user-notify', amountCents: 100 }
        },
        findUserById(userId) {
          return { id: userId, openid: 'openid-debug-user' }
        }
      },
      markPaid(orderNo, patch) {
        paid.push({ orderNo, patch })
        return { order: { orderNo, status: 'paid' }, fulfilled: true }
      }
    }
  })

  const result = await provider.handleNotify({
    headers: {
      'wechatpay-timestamp': timestamp,
      'wechatpay-nonce': notifyNonce,
      'wechatpay-signature': signature,
      'wechatpay-serial': 'platform-serial'
    },
    body,
    rawBody
  })

  assert.equal(result.order.status, 'paid')
  assert.equal(paid[0].orderNo, 'ord_20260520_notify')
  assert.equal(paid[0].patch.channel, 'wechat_pay')
  assert.equal(paid[0].patch.transactionId, '420000000020260520000001')
  assert.equal(paid[0].patch.notifyPayload.amount.total, 100)
})

test('WeChat transaction fulfillment rejects amount or payer mismatches', async () => {
  const provider = new WechatPaymentProvider({
    env: {
      wechatAppId: 'wx-test-app',
      wechatPayMchId: '1112933433'
    },
    orderService: {
      db: {
        findOrderByOrderNo(orderNo) {
          return { orderNo, userId: 'user-owned-order', amountCents: 100 }
        },
        findUserById(userId) {
          return { id: userId, openid: 'openid-owner' }
        }
      },
      markPaid() {
        throw new Error('should not mark mismatched transaction paid')
      }
    }
  })
  const baseTransaction = {
    appid: 'wx-test-app',
    mchid: '1112933433',
    out_trade_no: 'ord_secure_001',
    transaction_id: 'tx-secure-001',
    trade_type: 'JSAPI',
    trade_state: 'SUCCESS',
    success_time: '2026-05-22T12:00:00+08:00',
    payer: { openid: 'openid-owner' },
    amount: { total: 100 }
  }

  await assert.rejects(
    provider.markPaidFromTransaction({ ...baseTransaction, amount: { total: 1 } }),
    /amount mismatch/
  )
  await assert.rejects(
    provider.markPaidFromTransaction({ ...baseTransaction, payer: { openid: 'openid-other' } }),
    /payer openid mismatch/
  )
})
