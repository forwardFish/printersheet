const storage = require('../../utils/storage')
const api = require('../../services/api')
const modal = require('../../utils/modal')

Page({
  data: { records: [] },
  async onShow() {
    if (!storage.getToken()) {
      this.setData({ records: storage.getPurchases() })
      return
    }
    try {
      const data = await api.getOrders()
      this.setData({ records: data.orders || [] })
    } catch (e) {
      modal.showError(e.message || '加载失败', { title: '购买记录加载失败' })
      this.setData({ records: storage.getPurchases() })
    }
  }
})
