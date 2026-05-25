const storage = require('../../utils/storage')
const modal = require('../../utils/modal')
const api = require('../../services/api')

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDate(value) {
  if (!value) return '刚刚'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeModeLabel(mode = '') {
  const key = String(mode || '').trim()
  if (key === 'extended') return '加长练习'
  if (key === 'wrong_question_similar') return '错题同类'
  if (key === 'upload_material') return '上传资料'
  if (key === 'full_paper_simulation' || key === 'exam_simulation') return '整卷仿真'
  return '普通练习'
}

function viewRecord(record = {}) {
  const worksheet = record.worksheet || {}
  const questions = worksheet.questions || []
  const title = record.title || worksheet.title || 'AI 练习卷'
  const grade = worksheet.grade || record.grade || ''
  const subject = worksheet.subject || record.subject || ''
  const count = Number(record.questionCount || questions.length || 0)
  const points = Number(record.pointsUsed || worksheet.pointsUsed || worksheet.cost?.pointsUsed || 0)
  const modeLabel = record.modeLabel || normalizeModeLabel(record.mode || worksheet.mode)
  const sourceFileInfo = record.sourceFileInfo || worksheet.sourceFileInfo || {}
  const metaParts = [
    formatDate(record.createdAt || record.updatedAt),
    [grade, subject].filter(Boolean).join(' / '),
    count ? `${count} 题` : '',
    points ? `消耗 ${points} 点` : ''
  ].filter(Boolean)
  return {
    ...record,
    title,
    modeLabel,
    metaText: metaParts.join(' · '),
    sourceText: record.sourceFileName || sourceFileInfo.name
      ? `资料来源：${record.sourceFileName || sourceFileInfo.name}`
      : '',
    canOpen: Boolean(record.worksheet),
    worksheet: record.worksheet || null
  }
}

Page({
  data: { records: [] },
  async onShow() {
    if (!storage.getToken()) {
      this.setData({ records: storage.getRecords().map(viewRecord) })
      return
    }
    try {
      const data = await api.getWorksheets()
      this.setData({ records: (data.records || []).map(viewRecord) })
    } catch (e) {
      modal.showError(e.message || '加载失败', { title: '记录加载失败' })
      this.setData({ records: storage.getRecords().map(viewRecord) })
    }
  },
  openRecord(e) {
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find(item => item.id === id)
    if (!record || !record.worksheet) {
      modal.showMessage({ title: '无法打开', content: '这条历史记录缺少练习卷数据，请重新生成。' })
      return
    }
    getApp().globalData.lastWorksheet = {
      worksheet: record.worksheet,
      pdfUrl: record.pdfUrl || `/api/worksheets/${record.id}/download?type=pdf`,
      wordUrl: record.wordUrl || `/api/worksheets/${record.id}/download?type=word`,
      memberPdfUrl: record.memberPdfUrl || '',
      createdAt: record.createdAt
    }
    wx.navigateTo({ url: '/pages/preview/preview' })
  }
})
