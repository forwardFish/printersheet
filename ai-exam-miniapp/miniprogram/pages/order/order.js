const storage = require('../../utils/storage')
const { getDefaultPlan } = require('../../utils/plans')
const billing = require('../../utils/billing')

function addDays(base, days) {
  return new Date(base.getTime() + days * 24 * 3600 * 1000)
}

Page({
  data: { plan: {}, paying: false },
  onLoad() {
    const plan = getApp().globalData.selectedPlan || getDefaultPlan()
    this.setData({ plan })
  },
  pay() {
    if (this.data.paying) return
    this.setData({ paying: true })
    wx.showLoading({ title: '支付中...' })
    setTimeout(() => {
      const plan = this.data.plan
      const orderId = `mock_${Date.now()}`
      const now = new Date()
      const isPointPack = plan.productType === 'point_pack'
      storage.addPoints(plan.points || 0, {
        type: isPointPack ? 'point_pack_purchase' : 'plan_purchase_bonus',
        relatedId: orderId,
        remark: plan.name
      })
      let expireAt = ''
      if (!isPointPack) {
        const current = storage.getMember()
        const currentExpireMs = current && (current.planExpiresAt || current.expireAt)
          ? new Date(current.planExpiresAt || current.expireAt).getTime()
          : 0
        const start = currentExpireMs > now.getTime() ? new Date(currentExpireMs) : now
        expireAt = billing.formatDate(addDays(start, 31))
        storage.setMember({
          name: plan.memberName,
          expireAt,
          planExpiresAt: `${expireAt}T23:59:59.000Z`,
          planId: plan.id,
          planCode: plan.planCode,
          billing: plan.billing,
          points: plan.points,
          purchasedAt: now.toLocaleString(),
          benefits: plan.benefits || []
        })
      }
      const inviteReward = storage.rewardInviterOnFirstPurchase(orderId)
      storage.addPurchase({
        orderId,
        planId: plan.id,
        planName: plan.name,
        title: plan.memberName,
        productType: plan.productType,
        price: plan.price,
        points: plan.points,
        billing: plan.billing,
        billingLabel: plan.billingLabel,
        status: 'mock_paid',
        statusLabel: '模拟支付成功',
        paymentStatus: 'paid',
        expireAt,
        inviteReward
      })
      wx.hideLoading()
      wx.showToast({ title: '支付成功', icon: 'success' })
      this.setData({ paying: false })
      setTimeout(() => wx.redirectTo({ url: '/pages/my/my' }), 800)
    }, 900)
  }
})
