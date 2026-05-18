import { LocalDbAdapter } from '../adapters/localDb.js'
import { LocalFileAdapter } from '../adapters/localFile.js'
import { CloudBaseDbAdapter } from '../adapters/cloudbaseDb.js'
import { CloudBaseFileAdapter } from '../adapters/cloudbaseFile.js'
import { MockPaymentProvider, WechatPaymentProvider } from '../adapters/payment.js'
import { AuthService } from '../services/authService.js'
import { EntitlementService } from '../services/entitlementService.js'
import { OrderService } from '../services/orderService.js'
import { WorksheetService } from '../services/worksheetService.js'
import { GenerationJobService } from '../services/generationJobService.js'

export function createMainChain({ env, filesDir, uploadsDir }) {
  const db = env.dbProvider === 'cloudbase'
    ? new CloudBaseDbAdapter({ envId: env.cloudbaseEnvId })
    : new LocalDbAdapter(env.localDbPath)
  const authService = new AuthService({ db, env })
  const entitlementService = new EntitlementService({ db })
  const orderService = new OrderService({ db, authService })
  const fileAdapter = env.fileProvider === 'cloudbase'
    ? new CloudBaseFileAdapter({ envId: env.cloudbaseEnvId, filesDir, uploadsDir, db })
    : new LocalFileAdapter({ filesDir, uploadsDir, publicBaseUrl: env.publicBaseUrl, db })
  const worksheetService = new WorksheetService({ db, fileAdapter, authService, entitlementService })
  const generationJobService = new GenerationJobService({
    db,
    worksheetService,
    concurrency: env.generationJobConcurrency || 3,
    jobTimeoutMs: env.generationJobTimeoutMs
  })
  generationJobService.recoverInterruptedJobs().catch(error => console.error('[generation-jobs] recover failed', error))
  const paymentProvider = env.paymentProvider === 'mock'
    ? new MockPaymentProvider({ db, orderService })
    : new WechatPaymentProvider()
  return { db, authService, entitlementService, orderService, fileAdapter, worksheetService, generationJobService, paymentProvider }
}
