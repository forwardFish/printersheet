import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { buildPdf } from '../lib/buildPdf.js'
import { buildDocx } from '../lib/buildDocx.js'

export class CloudBaseFileAdapter {
  constructor({ envId, filesDir, uploadsDir, db }) {
    this.envId = envId
    this.filesDir = filesDir
    this.uploadsDir = uploadsDir
    this.db = db
    this.appPromise = null
  }

  async getApp() {
    if (!this.appPromise) {
      this.appPromise = import('@cloudbase/node-sdk').then(({ default: tcb }) => tcb.init({ env: this.envId }))
    }
    return this.appPromise
  }

  async ensureDirs() {
    await fsp.mkdir(this.filesDir, { recursive: true })
    await fsp.mkdir(this.uploadsDir, { recursive: true })
  }

  async uploadLocalFile({ localPath, cloudPath }) {
    const app = await this.getApp()
    const result = await app.uploadFile({
      cloudPath,
      fileContent: fs.createReadStream(localPath)
    })
    return result.fileID
  }

  async createGeneratedFiles({ worksheet, userId, recordId, watermark }) {
    await this.ensureDirs()
    const pdfId = uuid()
    const wordId = uuid()
    const pdfPath = path.join(this.filesDir, `${pdfId}.pdf`)
    const wordPath = path.join(this.filesDir, `${wordId}.docx`)
    await buildPdf({ worksheet, outputPath: pdfPath, watermark })
    await buildDocx({ worksheet, outputPath: wordPath })
    const pdfCloudPath = `worksheets/${userId}/${recordId}/${pdfId}.pdf`
    const wordCloudPath = `worksheets/${userId}/${recordId}/${wordId}.docx`
    const pdfFileId = await this.uploadLocalFile({ localPath: pdfPath, cloudPath: pdfCloudPath })
    const wordFileId = await this.uploadLocalFile({ localPath: wordPath, cloudPath: wordCloudPath })
    const pdf = await this.registerFile({
      id: pdfId,
      userId,
      recordId,
      type: 'pdf',
      mimeType: 'application/pdf',
      originalName: `${recordId}.pdf`,
      storagePath: pdfPath,
      cloudPath: pdfCloudPath,
      fileId: pdfFileId,
      size: (await fsp.stat(pdfPath)).size
    })
    const word = await this.registerFile({
      id: wordId,
      userId,
      recordId,
      type: 'word',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalName: `${recordId}.docx`,
      storagePath: wordPath,
      cloudPath: wordCloudPath,
      fileId: wordFileId,
      size: (await fsp.stat(wordPath)).size
    })
    return { pdf, word }
  }

  registerFile(record) {
    return this.db.create('file_objects', record)
  }

  async registerUpload({ file, userId }) {
    await this.ensureDirs()
    const ext = path.extname(file.originalname || '')
    const id = uuid()
    const target = path.join(this.uploadsDir, `${id}${ext}`)
    await fsp.rename(file.path, target)
    const cloudPath = `uploads/${userId}/${id}${ext}`
    const fileId = await this.uploadLocalFile({ localPath: target, cloudPath })
    return this.registerFile({
      id,
      userId,
      recordId: null,
      type: 'upload',
      mimeType: file.mimetype || 'application/octet-stream',
      originalName: file.originalname || `upload${ext}`,
      storagePath: target,
      cloudPath,
      fileId,
      size: file.size || 0
    })
  }

  async downloadFile(file) {
    if (file.storagePath && fs.existsSync(file.storagePath)) return file.storagePath
    if (!file.fileId) return file.storagePath
    await this.ensureDirs()
    const target = path.join(this.filesDir, `${file.id}${path.extname(file.originalName || '')}`)
    const app = await this.getApp()
    const result = await app.downloadFile({ fileID: file.fileId })
    if (result.fileContent) await fsp.writeFile(target, result.fileContent)
    return target
  }
}
