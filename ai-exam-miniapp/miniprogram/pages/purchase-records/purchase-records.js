const storage = require('../../utils/storage')

Page({
  data: { records: [] },
  onShow() {
    this.setData({ records: storage.getPurchases() })
  }
})
