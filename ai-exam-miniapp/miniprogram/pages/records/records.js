const storage = require('../../utils/storage')
const modal = require('../../utils/modal')
const api = require('../../services/api')

Page({
  data: { records: [] },
  async onShow() {
    if (!storage.getToken()) {
      this.setData({ records: storage.getRecords() })
      return
    }
    try {
      const data = await api.getWorksheets()
      this.setData({ records: data.records || [] })
    } catch (e) {
      modal.showError(e.message || '加载失败', { title: '记录加载失败' })
      this.setData({ records: storage.getRecords() })
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
