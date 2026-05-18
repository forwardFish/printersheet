import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { parseUploadedFile } from './lib/parseFile.js'
import { aiRuntimeConfig, generateWorksheetWithAI } from './lib/ai.js'
import { listAiProviders } from './lib/aiProviders.js'
import { buildPdf } from './lib/buildPdf.js'
import { buildDocx } from './lib/buildDocx.js'
import { assertValidWorksheet, normalizeWorksheet, pointsFor } from './lib/worksheet.js'
import { createMockPurchase, getPlansByBilling } from './lib/plans.js'
import { estimateGeneration } from './lib/billing.js'
import { loadEnv } from './env/index.js'
import { createMainChain } from './app/createMainChain.js'
import { requireAuth } from './middleware/auth.js'
import { registerMainChainRoutes } from './routes/mainChain.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const env = loadEnv({ root })
const filesDir = path.join(root, 'files')
const uploadsDir = path.join(root, 'uploads')
fs.mkdirSync(filesDir, { recursive: true })
fs.mkdirSync(uploadsDir, { recursive: true })
const generationJobs = new Map()

const PORT = env.port
const PUBLIC_BASE_URL = env.publicBaseUrl
const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp'])

function uploadExtension(file) {
  return path.extname(file.originalname || '').toLowerCase()
}

function parserStatusFor(file, fileText, meta = {}) {
  if (!file) return null
  const ext = uploadExtension(file) || (meta.fileExtension ? `.${String(meta.fileExtension).replace(/^\./, '').toLowerCase()}` : '')
  const fileType = String(meta.fileType || '').toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'placeholder'
  if (fileType.includes('图片')) return 'placeholder'
  if ((fileText || '').includes('未启用 OCR') || (fileText || '').includes('暂未启用 OCR')) return 'placeholder'
  return fileText ? 'parsed' : 'placeholder'
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = uploadExtension(file)
    if (!ext || SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) cb(null, true)
    else cb(new Error('仅支持 PDF、Word、PNG、JPG、JPEG、WEBP 文件。'))
  }
})

function uploadSingleFile(req, res, next) {
  upload.single('file')(req, res, err => {
    if (!err) {
      next()
      return
    }
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? '文件不能超过 10MB，请压缩后再上传。'
      : err.message
    res.status(400).json({ success: false, message })
  })
}

async function createFiles(worksheet, id) {
  const pdfPath = path.join(filesDir, `${id}.pdf`)
  const docxPath = path.join(filesDir, `${id}.docx`)
  await buildPdf({ worksheet, outputPath: pdfPath, watermark: worksheet.mode !== 'exam_simulation' })
  await buildDocx({ worksheet, outputPath: docxPath })
  return {
    pdfUrl: `${PUBLIC_BASE_URL}/files/${id}.pdf`,
    wordUrl: `${PUBLIC_BASE_URL}/files/${id}.docx`
  }
}

function wantsUrl(req) {
  return req.query.returnUrl === '1' || req.query.returnUrl === 'true' || req.get('accept')?.includes('application/json')
}

function wantsAsync(req) {
  return req.query.async === '1' || req.query.async === 'true' || req.body.async === true || req.body.async === '1' || req.body.async === 'true'
}

function publicJob(job) {
  if (!job) return null
  return {
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt || null,
    result: job.result || null,
    error: job.error || null
  }
}

function updateJob(jobId, patch) {
  const job = generationJobs.get(jobId)
  if (!job) return null
  Object.assign(job, patch, { updatedAt: new Date().toISOString() })
  generationJobs.set(jobId, job)
  return job
}

async function runGenerate({ body, file, requestId, startedAt = Date.now(), onProgress = () => {} }) {
  const prompt = String(body.prompt || '')
  const mode = String(body.mode || '')
  const grade = String(body.grade || '')
  const subject = String(body.subject || '')
  const difficulty = String(body.difficulty || '')
  const questionCount = Number(body.questionCount || 0)
  const fileMeta = {
    fileName: body.fileName,
    fileType: body.fileType,
    fileExtension: body.fileExtension
  }
  console.log(`[generate:${requestId}] start file=${file ? (body.fileName || file.originalname) : 'none'} size=${file?.size || 0} questions=${questionCount}`)
  onProgress({ status: 'running', progress: 10, message: '正在解析上传资料...' })
  const parseStartedAt = Date.now()
  const fileText = await parseUploadedFile(file, fileMeta)
  console.log(`[generate:${requestId}] parsed status=${file ? parserStatusFor(file, fileText, fileMeta) : 'none'} textLength=${fileText.length} ms=${Date.now() - parseStartedAt}`)
  const sourceFileInfo = file
    ? {
      name: body.fileName || file.originalname,
      type: body.fileType || file.mimetype,
      size: file.size,
      parsedTextLength: fileText.length,
      parserStatus: parserStatusFor(file, fileText, fileMeta),
      parserMessage: parserStatusFor(file, fileText, fileMeta) === 'placeholder'
        ? '当前文件使用占位解析/降级提示进入生成流程。'
        : '后端已提取到可用文本。'
    }
    : null
  onProgress({ status: 'running', progress: 30, message: 'AI 正在生成练习卷，请稍候...' })
  const aiStartedAt = Date.now()
  const generated = await generateWorksheetWithAI({ prompt, fileText, grade, subject, difficulty, mode, questionCount })
  console.log(`[generate:${requestId}] ai source=${generated.source} questions=${generated.worksheet?.questions?.length || 0} ms=${Date.now() - aiStartedAt}`)
  const id = uuid()
  const pointsUsed = pointsFor({ prompt, mode, questionCount, worksheet: generated.worksheet })
  const worksheet = assertValidWorksheet(normalizeWorksheet(generated.worksheet, {
    sourceFileInfo,
    pointsUsed,
    ocrPages: 0
  }))
  onProgress({ status: 'running', progress: 82, message: '正在排版 PDF 和 Word 文件...' })
  const fileStartedAt = Date.now()
  const urls = await createFiles(worksheet, id)
  console.log(`[generate:${requestId}] files ms=${Date.now() - fileStartedAt} totalMs=${Date.now() - startedAt}`)
  return {
    success: true,
    worksheetId: id,
    worksheet,
    source: generated.source,
    fallbackReason: generated.fallbackReason,
    pointsUsed,
    cost: { pointsUsed, ocrPages: 0 },
    ...urls
  }
}

async function handleGenerate(req, res) {
  const startedAt = Date.now()
  const requestId = uuid()
  if (wantsAsync(req)) {
    const jobId = uuid()
    const now = new Date().toISOString()
    const job = {
      jobId,
      status: 'queued',
      progress: 0,
      message: '生成任务已创建，正在排队...',
      createdAt: now,
      updatedAt: now,
      requestId,
      result: null,
      error: null
    }
    generationJobs.set(jobId, job)
    setImmediate(async () => {
      try {
        updateJob(jobId, { status: 'running', progress: 5, message: '正在启动生成任务...' })
        const result = await runGenerate({
          body: { ...req.body },
          file: req.file ? { ...req.file } : null,
          requestId,
          startedAt,
          onProgress: patch => updateJob(jobId, patch)
        })
        updateJob(jobId, {
          status: 'succeeded',
          progress: 100,
          message: '练习卷已生成，可预览和下载。',
          finishedAt: new Date().toISOString(),
          result
        })
      } catch (e) {
        console.error(e)
        updateJob(jobId, {
          status: 'failed',
          progress: 100,
          message: e.message || '生成失败',
          finishedAt: new Date().toISOString(),
          error: { message: e.message || '生成失败' }
        })
      }
    })
    res.status(202).json({ success: true, async: true, ...publicJob(job) })
    return
  }
  try {
    const result = await runGenerate({ body: req.body, file: req.file, requestId, startedAt })
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, message: e.message || '生成失败' })
  }
}

function handleGenerationJob(req, res) {
  const job = publicJob(generationJobs.get(req.params.jobId))
  if (!job) {
    res.status(404).json({ success: false, message: '生成任务不存在或已过期' })
    return
  }
  res.json({ success: true, ...job })
}
async function getRequestEntitlements(req, { authService, entitlementService } = {}) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const user = token && authService ? await authService.verifyToken(token) : null
  if (user && entitlementService) return entitlementService.getEntitlements(user.id)

  const planCode = String(req.get('x-plan-code') || 'free')
  const planExpiresAt = req.get('x-plan-expires-at') || null
  const isPaid = planCode !== 'free' && planExpiresAt && new Date(planExpiresAt).getTime() > Date.now()
  return {
    planCode,
    isPaid: !!isPaid,
    canRemoveWatermark: !!isPaid,
    canDownloadWord: !!isPaid && ['pro', 'teacher'].includes(planCode)
  }
}

async function handleExportPdf(req, res, services = {}) {
  try {
    const id = uuid()
    const outputPath = path.join(filesDir, `${id}.pdf`)
    const worksheet = assertValidWorksheet(normalizeWorksheet(req.body.worksheet))
    const entitlements = await getRequestEntitlements(req, services)
    const watermark = worksheet.mode === 'exam_simulation' ? false : !entitlements.canRemoveWatermark
    await buildPdf({ worksheet, outputPath, watermark })
    if (wantsUrl(req)) {
      res.json({ success: true, pdfUrl: `${PUBLIC_BASE_URL}/files/${id}.pdf`, watermark })
      return
    }
    res.download(outputPath, `${id}.pdf`)
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
}

async function handleExportDocx(req, res) {
  try {
    const id = uuid()
    const outputPath = path.join(filesDir, `${id}.docx`)
    const worksheet = assertValidWorksheet(normalizeWorksheet(req.body.worksheet))
    await buildDocx({ worksheet, outputPath })
    if (wantsUrl(req)) {
      res.json({ success: true, wordUrl: `${PUBLIC_BASE_URL}/files/${id}.docx` })
      return
    }
    res.download(outputPath, `${id}.docx`)
  } catch (e) { res.status(500).json({ success: false, message: e.message }) }
}

function handlePlans(_, res) {
  res.json({ success: true, plans: getPlansByBilling() })
}

function handleMe(req, res) {
  const planCode = String(req.get('x-plan-code') || 'free')
  const planExpiresAt = req.get('x-plan-expires-at') || null
  const pointsBalance = Number(req.get('x-points-balance') || 3)
  const isPaid = planCode !== 'free' && planExpiresAt && new Date(planExpiresAt).getTime() > Date.now()
  res.json({
    userId: req.get('x-user-id') || 'mock-user',
    openid: req.get('x-openid') || 'mock-openid',
    planCode,
    planExpiresAt,
    pointsBalance,
    isPaid: !!isPaid,
    canDownloadWord: !!isPaid && ['pro', 'teacher'].includes(planCode),
    canRemoveWatermark: !!isPaid
  })
}

function handleEstimate(req, res) {
  res.json(estimateGeneration({
    mode: req.body.mode,
    pointsBalance: req.body.pointsBalance ?? req.get('x-points-balance') ?? 0
  }))
}

function handleAiConfig(_, res) {
  const config = aiRuntimeConfig()
  res.json({
    success: true,
    active: {
      providerId: config.providerId,
      providerLabel: config.providerLabel,
      baseUrl: config.baseUrl,
      model: config.model,
      hasApiKey: !!config.apiKey
    },
    providers: listAiProviders().map(provider => ({
      id: provider.id,
      label: provider.label,
      defaultBaseUrl: provider.baseUrl,
      defaultModel: provider.model,
      apiKeyEnv: provider.apiKeyEnv
    }))
  })
}

function handleMockPurchase(req, res) {
  try {
    res.json(createMockPurchase(String(req.body.productCode || req.body.planId || '')))
  } catch (e) {
    res.status(400).json({ success: false, message: e.message })
  }
}

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use('/files', express.static(filesDir, { maxAge: '30m' }))
  const mainChain = createMainChain({ env: loadEnv({ root }), filesDir, uploadsDir })
  registerMainChainRoutes({
    app,
    uploadSingleFile,
    auth: requireAuth(mainChain.authService),
    ...mainChain
  })
  app.get('/health', (_, res) => res.json({ ok: true }))
  app.post('/api/worksheet/generate', uploadSingleFile, handleGenerate)
  app.post('/api/generate', uploadSingleFile, handleGenerate)
  app.get('/api/worksheet/jobs/:jobId', handleGenerationJob)
  app.post('/api/export/pdf', (req, res) => handleExportPdf(req, res, mainChain))
  app.post('/api/export/docx', handleExportDocx)
  app.get('/api/me', handleMe)
  app.post('/api/generation/estimate', handleEstimate)
  app.get('/api/plans', handlePlans)
  app.get('/api/ai/config', handleAiConfig)
  app.post('/api/purchases/mock', handleMockPurchase)
  return app
}

export function cleanExpiredFiles({ maxAgeMs = 30 * 60 * 1000 } = {}) {
  const now = Date.now()
  for (const f of fs.readdirSync(filesDir)) {
    const p = path.join(filesDir, f)
    const st = fs.statSync(p)
    if (now - st.mtimeMs > maxAgeMs) fs.unlink(p, () => {})
  }
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp()
  setInterval(() => cleanExpiredFiles(), 10 * 60 * 1000)
  app.listen(PORT, () => {
    console.log(`AI出题小助手后端已启动：${PUBLIC_BASE_URL}`)
    const aiConfig = aiRuntimeConfig()
    if (aiConfig.mockMode) {
      console.log('AI_MOCK_MODE 已开启：当前强制使用内置模拟出题数据。')
    } else if (!aiConfig.apiKey) {
      console.log('未配置 DEEPSEEK_API_KEY 或 AI_API_KEY：真实生成接口会报错，不再静默返回 demo 题。')
    } else {
      console.log(`真实 AI 出题已启用：${aiConfig.providerLabel}/${aiConfig.model} @ ${aiConfig.baseUrl}`)
    }
  })
}
