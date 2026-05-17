const storage = require('../../utils/storage')
const modal = require('../../utils/modal')

Page({
  data: { records: [] },
  onShow() {
    this.setData({ records: storage.getRecords() })
  },
  openRecord(e) {
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find(item => item.id === id)
    if (!record || !record.worksheet) {
      modal.showMessage({
        title: '无法打开',
        content: '这条历史记录缺少练习卷数据，请重新生成。'
      })
      return
    }
    getApp().globalData.lastWorksheet = {
      worksheet: record.worksheet,
      pdfUrl: record.pdfUrl || '',
      wordUrl: record.wordUrl || '',
      memberPdfUrl: record.memberPdfUrl || '',
      createdAt: record.createdAt
    }
    wx.navigateTo({ url: '/pages/preview/preview' })
  }
})
