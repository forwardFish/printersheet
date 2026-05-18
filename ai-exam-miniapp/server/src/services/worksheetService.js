import { v4 as uuid } from 'uuid'
import { parseUploadedFile } from '../lib/parseFile.js'
import { generateWorksheetWithAI } from '../lib/ai.js'
import { assertValidWorksheet, normalizeWorksheet, pointsFor } from '../lib/worksheet.js'

function parserStatusFor(file, fileText, meta = {}) {
  if (!file) return null
  const ext = String(meta.fileExtension || '').replace(/^\./, '').toLowerCase()
  const fileType = String(meta.fileType || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'placeholder'
  if (fileType.includes('image')) return 'placeholder'
  if ((fileText || '').includes('OCR')) return 'placeholder'
  return fileText ? 'parsed' : 'placeholder'
}

function generationTimeoutError() {
  const error = new Error('生成超时，请重新生成。')
  error.statusCode = 504
  error.code = 'GENERATION_TIMEOUT'
  return error
}

function withTimeout(promise, timeoutMs) {
  const timeout = Number(timeoutMs || 0)
  if (!Number.isFinite(timeout) || timeout <= 0) return promise
  let timer
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => reject(generationTimeoutError()), timeout)
  })
  return Promise.race([promise, timedOut]).finally(() => clearTimeout(timer))
}

export class WorksheetService {
  constructor({ db, fileAdapter, authService, entitlementService }) {
    this.db = db
    this.fileAdapter = fileAdapter
    this.authService = authService
    this.entitlementService = entitlementService
  }

  toResponse(record) {
    const pdfUrl = `/api/worksheets/${record.id}/download?type=pdf`
    const wordUrl = `/api/worksheets/${record.id}/download?type=word`
    return {
      success: true,
      worksheetId: record.id,
      record,
      worksheet: record.worksheet,
      pointsUsed: record.pointsUsed,
      cost: { pointsUsed: record.pointsUsed, ocrPages: 0 },
      pdfUrl,
      wordUrl
    }
  }

  async generate({ user, body, file, timeoutMs = 0 }) {
    const requestId = String(body.requestId || '').trim()
    if (!requestId) {
      const error = new Error('requestId is required')
      error.statusCode = 400
      throw error
    }
    const existing = await this.db.findWorksheetByRequestId(user.id, requestId)
    if (existing) return this.toResponse(existing)

    const prompt = String(body.prompt || '')
    const mode = String(body.mode || '')
    const grade = String(body.grade || '')
    const subject = String(body.subject || '')
    const difficulty = String(body.difficulty || '')
    const questionCount = Number(body.questionCount || 0)
    const pointCost = pointsFor({ prompt, mode, questionCount })
    const recordId = uuid()

    await this.authService.consumePoints({ userId: user.id, points: pointCost, source: 'worksheet_generate', refId: recordId, requestId })
    try {
      const fileMeta = { fileName: body.fileName, fileType: body.fileType, fileExtension: body.fileExtension }
      const fileText = await parseUploadedFile(file, fileMeta)
      const sourceFileInfo = file
        ? {
            name: body.fileName || file.originalname,
            type: body.fileType || file.mimetype,
            size: file.size,
            parsedTextLength: fileText.length,
            parserStatus: parserStatusFor(file, fileText, fileMeta)
          }
        : null
      const generated = await withTimeout(
        generateWorksheetWithAI({ prompt, fileText, grade, subject, difficulty, mode, questionCount }),
        timeoutMs
      )
      const pointsUsed = pointsFor({ prompt, mode, questionCount, worksheet: generated.worksheet })
      const worksheet = assertValidWorksheet(normalizeWorksheet(generated.worksheet, {
        sourceFileInfo,
        pointsUsed,
        ocrPages: 0
      }))
      const entitlements = await this.entitlementService.getEntitlements(user.id)
      const files = await this.fileAdapter.createGeneratedFiles({
        worksheet,
        userId: user.id,
        recordId,
        watermark: !entitlements.canRemoveWatermark
      })
      const record = await this.db.create('worksheet_records', {
        id: recordId,
        userId: user.id,
        requestId,
        title: worksheet.title || 'AI Worksheet',
        prompt,
        mode: worksheet.mode || mode,
        pointsUsed,
        status: 'succeeded',
        worksheet,
        pdfFileId: files.pdf.id,
        wordFileId: files.word.id,
        source: generated.source || '',
        fallbackReason: generated.fallbackReason || ''
      })
      return this.toResponse(record)
    } catch (error) {
      await this.authService.refundPoints({ userId: user.id, points: pointCost, source: 'worksheet_generate_failed', refId: recordId, requestId })
      throw error
    }
  }
}
