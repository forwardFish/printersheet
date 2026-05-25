import path from 'path'
import fs from 'fs'

function readSecretFile(filePath) {
  const resolved = String(filePath || '').trim()
  if (!resolved) return ''
  if (!fs.existsSync(path.resolve(resolved))) return ''
  return fs.readFileSync(path.resolve(resolved), 'utf8')
}

export function loadEnv({ root, port = 8787 } = {}) {
  const resolvedPort = Number(process.env.PORT || port)
  const configuredDbPath = process.env.LOCAL_DB_PATH || path.join(root, '.data', 'dev-db.json')
  const privateKey = process.env.WECHAT_PAY_PRIVATE_KEY || readSecretFile(process.env.WECHAT_PAY_PRIVATE_KEY_PATH)
  const merchantCert = process.env.WECHAT_PAY_MERCHANT_CERT || readSecretFile(process.env.WECHAT_PAY_MERCHANT_CERT_PATH)
  const platformCert = process.env.WECHAT_PAY_PLATFORM_CERT || readSecretFile(process.env.WECHAT_PAY_PLATFORM_CERT_PATH)
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: resolvedPort,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${resolvedPort}`,
    dbProvider: process.env.DB_PROVIDER || 'local',
    fileProvider: process.env.FILE_PROVIDER || 'local',
    paymentProvider: process.env.PAYMENT_PROVIDER || (process.env.NODE_ENV === 'test' ? 'mock' : 'wechat'),
    paymentTestMode: process.env.PAYMENT_TEST_MODE
      ? process.env.PAYMENT_TEST_MODE === 'true'
      : process.env.NODE_ENV !== 'production',
    wechatPayTestAmountCents: Math.max(1, Number(process.env.WECHAT_PAY_TEST_AMOUNT_CENTS || 1)),
    generationJobConcurrency: Number(process.env.GENERATION_JOB_CONCURRENCY || 3),
    generationJobTimeoutMs: Number(process.env.GENERATION_JOB_TIMEOUT_MS || 10 * 60 * 1000),
    authSecret: process.env.AUTH_SECRET || 'printersheet-local-dev-secret',
    localDbPath: path.isAbsolute(configuredDbPath) ? configuredDbPath : path.resolve(root, configuredDbPath),
    cloudbaseEnvId: process.env.CLOUDBASE_ENV_ID || 'aiassistant-0517-d6en8tw82f2f7fc',
    wechatAppId: process.env.WECHAT_APP_ID || '',
    wechatAppSecret: process.env.WECHAT_APP_SECRET || '',
    wechatPayMchId: process.env.WECHAT_PAY_MCH_ID || '',
    wechatPaySerialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
    wechatPayPrivateKey: privateKey,
    wechatPayMerchantCert: merchantCert,
    wechatPayApiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
    wechatPayPlatformCert: platformCert,
    wechatPayNotifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || `${process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${resolvedPort}`}/api/pay/notify`,
    wechatPayDescription: process.env.WECHAT_PAY_DESCRIPTION || 'AI出题小助手-点数套餐',
    wechatPaySkipNotifySignature: process.env.WECHAT_PAY_SKIP_NOTIFY_SIGNATURE === 'true' && process.env.NODE_ENV !== 'production'
  }
}
