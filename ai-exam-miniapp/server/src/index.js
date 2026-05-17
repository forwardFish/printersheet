import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import { parseUploadedFile } from './lib/parseFile.js'
import { generateWorksheetWithAI } from './lib/ai.js'
import { listAiProviders, resolveAiProvider } from './lib/aiProviders.js'
import { buildPdf } from './lib/buildPdf.js'
import { buildDocx } from './lib/buildDocx.js'
import { assertValidWorksheet, normalizeWorksheet, pointsFor } from './lib/worksheet.js'
import { createMockPurchase, getPlansByBilling } from './lib/plans.js'
import { estimateGeneration } from './lib/billing.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const filesDir = path.join(root, 'files')
const uploadsDir = path.join(root, 'uploads')
fs.mkdirSync(filesDir, { recursive: true })
fs.mkdirSync(uploadsDir, { recursive: true })

const PORT = Number(process.env.PORT || 8787)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`
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

async function handleGenerate(req, res) {
  const startedAt = Date.now()
  const requestId = uuid()
  try {
    const prompt = String(req.body.prompt || '')
    const mode = String(req.body.mode || '')
    const grade = String(req.body.grade || '')
    const subject = String(req.body.subject || '')
    const difficulty = String(req.body.difficulty || '')
    const questionCount = Number(req.body.questionCount || 0)
    const fileMeta = {
      fileName: req.body.fileName,
      fileType: req.body.fileType,
      fileExtension: req.body.fileExtension
    }
    console.log(`[generate:${requestId}] start file=${req.file ? (req.body.fileName || req.file.originalname) : 'none'} size=${req.file?.size || 0} questions=${questionCount}`)
    const parseStartedAt = Date.now()
    const fileText = await parseUploadedFile(req.file, fileMeta)
    console.log(`[generate:${requestId}] parsed status=${req.file ? parserStatusFor(req.file, fileText, fileMeta) : 'none'} textLength=${fileText.length} ms=${Date.now() - parseStartedAt}`)
    const sourceFileInfo = req.file
      ? {
        name: req.body.fileName || req.file.originalname,
        type: req.body.fileType || req.file.mimetype,
        size: req.file.size,
        parsedTextLength: fileText.length,
        parserStatus: parserStatusFor(req.file, fileText, fileMeta),
        parserMessage: parserStatusFor(req.file, fileText, fileMeta) === 'placeholder'
          ? '当前文件使用占位解析/降级提示进入生成流程。'
          : '后端已提取到可用文本。'
      }
      : null
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
    const fileStartedAt = Date.now()
    const urls = await createFiles(worksheet, id)
    console.log(`[generate:${requestId}] files ms=${Date.now() - fileStartedAt} totalMs=${Date.now() - startedAt}`)
    res.json({
      success: true,
      worksheetId: id,
      worksheet,
      source: generated.source,
      fallbackReason: generated.fallbackReason,
      pointsUsed,
      cost: { pointsUsed, ocrPages: 0 },
      ...urls
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, message: e.message || '生成失败' })
  }
}

async function handleExportPdf(req, res) {
  try {
    const id = uuid()
    const outputPath = path.join(filesDir, `${id}.pdf`)
    const worksheet = assertValidWorksheet(normalizeWorksheet(req.body.worksheet))
    await buildPdf({ worksheet, outputPath, watermark: worksheet.mode === 'exam_simulation' ? false : req.body.watermark !== false })
    if (wantsUrl(req)) {
      res.json({ success: true, pdfUrl: `${PUBLIC_BASE_URL}/files/${id}.pdf` })
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
  const config = resolveAiProvider()
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
  app.get('/health', (_, res) => res.json({ ok: true }))
  app.post('/api/worksheet/generate', uploadSingleFile, handleGenerate)
  app.post('/api/generate', uploadSingleFile, handleGenerate)
  app.post('/api/export/pdf', handleExportPdf)
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
    if (process.env.AI_MOCK_MODE) {
      console.log('AI_MOCK_MODE 已开启：当前强制使用内置模拟出题数据。')
    } else if (!(process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY)) {
      console.log('未配置 DEEPSEEK_API_KEY 或 AI_API_KEY：真实生成接口会报错，不再静默返回 demo 题。')
    } else {
      const ai = resolveAiProvider()
      console.log(`真实 AI 出题已启用：${ai.providerLabel}/${ai.model} @ ${ai.baseUrl}`)
    }
  })
}
