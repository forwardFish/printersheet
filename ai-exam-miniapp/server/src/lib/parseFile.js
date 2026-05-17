import fs from 'fs/promises'
import path from 'path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

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

export async function parseUploadedFile(file, meta = {}) {
  if (!file) return ''
  const ext = effectiveExtension(file, meta)
  const buffer = await fs.readFile(file.path)
  try {
    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ''
    }
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText().finally(() => parser.destroy())
      const text = (result.text || '').trim()
      if (!text) return '[用户上传了 PDF，但未提取到可用文本；可能是扫描件。本 MVP 暂未启用 OCR，请结合输入要求生成同类练习。]'
      return text
    }
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return '[用户上传了图片。当前 MVP 未启用 OCR，请结合输入框描述图片内容；图片 OCR 属于后续增强能力。]'
    }
    throw new Error('仅支持 PDF、Word、PNG、JPG、JPEG、WEBP 文件。')
  } finally {
    fs.unlink(file.path).catch(() => {})
  }
}
