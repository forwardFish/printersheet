import crypto from 'crypto'

const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com'
const JSAPI_PREPAY_PATH = '/v3/pay/transactions/jsapi'
const OUT_TRADE_NO_QUERY_PATH = '/v3/pay/transactions/out-trade-no'

function normalizePrivateKey(privateKey = '') {
  return String(privateKey || '').replace(/\\n/g, '\n').trim()
}

function nonce(size = 16) {
  return crypto.randomBytes(size).toString('hex').toUpperCase()
}

function signRsa(message, privateKey) {
  return crypto.createSign('RSA-SHA256').update(message).sign(normalizePrivateKey(privateKey), 'base64')
}

function decryptAes256Gcm({ apiV3Key, ciphertext, nonce: resourceNonce, associatedData = '' }) {
  const key = Buffer.from(String(apiV3Key || ''), 'utf8')
  if (key.length !== 32) throw new Error('WECHAT_PAY_API_V3_KEY must be 32 bytes')
  const encrypted = Buffer.from(ciphertext, 'base64')
  const authTag = encrypted.subarray(encrypted.length - 16)
  const data = encrypted.subarray(0, encrypted.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(resourceNonce, 'utf8'))
  decipher.setAuthTag(authTag)
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

function httpError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function getHeader(headers = {}, name) {
  return headers[name.toLowerCase()] || headers[name] || ''
}

function normalizeSerial(serial = '') {
  return String(serial || '').replace(/:/g, '').toUpperCase()
}

function assertMerchantCertificate({ cert, privateKey, serialNo }) {
  if (!cert) return
  let x509
  try {
    x509 = new crypto.X509Certificate(cert)
  } catch (error) {
    throw httpError(`WECHAT_PAY_MERCHANT_CERT parse failed: ${error.message}`, 500)
  }
  const certSerial = normalizeSerial(x509.serialNumber)
  const configuredSerial = normalizeSerial(serialNo)
  if (certSerial !== configuredSerial) {
    throw httpError(`WECHAT_PAY_SERIAL_NO mismatch: configured ${configuredSerial}, merchant cert ${certSerial}`, 500)
  }
  try {
    const payload = Buffer.from('wechat-pay-merchant-cert-check')
    const signature = crypto.sign('RSA-SHA256', payload, normalizePrivateKey(privateKey))
    const verified = crypto.verify('RSA-SHA256', payload, x509.publicKey, signature)
    if (!verified) throw new Error('private key does not match merchant certificate public key')
  } catch (error) {
    throw httpError(`WECHAT_PAY_PRIVATE_KEY mismatch: ${error.message}`, 500)
  }
}

export class MockPaymentProvider {
  constructor({ db, orderService }) {
    this.db = db
    this.orderService = orderService
  }

  isRealPaymentEnabled() {
    return false
  }

  async markSuccess(orderNo) {
    return this.orderService.markPaid(orderNo, { channel: 'mock' })
  }

  async refreshOrder(orderNo) {
    return { order: await this.db.findOrderByOrderNo(orderNo), fulfilled: false, transaction: null }
  }
}

export class WechatPaymentProvider {
  constructor({ env, orderService, fetchImpl = globalThis.fetch } = {}) {
    this.env = env
    this.orderService = orderService
    this.fetchImpl = fetchImpl
  }

  isRealPaymentEnabled() {
    return true
  }

  assertPrepayConfig() {
    const missing = [
      ['WECHAT_APP_ID', this.env.wechatAppId],
      ['WECHAT_PAY_MCH_ID', this.env.wechatPayMchId],
      ['WECHAT_PAY_SERIAL_NO', this.env.wechatPaySerialNo],
      ['WECHAT_PAY_PRIVATE_KEY or WECHAT_PAY_PRIVATE_KEY_PATH', this.env.wechatPayPrivateKey],
      ['WECHAT_PAY_NOTIFY_URL', this.env.wechatPayNotifyUrl]
    ].filter(([, value]) => !value).map(([name]) => name)
    if (missing.length) throw httpError(`WeChat Pay config missing: ${missing.join(', ')}`, 500)
    assertMerchantCertificate({
      cert: this.env.wechatPayMerchantCert,
      privateKey: this.env.wechatPayPrivateKey,
      serialNo: this.env.wechatPaySerialNo
    })
  }

  assertNotifyConfig() {
    const missing = [
      ['WECHAT_PAY_API_V3_KEY', this.env.wechatPayApiV3Key],
      ['WECHAT_PAY_PLATFORM_CERT or WECHAT_PAY_PLATFORM_CERT_PATH', this.env.wechatPayPlatformCert]
    ].filter(([, value]) => !value).map(([name]) => name)
    if (this.env.wechatPaySkipNotifySignature) {
      return
    }
    if (missing.length) throw httpError(`WeChat Pay notify config missing: ${missing.join(', ')}`, 500)
  }

  buildAuthorization({ method, path, body, timestamp, nonceStr }) {
    const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`
    const signature = signRsa(message, this.env.wechatPayPrivateKey)
    const params = [
      `mchid="${this.env.wechatPayMchId}"`,
      `nonce_str="${nonceStr}"`,
      `signature="${signature}"`,
      `timestamp="${timestamp}"`,
      `serial_no="${this.env.wechatPaySerialNo}"`
    ]
    return `WECHATPAY2-SHA256-RSA2048 ${params.join(',')}`
  }

  buildRequestPaymentParams(prepayId) {
    const timeStamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = nonce()
    const pkg = `prepay_id=${prepayId}`
    const paySign = signRsa(`${this.env.wechatAppId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`, this.env.wechatPayPrivateKey)
    return {
      timeStamp,
      nonceStr,
      package: pkg,
      signType: 'RSA',
      paySign
    }
  }

  async createPrepay({ order, user }) {
    this.assertPrepayConfig()
    if (!user?.openid) throw httpError('WeChat openid is required before creating a payment order', 400)
    if (!order?.amountCents || Number(order.amountCents) <= 0) throw httpError('order amount must be greater than 0', 400)

    const body = JSON.stringify({
      appid: this.env.wechatAppId,
      mchid: this.env.wechatPayMchId,
      description: this.env.wechatPayDescription,
      out_trade_no: order.orderNo,
      attach: order.id,
      notify_url: this.env.wechatPayNotifyUrl,
      amount: {
        total: Number(order.amountCents),
        currency: 'CNY'
      },
      payer: {
        openid: user.openid
      }
    })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = nonce()
    const response = await this.fetchImpl(`${WECHAT_PAY_API_BASE}${JSAPI_PREPAY_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: this.buildAuthorization({ method: 'POST', path: JSAPI_PREPAY_PATH, body, timestamp, nonceStr }),
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body
    })
    const text = await response.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text }
      }
    }
    if (!response.ok || !data.prepay_id) {
      throw httpError(data.message || data.raw || `WeChat Pay prepay failed: HTTP ${response.status}`, response.status || 502)
    }
    await this.orderService.attachPrepay(order.orderNo, { prepayId: data.prepay_id })
    return {
      prepayId: data.prepay_id,
      payment: this.buildRequestPaymentParams(data.prepay_id)
    }
  }

  async requestWechat({ method = 'GET', path, body = '' }) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = nonce()
    const response = await this.fetchImpl(`${WECHAT_PAY_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: this.buildAuthorization({ method, path, body, timestamp, nonceStr }),
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body } : {})
    })
    const text = await response.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text }
      }
    }
    if (!response.ok) {
      throw httpError(data.message || data.raw || `WeChat Pay request failed: HTTP ${response.status}`, response.status || 502)
    }
    return data
  }

  async queryByOutTradeNo(orderNo) {
    this.assertPrepayConfig()
    const encodedOrderNo = encodeURIComponent(String(orderNo || ''))
    const query = new URLSearchParams({ mchid: this.env.wechatPayMchId }).toString()
    return this.requestWechat({
      method: 'GET',
      path: `${OUT_TRADE_NO_QUERY_PATH}/${encodedOrderNo}?${query}`
    })
  }

  async refreshOrder(orderNo) {
    const transaction = await this.queryByOutTradeNo(orderNo)
    if (transaction.trade_state !== 'SUCCESS') {
      return { order: await this.orderService.db.findOrderByOrderNo(orderNo), transaction, fulfilled: false }
    }
    const result = await this.markPaidFromTransaction(transaction, { refreshedFromQuery: true })
    return { ...result, transaction }
  }

  async markPaidFromTransaction(transaction, { refreshedFromQuery = false } = {}) {
    if (transaction.appid !== this.env.wechatAppId || transaction.mchid !== this.env.wechatPayMchId) {
      throw httpError('WeChat Pay transaction appid/mchid mismatch', 400)
    }
    const order = await this.orderService.db.findOrderByOrderNo(transaction.out_trade_no)
    if (!order) throw httpError('order not found', 404)
    const user = await this.orderService.db.findUserById(order.userId)
    if (!user) throw httpError('order user not found', 404)
    const paidAmount = Number(transaction.amount?.total)
    if (paidAmount !== Number(order.amountCents)) {
      throw httpError(`WeChat Pay amount mismatch: order ${order.amountCents}, paid ${paidAmount}`, 400)
    }
    const payerOpenid = String(transaction.payer?.openid || '')
    if (!payerOpenid || payerOpenid !== user.openid) {
      throw httpError('WeChat Pay payer openid mismatch', 400)
    }
    return this.orderService.markPaid(transaction.out_trade_no, {
      channel: 'wechat_pay',
      transactionId: transaction.transaction_id,
      paidAt: transaction.success_time,
      notifyPayload: {
        tradeType: transaction.trade_type,
        bankType: transaction.bank_type,
        payerOpenid,
        amount: transaction.amount || null,
        refreshedFromQuery
      }
    })
  }

  verifyNotifySignature({ headers, rawBody }) {
    if (this.env.wechatPaySkipNotifySignature) return true
    this.assertNotifyConfig()
    const signature = getHeader(headers, 'wechatpay-signature')
    if (String(signature).startsWith('WECHATPAY/SIGNTEST/')) return false
    const timestamp = getHeader(headers, 'wechatpay-timestamp')
    const nonceStr = getHeader(headers, 'wechatpay-nonce')
    const message = `${timestamp}\n${nonceStr}\n${rawBody}\n`
    return crypto.createVerify('RSA-SHA256')
      .update(message)
      .verify(this.env.wechatPayPlatformCert, signature, 'base64')
  }

  decryptNotifyResource(resource = {}) {
    if (resource.algorithm !== 'AEAD_AES_256_GCM') throw httpError(`unsupported notify algorithm: ${resource.algorithm}`, 400)
    const decrypted = decryptAes256Gcm({
      apiV3Key: this.env.wechatPayApiV3Key,
      ciphertext: resource.ciphertext,
      nonce: resource.nonce,
      associatedData: resource.associated_data || ''
    })
    return JSON.parse(decrypted)
  }

  async handleNotify({ headers, body, rawBody }) {
    if (!this.verifyNotifySignature({ headers, rawBody })) throw httpError('WeChat Pay notify signature verification failed', 400)
    if (body?.event_type !== 'TRANSACTION.SUCCESS') {
      return { ignored: true, eventType: body?.event_type || '' }
    }
    const transaction = this.decryptNotifyResource(body.resource)
    if (transaction.appid !== this.env.wechatAppId || transaction.mchid !== this.env.wechatPayMchId) {
      throw httpError('WeChat Pay notify appid/mchid mismatch', 400)
    }
    if (transaction.trade_state !== 'SUCCESS') {
      return { ignored: true, tradeState: transaction.trade_state || '' }
    }
    const result = await this.markPaidFromTransaction(transaction)
    return { ...result, transaction }
  }

  async markSuccess() {
    throw httpError('Real WeChat Pay orders must be fulfilled by verified payment notify', 400)
  }
}
