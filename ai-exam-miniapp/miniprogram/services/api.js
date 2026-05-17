const config = require('../utils/config')
const { normalizeWorksheet, sampleWorksheet } = require('../utils/worksheet')
const { PLANS, POINT_PACKS } = require('../utils/plans')
const modal = require('../utils/modal')

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      timeout: config.REQUEST_TIMEOUT_MS || 300000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data)
        else reject(new Error((res.data && res.data.message) || '请求失败'))
      },
      fail: reject
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
async function generateWorksheet({ prompt, filePath, fileName, fileType, fileSize, fileExtension, grade, subject, difficulty, mode, questionCount }) {
  if (config.USE_MOCK_API) {
    await new Promise(resolve => setTimeout(resolve, 900))
    const worksheet = sampleWorksheet(prompt, { grade, subject, difficulty, mode, questionCount })
    return { success: true, worksheet, source: 'frontend-mock', pointsUsed: worksheet.cost.pointsUsed, cost: worksheet.cost, pdfUrl: '', wordUrl: '' }
  }
  const url = `${config.API_BASE_URL}/api/worksheet/generate`
  let data
  if (filePath) {
    data = await uploadFile({ url, filePath, name: 'file', formData: { prompt, fileName, fileType, fileSize, fileExtension, grade, subject, difficulty, mode, questionCount } })
  } else {
    data = await request({
      url,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { prompt, grade, subject, difficulty, mode, questionCount }
    })
  }
  if (data && data.worksheet) data.worksheet = normalizeWorksheet(data.worksheet)
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
    wx.openDocument({
      filePath,
      fileType,
      showMenu: true,
      success: resolve,
      fail: reject
    })
  })
}
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
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
    return {
      success: true,
      plans: {
        month: PLANS.filter(plan => plan.id !== 'free'),
        pointPacks: POINT_PACKS
      }
    }
  }
  return request({ url: `${config.API_BASE_URL}/api/plans`, method: 'GET' })
}
async function createMockPurchase(planId) {
  return request({
    url: `${config.API_BASE_URL}/api/purchases/mock`,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { planId }
  })
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
    modal.showMessage({
      title: '打开失败',
      content: e.message || '文件下载或打开失败，请检查后端服务和小程序调试域名配置。'
    })
    throw e
  } finally {
    wx.hideLoading()
  }
}
module.exports = { generateWorksheet, exportPdf, exportDocx, getPlans, createMockPurchase, downloadAndOpen }
