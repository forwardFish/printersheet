import fs from 'fs/promises'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { buildPdf } from '../lib/buildPdf.js'
import { buildDocx } from '../lib/buildDocx.js'

export class LocalFileAdapter {
  constructor({ filesDir, uploadsDir, publicBaseUrl, db }) {
    this.filesDir = filesDir
    this.uploadsDir = uploadsDir
    this.publicBaseUrl = publicBaseUrl
    this.db = db
  }

  async ensureDirs() {
    await fs.mkdir(this.filesDir, { recursive: true })
    await fs.mkdir(this.uploadsDir, { recursive: true })
  }

  async createGeneratedFiles({ worksheet, userId, recordId, watermark }) {
    await this.ensureDirs()
    const pdfId = uuid()
    const wordId = uuid()
    const pdfPath = path.join(this.filesDir, `${pdfId}.pdf`)
    const wordPath = path.join(this.filesDir, `${wordId}.docx`)
    await buildPdf({ worksheet, outputPath: pdfPath, watermark })
    await buildDocx({ worksheet, outputPath: wordPath })
    const pdf = this.registerFile({
      id: pdfId,
      userId,
      recordId,
      type: 'pdf',
      mimeType: 'application/pdf',
      originalName: `${recordId}.pdf`,
      storagePath: pdfPath,
      size: (await fs.stat(pdfPath)).size
    })
    const word = this.registerFile({
      id: wordId,
      userId,
      recordId,
      type: 'word',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalName: `${recordId}.docx`,
      storagePath: wordPath,
      size: (await fs.stat(wordPath)).size
    })
    return {
      pdf,
      word,
      pdfUrl: `${this.publicBaseUrl}/api/worksheets/${recordId}/download?type=pdf`,
      wordUrl: `${this.publicBaseUrl}/api/worksheets/${recordId}/download?type=word`
    }
  }

  registerFile(record) {
    return this.db.create('file_objects', record)
  }

  async registerUpload({ file, userId }) {
    await this.ensureDirs()
    const ext = path.extname(file.originalname || '')
    const id = uuid()
    const target = path.join(this.uploadsDir, `${id}${ext}`)
    await fs.rename(file.path, target)
    return this.registerFile({
      id,
      userId,
      recordId: null,
      type: 'upload',
      mimeType: file.mimetype || 'application/octet-stream',
      originalName: file.originalname || `upload${ext}`,
      storagePath: target,
      size: file.size || 0
    })
  }

  async downloadFile(file) {
    return file.storagePath
  }
}
