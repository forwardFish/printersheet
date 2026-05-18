const { PLANS, getPaidPlans, getPointPacks, getPlanById } = require('../../utils/plans')
const storage = require('../../utils/storage')
const api = require('../../services/api')
const modal = require('../../utils/modal')

Page({
  data: {
    freePlan: PLANS[0],
    plans: getPaidPlans(),
    pointPacks: getPointPacks(),
    selectedId: 'pro_monthly',
    points: 3,
    planStatusText: '免费体验'
  },
  async onShow() {
    this.setData({ points: storage.getPoints() })
    try {
      if (storage.getToken()) {
        const [me, plans] = await Promise.all([api.getMe(), api.getPlans()])
        this.setData({
          points: me.pointsBalance ?? storage.getPoints(),
          planStatusText: me.isPaid ? me.planCode : '免费体验',
          plans: plans.plans.month || this.data.plans,
          pointPacks: plans.plans.pointPacks || this.data.pointPacks
        })
      } else if (api.getPlans) {
        const plans = await api.getPlans()
        this.setData({
          plans: plans.plans.month || this.data.plans,
          pointPacks: plans.plans.pointPacks || this.data.pointPacks
        })
      }
    } catch (e) {
      modal.showError(e.message || '商品加载失败', { title: '商品加载失败' })
    }
  },
  selectPlan(e) {
    this.setData({ selectedId: e.currentTarget.dataset.id })
  },
  goOrder() {
    const plan = [...this.data.plans, ...this.data.pointPacks].find(item => item.id === this.data.selectedId) || getPlanById(this.data.selectedId)
    if (!plan) return
    getApp().globalData.selectedPlan = plan
    wx.navigateTo({ url: '/pages/order/order' })
  }
})
