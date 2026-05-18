const config = require('../utils/config')
const { normalizeWorksheet, sampleWorksheet } = require('../utils/worksheet')
const { PLANS, POINT_PACKS } = require('../utils/plans')
const modal = require('../utils/modal')
const storage = require('../utils/storage')

function authHeader() {
  const token = wx.getStorageSync('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fullUrl(url) {
  if (/^https?:\/\//i.test(url)) return url
  return `${config.API_BASE_URL}${url}`
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      header: { ...authHeader(), ...(options.header || {}) },
      timeout: config.REQUEST_TIMEOUT_MS || 300000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data)
        else reject(new Error((res.data && res.data.message) || `请求失败：HTTP ${res.statusCode}`))
      },
      fail(err) {
        reject(new Error(`${err.errMsg || err.message || '网络请求失败'}。请确认后端已启动：${config.API_BASE_URL}，并在微信开发者工具本地设置中勾选“不校验合法域名”。`))
      }
    })
  })
}

function uploadFile({ url, filePath, name, formData }) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name,
      formData,
      header: authHeader(),
      timeout: config.UPLOAD_TIMEOUT_MS || 300000,
      success(res) {
        try {
          const data = JSON.parse(res.data)
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data)
          else reject(new Error(data.message || '上传失败'))
        } catch (e) {
          reject(new Error(`上传响应解析失败：${e.message || res.data || 'unknown'}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || err.message || 'wx.uploadFile 调用失败'))
      }
    })
  })
}

async function loginWechat({ code, userInfo, mockOpenid }) {
  if (config.USE_MOCK_API) {
    storage.getPoints()
    return { success: true, token: 'mock-token', user: { id: mockOpenid || code || 'local-dev-openid', nickname: userInfo && userInfo.nickName }, pointsBalance: storage.getPoints() }
  }
  return request({
    url: `${config.API_BASE_URL}/api/auth/wechat-login`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { code, userInfo, mockOpenid }
  })
}

async function getMe() {
  if (config.USE_MOCK_API) {
    return { success: true, user: { id: '104a9c90-5fc0-461e-995a-42928a37b2c5', nickname: 'We' }, pointsBalance: storage.getPoints(), isPaid: true, planCode: 'pro', planExpiresAt: '2026-06-17', canRemoveWatermark: true, canDownloadWord: true }
  }
  return request({ url: `${config.API_BASE_URL}/api/me`, method: 'GET' })
}

async function getPoints() {
  if (config.USE_MOCK_API) return { success: true, pointsBalance: storage.getPoints() }
  return request({ url: `${config.API_BASE_URL}/api/points`, method: 'GET' })
}

async function generateWorksheet({ prompt, filePath, fileName, fileType, fileSize, fileExtension, grade, subject, difficulty, mode, questionCount }) {
  if (config.USE_MOCK_API) {
    await new Promise(resolve => setTimeout(resolve, 600))
    const worksheet = sampleWorksheet(prompt, { grade, subject, difficulty, mode, questionCount })
    const pointsUsed = Number(worksheet.cost && worksheet.cost.pointsUsed || 0)
    if (!storage.consumePoints(pointsUsed, { type: 'generate_cost', remark: '生成练习卷扣点' })) {
      const error = new Error('点数不足，请先购买套餐或点数包。')
      error.statusCode = 402
      throw error
    }
    return { success: true, worksheet, source: 'frontend-mock', pointsUsed: worksheet.cost.pointsUsed, cost: worksheet.cost, pdfUrl: '', wordUrl: '' }
  }
  const requestId = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const body = { requestId, prompt, grade, subject, difficulty, mode, questionCount }
  const formData = { ...body, fileName, fileType, fileSize, fileExtension }
  async function postGenerate(url) {
    if (filePath) return uploadFile({ url, filePath, name: 'file', formData })
    return request({
      url,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: body
    })
  }
  let data
  try {
    data = await postGenerate(`${config.API_BASE_URL}/api/worksheets/generate`)
  } catch (error) {
    if (!/HTTP 404/.test(error.message || '')) throw error
    data = await postGenerate(`${config.API_BASE_URL}/api/worksheet/generate`)
  }
  if (data && data.worksheet) data.worksheet = normalizeWorksheet(data.worksheet)
  return data
}

async function generateWorksheetAsync(options) {
  const requestId = options.requestId || `wx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  if (config.USE_MOCK_API) {
    const worksheet = sampleWorksheet(options.prompt, options)
    return { success: true, job: { id: `mock-${Date.now()}`, requestId, status: 'succeeded', progress: 100, message: '生成完成，点击预览。', result: { success: true, worksheet, source: 'frontend-mock', pointsUsed: worksheet.cost.pointsUsed, cost: worksheet.cost, pdfUrl: '', wordUrl: '' } } }
  }
  let data
  try {
    data = await request({
      url: `${config.API_BASE_URL}/api/generation-jobs`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { ...options, requestId }
    })
  } catch (error) {
    if (!/HTTP 404/.test(error.message || '')) throw error
    data = await request({
      url: `${config.API_BASE_URL}/api/worksheet/generate?async=1`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { ...options, requestId, async: true }
    })
    if (data && data.jobId) {
      data = {
        success: true,
        job: {
          id: data.jobId,
          jobId: data.jobId,
          requestId,
          status: data.status || 'queued',
          progress: data.progress || 0,
          message: data.message || '正在生成，可离开页面。',
          prompt: options.prompt,
          grade: options.grade,
          subject: options.subject,
          mode: options.mode,
          questionCount: options.questionCount,
          legacy: true
        }
      }
    }
  }
  if (data && data.job && data.job.result && data.job.result.worksheet) data.job.result.worksheet = normalizeWorksheet(data.job.result.worksheet)
  return data
}

async function getGenerationJob(jobId) {
  if (String(jobId || '').indexOf('mock-') === 0) {
    const worksheet = sampleWorksheet('后台生成完成', { mode: 'practice', questionCount: 5 })
    return { success: true, jobId, status: 'succeeded', progress: 100, message: '练习卷已生成', result: { success: true, worksheet, source: 'frontend-mock', pointsUsed: worksheet.cost.pointsUsed, cost: worksheet.cost, pdfUrl: '', wordUrl: '' } }
  }
  let data
  try {
    data = await request({ url: `${config.API_BASE_URL}/api/generation-jobs/${jobId}`, method: 'GET' })
  } catch (error) {
    if (!/HTTP 404/.test(error.message || '')) throw error
    const legacy = await request({ url: `${config.API_BASE_URL}/api/worksheet/jobs/${jobId}`, method: 'GET' })
    data = { success: true, job: { ...legacy, id: legacy.jobId || jobId, jobId: legacy.jobId || jobId, legacy: true } }
  }
  if (data && data.job && data.job.result && data.job.result.worksheet) data.job.result.worksheet = normalizeWorksheet(data.job.result.worksheet)
  return data
}

async function getGenerationJobs(status = '') {
  if (config.USE_MOCK_API) return { success: true, jobs: [] }
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  let data
  try {
    data = await request({ url: `${config.API_BASE_URL}/api/generation-jobs${query}`, method: 'GET' })
  } catch (error) {
    if (/HTTP 404/.test(error.message || '')) return { success: true, jobs: [] }
    throw error
  }
  if (data && Array.isArray(data.jobs)) {
    data.jobs = data.jobs.map(job => {
      if (job.result && job.result.worksheet) job.result.worksheet = normalizeWorksheet(job.result.worksheet)
      return job
    })
  }
  return data
}

function exportPdf(worksheet, options = {}) {
  return request({
    url: `${config.API_BASE_URL}/api/export/pdf?returnUrl=1`,
    method: 'POST',
    header: { 'content-type': 'application/json', accept: 'application/json' },
    data: { worksheet: normalizeWorksheet(worksheet), watermark: options.watermark !== false }
  })
}

function exportDocx(worksheet) {
  return request({
    url: `${config.API_BASE_URL}/api/export/docx?returnUrl=1`,
    method: 'POST',
    header: { 'content-type': 'application/json', accept: 'application/json' },
    data: { worksheet: normalizeWorksheet(worksheet) }
  })
}

function openDocument(filePath, fileType) {
  return new Promise((resolve, reject) => {
    wx.openDocument({ filePath, fileType, showMenu: true, success: resolve, fail: reject })
  })
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: fullUrl(url),
      header: authHeader(),
      timeout: config.DOWNLOAD_TIMEOUT_MS || 300000,
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) resolve(res.tempFilePath)
        else reject(new Error(`文件下载失败：HTTP ${res.statusCode || 'unknown'}`))
      },
      fail: reject
    })
  })
}

async function getPlans() {
  if (config.USE_MOCK_API) {
    return { success: true, plans: { month: PLANS.filter(plan => plan.id !== 'free' && plan.id !== 'standard_yearly'), pointPacks: POINT_PACKS } }
  }
  const data = await request({ url: `${config.API_BASE_URL}/api/products`, method: 'GET' })
  const products = data.products || []
  return { success: true, plans: { month: products.filter(item => item.productType === 'plan'), pointPacks: products.filter(item => item.productType === 'point_pack') } }
}

async function createMockPurchase(planId) {
  if (config.USE_MOCK_API) {
    const product = [...PLANS, ...POINT_PACKS].find(item => item.id === planId) || {}
    const orderNo = `mock-${Date.now()}`
    storage.addPoints(Number(product.points || 0), {
      type: product.productType === 'point_pack' ? 'point_pack_purchase' : 'plan_purchase_bonus',
      relatedId: orderNo,
      remark: product.name || planId
    })
    return { success: true, order: { orderNo }, planId, pointsAdded: Number(product.points || 0), pointsBalance: storage.getPoints() }
  }
  const created = await request({
    url: `${config.API_BASE_URL}/api/orders/create`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { productCode: planId }
  })
  return request({
    url: `${config.API_BASE_URL}/api/dev/pay/mock-success`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { orderNo: created.order.orderNo }
  })
}

async function getOrders() {
  if (config.USE_MOCK_API) return { success: true, orders: [] }
  return request({ url: `${config.API_BASE_URL}/api/orders`, method: 'GET' })
}

async function getWorksheets() {
  if (config.USE_MOCK_API) return { success: true, records: [] }
  return request({ url: `${config.API_BASE_URL}/api/worksheets`, method: 'GET' })
}

async function getWorksheet(id) {
  return request({ url: `${config.API_BASE_URL}/api/worksheets/${id}`, method: 'GET' })
}

async function downloadAndOpen(url, fileType) {
  if (!url) {
    modal.showMessage({ title: '需要后端文件地址', content: '当前是前端演示数据，没有真实文件地址。请启动 server 后端并配置 API_BASE_URL。' })
    throw new Error('缺少文件地址')
  }
  wx.showLoading({ title: '正在打开...' })
  try {
    const filePath = await downloadFile(url)
    await openDocument(filePath, fileType)
    return filePath
  } catch (e) {
    modal.showMessage({ title: '打开失败', content: e.message || '文件下载或打开失败，请检查后端服务和小程序调试域名配置。' })
    throw e
  } finally {
    wx.hideLoading()
  }
}

module.exports = { loginWechat, getMe, getPoints, generateWorksheet, generateWorksheetAsync, getGenerationJob, getGenerationJobs, exportPdf, exportDocx, getPlans, createMockPurchase, getOrders, getWorksheets, getWorksheet, downloadAndOpen }
