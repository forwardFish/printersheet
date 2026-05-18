const storage = require('../../utils/storage')
const { getDefaultPlan } = require('../../utils/plans')
const api = require('../../services/api')
const modal = require('../../utils/modal')

function returnAfterPayment() {
  wx.redirectTo({ url: '/pages/my/my' })
}

Page({
  data: { plan: {}, paying: false, validityText: '' },
  onLoad() {
    const selected = getApp().globalData.selectedPlan
    const plan = selected && selected.id ? selected : getDefaultPlan()
    const validityText = plan.productType === 'point_pack'
      ? '立即到账'
      : plan.billing === 'year'
        ? '12个月'
        : plan.billing === 'month'
          ? '31天'
          : plan.billingLabel || ''
    this.setData({ plan, validityText })
  },
  async pay() {
    if (this.data.paying) return
    if (!storage.getToken()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    this.setData({ paying: true })
    wx.showLoading({ title: '支付中...' })
    try {
      const result = await api.createMockPurchase(this.data.plan.id)
      if (typeof result.pointsBalance === 'number') storage.setPoints(result.pointsBalance)
      wx.hideLoading()
      this.setData({ paying: false })
      await modal.showTip('支付成功，点数和会员权益已发放。', { title: '支付成功' })
      returnAfterPayment()
    } catch (e) {
      wx.hideLoading()
      this.setData({ paying: false })
      modal.showError(e.message || '支付失败', { title: '支付失败' })
    }
  }
})
