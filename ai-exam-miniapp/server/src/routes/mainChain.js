import fs from 'fs/promises'
import { estimateGenerationCharge } from '../lib/meteredGeneration.js'

export function registerMainChainRoutes({ app, uploadSingleFile, auth, authService, entitlementService, orderService, rewardService, paymentProvider, worksheetService, generationJobService, fileAdapter }) {
  app.post('/api/auth/wechat-login', async (req, res) => {
    try {
      const result = await authService.login(req.body || {})
      res.json({ success: true, ...result, me: { ...result.user, ...await entitlementService.getEntitlements(result.user.id) } })
    } catch (error) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/me', auth, async (req, res) => {
    res.json({ success: true, user: req.user, ...await entitlementService.getEntitlements(req.user.id) })
  })

  app.post('/api/me/profile', auth, async (req, res) => {
    try {
      const user = await authService.updateProfile(req.user.id, req.body || {})
      res.json({ success: true, user, ...await entitlementService.getEntitlements(user.id) })
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message })
    }
  })

  app.get('/api/points', auth, async (req, res) => {
    const entitlements = await entitlementService.getEntitlements(req.user.id)
    res.json({ success: true, pointsBalance: entitlements.pointsBalance })
  })

  app.post('/api/rewards/daily-share', auth, async (req, res) => {
    try {
      const result = await rewardService.claimDailyShareReward({
        userId: req.user.id,
        channel: req.body?.channel || 'timeline'
      })
      res.json(result)
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message })
    }
  })

  app.get('/api/products', (_, res) => {
    res.json({ success: true, products: orderService.listProducts() })
  })

  app.post('/api/orders/create', auth, async (req, res) => {
    try {
      const order = await orderService.createOrder({ userId: req.user.id, productCode: req.body.productCode || req.body.planId })
      if (paymentProvider.isRealPaymentEnabled?.()) {
        const prepay = await paymentProvider.createPrepay({ order, user: req.user })
        res.json({ success: true, order, paymentProvider: 'wechat', ...prepay })
        return
      }
      res.json({ success: true, order, paymentProvider: 'mock' })
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message })
    }
  })

  app.post('/api/dev/pay/mock-success', auth, async (req, res) => {
    try {
      const result = await paymentProvider.markSuccess(req.body.orderNo)
      res.json({ success: true, ...result, pointsBalance: (await entitlementService.getEntitlements(req.user.id)).pointsBalance })
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message })
    }
  })

  app.post('/api/orders/:orderNo/refresh', auth, async (req, res) => {
    try {
      const orderNo = req.params.orderNo
      const order = await orderService.findUserOrder({ userId: req.user.id, orderNo })
      if (!order) {
        res.status(404).json({ success: false, message: 'order not found' })
        return
      }
      const result = paymentProvider.refreshOrder
        ? await paymentProvider.refreshOrder(orderNo)
        : { order, fulfilled: false, transaction: null }
      res.json({
        success: true,
        ...result,
        pointsBalance: (await entitlementService.getEntitlements(req.user.id)).pointsBalance
      })
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message })
    }
  })

  app.post('/api/pay/notify', async (req, res) => {
    try {
      if (paymentProvider.handleNotify) {
        await paymentProvider.handleNotify({ headers: req.headers, body: req.body, rawBody: req.rawBody || JSON.stringify(req.body || {}) })
        res.status(204).end()
        return
      }
      const result = await paymentProvider.markSuccess(req.body.orderNo)
      res.json({ success: true, ...result })
    } catch (error) {
      res.status(error.statusCode || 400).json({ code: 'FAIL', message: error.message })
    }
  })

  app.get('/api/orders', auth, async (req, res) => {
    res.json({ success: true, orders: await orderService.db.listUserOrders(req.user.id) })
  })

  app.post('/api/worksheets/generate', auth, uploadSingleFile, async (req, res) => {
    try {
      const result = await worksheetService.generate({ user: req.user, body: req.body, file: req.file })
      res.json(result)
    } catch (error) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
  })

  app.post('/api/generation/estimate', auth, uploadSingleFile, async (req, res) => {
    try {
      const charge = await estimateGenerationCharge({
        mode: req.body?.mode || '',
        prompt: req.body?.prompt || '',
        file: req.file || null,
        meta: {
          fileName: req.body?.fileName,
          fileType: req.body?.fileType,
          fileExtension: req.body?.fileExtension
        }
      })
      res.json({ success: true, ...charge })
    } catch (error) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        code: error.code || '',
        estimatedPages: error.estimatedPages,
        maxPages: error.maxPages
      })
    } finally {
      if (req.file?.path) fs.unlink(req.file.path).catch(() => {})
    }
  })

  app.post('/api/generation-jobs', auth, async (req, res) => {
    try {
      const job = await generationJobService.createJob({ user: req.user, body: req.body || {} })
      res.status(job.status === 'succeeded' ? 200 : 202).json({ success: true, job })
    } catch (error) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message })
    }
  })

  app.get('/api/generation-jobs', auth, async (req, res) => {
    const jobs = await generationJobService.listUserJobs({ user: req.user, status: String(req.query.status || '') })
    res.json({ success: true, jobs })
  })

  app.get('/api/generation-jobs/:id', auth, async (req, res) => {
    const job = await generationJobService.getUserJob({ user: req.user, jobId: req.params.id })
    if (!job) {
      res.status(404).json({ success: false, message: 'generation job not found' })
      return
    }
    res.json({ success: true, job })
  })

  app.get('/api/worksheets', auth, async (req, res) => {
    res.json({ success: true, records: await worksheetService.db.listUserWorksheets(req.user.id) })
  })

  app.get('/api/worksheets/:id', auth, async (req, res) => {
    const record = await worksheetService.db.findWorksheetById(req.params.id)
    if (!record || record.userId !== req.user.id) {
      res.status(404).json({ success: false, message: 'worksheet not found' })
      return
    }
    res.json({ success: true, record, worksheet: record.worksheet })
  })

  app.get('/api/worksheets/:id/download', auth, async (req, res) => {
    const record = await worksheetService.db.findWorksheetById(req.params.id)
    if (!record || record.userId !== req.user.id) {
      res.status(404).json({ success: false, message: 'worksheet not found' })
      return
    }
    const type = req.query.type === 'word' ? 'word' : 'pdf'
    const fileId = type === 'word' ? record.wordFileId : record.pdfFileId
    const file = await worksheetService.db.findFileById(fileId)
    if (!file || file.userId !== req.user.id) {
      res.status(404).json({ success: false, message: 'file not found' })
      return
    }
    if (type === 'word' && !(await entitlementService.getEntitlements(req.user.id)).canDownloadWord) {
      res.status(403).json({ success: false, message: 'word download requires Pro or Teacher' })
      return
    }
    res.download(await fileAdapter.downloadFile(file), file.originalName)
  })

  app.post('/api/files/upload', auth, uploadSingleFile, async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'file is required' })
        return
      }
      const file = await fileAdapter.registerUpload({ file: req.file, userId: req.user.id })
      res.json({ success: true, file })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })
}
