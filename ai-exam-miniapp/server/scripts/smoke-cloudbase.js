process.env.DB_PROVIDER = 'cloudbase'
process.env.FILE_PROVIDER = 'cloudbase'
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'mock'
process.env.CLOUDBASE_ENV_ID = process.env.CLOUDBASE_ENV_ID || 'aiassistant-0517-d6en8tw82f2f7fc'

await import('./smoke-all.js')
