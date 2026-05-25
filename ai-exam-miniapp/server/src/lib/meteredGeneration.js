import fs from 'fs/promises'
import path from 'path'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { PDFParse } from 'pdf-parse'
import { getGenerationPointCost, isPageMeteredMode, normalizeGenerationMode } from './billing.js'

export const MAX_METERED_PAGES = 6
export const TEXT_CHARS_PER_PAGE = 800
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function clampPositiveInt(value, fallback = 1) {
  const number = Math.ceil(Number(value || 0))
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function effectiveExtension(file, meta = {}) {
  const candidates = [
    meta.fileName,
    meta.originalName,
    file?.originalname,
    file?.filename
  ]
  for (const item of candidates) {
    const ext = path.extname(String(item || '')).toLowerCase()
    if (ext) return ext
  }
  const fileType = String(meta.fileType || '').toLowerCase()
  const mime = String(file?.mimetype || '').toLowerCase()
  if (meta.fileExtension) return `.${String(meta.fileExtension).replace(/^\./, '').toLowerCase()}`
  if (fileType.includes('pdf') || mime.includes('pdf')) return '.pdf'
  if (fileType.includes('word') || mime.includes('wordprocessingml')) return '.docx'
  if (fileType.includes('图片') || mime.includes('png')) return '.png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mime.includes('webp')) return '.webp'
  return ''
}

function pagesFromText(text = '') {
  const length = String(text || '').trim().length
  if (!length) return 1
  return Math.min(MAX_METERED_PAGES + 1, clampPositiveInt(length / TEXT_CHARS_PER_PAGE))
}

async function pagesFromDocxMetadata(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const appXml = await zip.file('docProps/app.xml')?.async('string')
    const pages = Number(String(appXml || '').match(/<Pages>(\d+)<\/Pages>/i)?.[1] || 0)
    return Number.isFinite(pages) && pages > 0 ? Math.ceil(pages) : 0
  } catch {
    return 0
  }
}

function wordParseError(message = 'Word 文件无法识别。请上传 .docx 格式的 Word 文档，或先用 Word/WPS 另存为 .docx 后重试。') {
  const error = new Error(message)
  error.statusCode = 400
  error.code = 'WORD_PARSE_FAILED'
  return error
}

export function meteredPointsForPages(pageCount) {
  return clampPositiveInt(pageCount) * 2
}

export function isMeteredMode(mode = '') {
  return isPageMeteredMode(mode)
}

export function resolvePointCost({ mode = '', estimatedPages = 1 } = {}) {
  return isMeteredMode(mode)
    ? meteredPointsForPages(estimatedPages)
    : getGenerationPointCost(normalizeGenerationMode(mode))
}

export function validateMeteredPages({ mode = '', estimatedPages = 1 } = {}) {
  const normalizedMode = normalizeGenerationMode(mode)
  const pageCount = clampPositiveInt(estimatedPages)
  if (isMeteredMode(normalizedMode) && pageCount > MAX_METERED_PAGES) {
    const error = new Error(`资料超过 ${MAX_METERED_PAGES} 页。为了保证完整出题，请拆分为 ${MAX_METERED_PAGES} 页以内后再上传。`)
    error.statusCode = 400
    error.code = 'METERED_PAGE_LIMIT_EXCEEDED'
    error.estimatedPages = pageCount
    error.maxPages = MAX_METERED_PAGES
    throw error
  }
  return { mode: normalizedMode, estimatedPages: pageCount, pointsRequired: resolvePointCost({ mode: normalizedMode, estimatedPages: pageCount }) }
}

export async function estimateUploadedPages(file, meta = {}, prompt = '') {
  if (!file) {
    return {
      estimatedPages: pagesFromText(prompt),
      source: 'text',
      confidence: 'estimated',
      textLength: String(prompt || '').trim().length
    }
  }

  const ext = effectiveExtension(file, meta)
  if (IMAGE_EXTENSIONS.has(ext)) {
    return { estimatedPages: 1, source: 'image', confidence: 'fixed' }
  }

  const buffer = await fs.readFile(file.path)
  if (ext === '.pdf') {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getInfo()
      const pages = Number(result?.total || result?.pages || result?.numPages || result?.metadata?.Pages || 0)
      if (Number.isFinite(pages) && pages > 0) {
        return { estimatedPages: Math.ceil(pages), source: 'pdf', confidence: 'exact' }
      }
    } finally {
      await parser.destroy()
    }
    return { estimatedPages: 1, source: 'pdf', confidence: 'estimated' }
  }

  if (ext === '.doc') {
    throw wordParseError('暂不支持 .doc 老版 Word 格式。请先用 Word/WPS 另存为 .docx 后再上传。')
  }

  if (ext === '.docx') {
    const metadataPages = await pagesFromDocxMetadata(buffer)
    if (metadataPages > 0) {
      return {
        estimatedPages: metadataPages,
        source: 'word',
        confidence: 'exact'
      }
    }
    let text = ''
    try {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value || ''
    } catch {
      throw wordParseError()
    }
    return {
      estimatedPages: pagesFromText(text),
      source: 'word',
      confidence: 'estimated',
      textLength: text.trim().length
    }
  }

  return {
    estimatedPages: pagesFromText(prompt),
    source: 'unknown',
    confidence: 'estimated',
    textLength: String(prompt || '').trim().length
  }
}

export async function estimateGenerationCharge({ mode = '', prompt = '', file = null, meta = {} } = {}) {
  const normalizedMode = normalizeGenerationMode(mode)
  const pageEstimate = isMeteredMode(normalizedMode)
    ? await estimateUploadedPages(file, meta, prompt)
    : { estimatedPages: 1, source: file ? 'file' : 'text', confidence: 'fixed' }
  const validation = validateMeteredPages({ mode: normalizedMode, estimatedPages: pageEstimate.estimatedPages })
  return {
    ...validation,
    ...pageEstimate,
    maxPages: MAX_METERED_PAGES,
    metered: isMeteredMode(normalizedMode)
  }
}
