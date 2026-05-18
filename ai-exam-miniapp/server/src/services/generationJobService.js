import { v4 as uuid } from 'uuid'
import { pointsFor } from '../lib/worksheet.js'

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])
const DEFAULT_JOB_TIMEOUT_MS = 10 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function publicJob(job) {
  if (!job) return null
  const { body, ...rest } = job
  return rest
}

function safeBody(body = {}) {
  return {
    requestId: String(body.requestId || '').trim(),
    prompt: String(body.prompt || ''),
    grade: String(body.grade || ''),
    subject: String(body.subject || ''),
    difficulty: String(body.difficulty || ''),
    mode: String(body.mode || ''),
    questionCount: Number(body.questionCount || 0)
  }
}

export class GenerationJobService {
  constructor({ db, worksheetService, concurrency = 3, jobTimeoutMs = DEFAULT_JOB_TIMEOUT_MS }) {
    this.db = db
    this.worksheetService = worksheetService
    this.concurrency = Math.max(1, Number(concurrency || 3))
    const timeout = Number(jobTimeoutMs || DEFAULT_JOB_TIMEOUT_MS)
    this.jobTimeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_JOB_TIMEOUT_MS
    this.running = 0
    this.pumpScheduled = false
    this.processing = new Set()
  }

  async recoverInterruptedJobs() {
    const running = await this.db.listGenerationJobs({ status: 'running' })
    for (const job of running) {
      await this.db.update('generation_jobs', job.id, {
        status: 'queued',
        progress: Math.min(Number(job.progress || 0), 30),
        message: '服务恢复后已重新排队，正在等待生成。'
      })
    }
    const queued = await this.db.listGenerationJobs({ status: 'queued' })
    if (queued.length) this.schedulePump()
  }

  toResponse(job) {
    return publicJob(job)
  }

  async createJob({ user, body }) {
    const payload = safeBody(body)
    if (!payload.requestId) {
      const error = new Error('requestId is required')
      error.statusCode = 400
      throw error
    }

    const existingRecord = await this.db.findWorksheetByRequestId(user.id, payload.requestId)
    if (existingRecord) {
      const existingJob = await this.db.findGenerationJobByRequestId(user.id, payload.requestId)
      return this.toResponse(existingJob || {
        id: existingRecord.id,
        jobId: existingRecord.id,
        userId: user.id,
        requestId: payload.requestId,
        status: 'succeeded',
        progress: 100,
        message: '练习卷已生成，可预览和下载。',
        worksheetRecordId: existingRecord.id,
        result: this.worksheetService.toResponse(existingRecord),
        errorMessage: '',
        createdAt: existingRecord.createdAt,
        updatedAt: existingRecord.updatedAt,
        finishedAt: existingRecord.updatedAt
      })
    }

    const existingJob = await this.db.findGenerationJobByRequestId(user.id, payload.requestId)
    if (existingJob) {
      if (!TERMINAL_STATUSES.has(existingJob.status)) this.schedulePump()
      return this.toResponse(existingJob)
    }

    const id = uuid()
    const pointsUsed = pointsFor(payload)
    const job = await this.db.create('generation_jobs', {
      id,
      jobId: id,
      userId: user.id,
      requestId: payload.requestId,
      status: 'queued',
      progress: 0,
      message: '生成任务已创建，正在排队。',
      prompt: payload.prompt,
      grade: payload.grade,
      subject: payload.subject,
      difficulty: payload.difficulty,
      mode: payload.mode,
      questionCount: payload.questionCount,
      pointsUsed,
      worksheetRecordId: '',
      result: null,
      errorMessage: '',
      finishedAt: '',
      body: payload
    })
    this.schedulePump()
    return this.toResponse(job)
  }

  async getUserJob({ user, jobId }) {
    const job = await this.db.findGenerationJobById(jobId)
    if (!job || job.userId !== user.id) return null
    return this.toResponse(job)
  }

  async listUserJobs({ user, status = '' }) {
    const jobs = await this.db.listUserGenerationJobs(user.id, status)
    if (jobs.some(job => job.status === 'queued')) this.schedulePump()
    return jobs.map(job => this.toResponse(job))
  }

  schedulePump() {
    if (this.pumpScheduled) return
    this.pumpScheduled = true
    setImmediate(() => {
      this.pumpScheduled = false
      this.pump().catch(error => console.error('[generation-jobs] pump failed', error))
    })
  }

  async pump() {
    while (this.running < this.concurrency) {
      const queued = await this.db.listGenerationJobs({ status: 'queued' })
      const job = queued.find(item => !this.processing.has(item.id))
      if (!job) return
      this.processing.add(job.id)
      this.running += 1
      this.runJob(job)
        .catch(error => console.error('[generation-jobs] job failed', error))
        .finally(() => {
          this.processing.delete(job.id)
          this.running -= 1
          this.schedulePump()
        })
    }
  }

  async runJob(job) {
    const startedAt = nowIso()
    await this.db.update('generation_jobs', job.id, {
      status: 'running',
      progress: 10,
      message: '正在生成，可离开页面，完成后会出现在最近生成。',
      startedAt
    })
    try {
      const user = await this.db.findUserById(job.userId)
      if (!user) {
        const error = new Error('user not found')
        error.statusCode = 404
        throw error
      }
      const result = await this.worksheetService.generate({
        user,
        body: job.body || safeBody(job),
        file: null,
        timeoutMs: this.jobTimeoutMs
      })
      await this.db.update('generation_jobs', job.id, {
        status: 'succeeded',
        progress: 100,
        message: '生成完成，点击预览。',
        worksheetRecordId: result.worksheetId || '',
        result,
        errorMessage: '',
        finishedAt: nowIso()
      })
    } catch (error) {
      const isTimeout = error.code === 'GENERATION_TIMEOUT'
      await this.db.update('generation_jobs', job.id, {
        status: 'failed',
        progress: 100,
        message: isTimeout ? '生成超时，请重新生成。' : '生成失败，点数已退回，可重试。',
        errorMessage: error.message || '生成失败',
        finishedAt: nowIso()
      })
    }
  }
}
