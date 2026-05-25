const config = require('../utils/config')
const { normalizeWorksheet } = require('../utils/worksheet')
const { PLANS, POINT_PACKS } = require('../utils/plans')
const modal = require('../utils/modal')
const storage = require('../utils/storage')

function authHeader() {
  const token = storage.getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fullUrl(url) {
  if (/^https?:\/\//i.test(url)) return url
  return `${config.API_BASE_URL}${url}`
}

function normalizeApiErrorMessage({ statusCode = 0, message = '', url = '' } = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  if (lower.includes('resource is not found') || lower.includes('reource is not found')) {
    if (String(url || '').includes('/api/auth/wechat-login')) {
      return `登录接口不可用：${config.API_BASE_URL}/api/auth/wechat-login 未找到或微信登录配置不匹配。请确认后端已启动、API_BASE_URL 指向正确服务，并检查 WECHAT_APP_ID/WECHAT_APP_SECRET。`
    }
    return `接口不存在或后端地址不正确：${config.API_BASE_URL}`
  }
  if (statusCode === 401) return text || '登录已失效，请重新微信登录。'
  return text || `请求失败：HTTP ${statusCode}`
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      header: { ...authHeader(), ...(options.header || {}) },
      timeout: config.REQUEST_TIMEOUT_MS || 300000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data)
        else {
          if (res.statusCode === 401) storage.clearToken()
          reject(new Error(normalizeApiErrorMessage({
            statusCode: res.statusCode,
            message: res.data && res.data.message,
            url: options.url
          })))
        }
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
          else {
            if (res.statusCode === 401) storage.clearToken()
            reject(new Error(res.statusCode === 401 ? '登录已失效，请重新微信登录。' : (data.message || '上传失败')))
          }
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

function requestPayment(payment) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      ...payment,
      success: resolve,
      fail(err) {
        const message = err.errMsg || err.message || 'requestPayment failed'
        const error = new Error(message)
        error.isPaymentCancel = /cancel/i.test(message)
        reject(error)
      }
    })
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loginWechat({ code, userInfo, mockOpenid }) {
  if (config.USE_MOCK_API) {
    storage.getPoints()
    throw new Error('本地模拟登录已关闭，请连接真实后端并使用微信登录。')
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

async function updateProfile({ nickname, avatarUrl }) {
  if (config.USE_MOCK_API) {
    const user = { ...(storage.getUser() || {}), nickname, avatarUrl, avatar: avatarUrl }
    storage.setUser(user)
    return { success: true, user }
  }
  return request({
    url: `${config.API_BASE_URL}/api/me/profile`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { nickname, avatarUrl }
  })
}

async function getPoints() {
  if (config.USE_MOCK_API) return { success: true, pointsBalance: storage.getPoints() }
  return request({ url: `${config.API_BASE_URL}/api/points`, method: 'GET' })
}

async function claimDailyShareReward(channel = 'timeline') {
  if (config.USE_MOCK_API) return storage.claimDailyTimelineShareReward()
  const data = await request({
    url: `${config.API_BASE_URL}/api/rewards/daily-share`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { channel }
  })
  if (data.code === 'ALREADY_CLAIMED') data.message = '你今天已经获得过分享奖励，明天再来吧。'
  else if (data.claimed) data.message = '分享奖励已到账，已获得 1 点。'
  return data
}

async function estimateGeneration({ prompt, filePath, fileName, fileType, fileSize, fileExtension, mode }) {
  if (config.USE_MOCK_API) {
    const estimatedPages = billing.estimateTextPages(prompt)
    return {
      success: true,
      mode,
      estimatedPages,
      pointsRequired: billing.isPageMeteredMode(mode) ? billing.getMeteredPointCost(estimatedPages) : billing.getGenerationPointCost(mode),
      maxPages: billing.MAX_METERED_PAGES,
      metered: billing.isPageMeteredMode(mode),
      confidence: filePath ? 'estimated' : 'estimated',
      source: filePath ? 'file' : 'text'
    }
  }
  const body = { prompt, mode }
  const formData = { ...body, fileName, fileType, fileSize, fileExtension }
  if (filePath) {
    return uploadFile({ url: `${config.API_BASE_URL}/api/generation/estimate`, filePath, name: 'file', formData })
  }
  return request({
    url: `${config.API_BASE_URL}/api/generation/estimate`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: body
  })
}

async function generateWorksheet({ prompt, filePath, fileName, fileType, fileSize, fileExtension, grade, subject, difficulty, mode, questionCount, estimatedPages, pointsRequired }) {
  if (config.USE_MOCK_API) {
    throw new Error('USE_MOCK_API 已禁用出题：不允许生成 demo/mock 练习卷。请关闭 USE_MOCK_API 并连接真实后端。')
  }
  const requestId = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const body = { requestId, prompt, grade, subject, difficulty, mode, questionCount, estimatedPages, pointsRequired }
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
    throw new Error('USE_MOCK_API 已禁用出题：不允许创建 demo/mock 生成任务。请关闭 USE_MOCK_API 并连接真实后端。')
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
    throw new Error('mock 生成任务已禁用：不允许返回 demo/mock 练习卷。')
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
  if (created.paymentProvider === 'wechat' && created.payment) {
    let paymentResult
    try {
      paymentResult = await requestPayment(created.payment)
    } catch (error) {
      throw error
    }
    let refreshed = null
    for (let i = 0; i < 5; i += 1) {
      refreshed = await refreshPaymentOrder(created.order.orderNo).catch(() => null)
      if (refreshed && refreshed.order && refreshed.order.status === 'paid') break
      await delay(800)
    }
    const me = refreshed && refreshed.order && refreshed.order.status === 'paid'
      ? await getMe().catch(() => null)
      : null
    return {
      success: true,
      order: (refreshed && refreshed.order) || created.order,
      paymentResult,
      paymentPending: !refreshed || !refreshed.order || refreshed.order.status !== 'paid',
      pointsBalance: typeof me?.pointsBalance === 'number'
        ? me.pointsBalance
        : (typeof refreshed?.pointsBalance === 'number' ? refreshed.pointsBalance : undefined)
    }
  }
  return request({
    url: `${config.API_BASE_URL}/api/dev/pay/mock-success`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { orderNo: created.order.orderNo }
  })
}

async function refreshPaymentOrder(orderNo) {
  if (config.USE_MOCK_API) return { success: true, order: null }
  return request({
    url: `${config.API_BASE_URL}/api/orders/${encodeURIComponent(orderNo)}/refresh`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: {}
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

module.exports = { loginWechat, getMe, updateProfile, getPoints, claimDailyShareReward, estimateGeneration, generateWorksheet, generateWorksheetAsync, getGenerationJob, getGenerationJobs, exportPdf, exportDocx, getPlans, createMockPurchase, refreshPaymentOrder, getOrders, getWorksheets, getWorksheet, downloadAndOpen }
