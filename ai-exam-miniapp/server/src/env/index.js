import path from 'path'

export function loadEnv({ root, port = 8787 } = {}) {
  const resolvedPort = Number(process.env.PORT || port)
  const configuredDbPath = process.env.LOCAL_DB_PATH || path.join(root, '.data', 'dev-db.json')
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: resolvedPort,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${resolvedPort}`,
    dbProvider: process.env.DB_PROVIDER || 'local',
    fileProvider: process.env.FILE_PROVIDER || 'local',
    paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
    generationJobConcurrency: Number(process.env.GENERATION_JOB_CONCURRENCY || 3),
    generationJobTimeoutMs: Number(process.env.GENERATION_JOB_TIMEOUT_MS || 10 * 60 * 1000),
    authSecret: process.env.AUTH_SECRET || 'printersheet-local-dev-secret',
    localDbPath: path.isAbsolute(configuredDbPath) ? configuredDbPath : path.resolve(root, configuredDbPath),
    cloudbaseEnvId: process.env.CLOUDBASE_ENV_ID || 'aiassistant-0517-d6en8tw82f2f7fc'
  }
}
