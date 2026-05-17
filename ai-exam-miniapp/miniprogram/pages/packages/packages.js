const { PLANS, getPaidPlans, getPointPacks, getPlanById } = require('../../utils/plans')
const storage = require('../../utils/storage')

Page({
  data: {
    freePlan: PLANS[0],
    plans: getPaidPlans(),
    pointPacks: getPointPacks(),
    selectedId: 'pro_monthly',
    points: 3,
    planStatusText: '免费体验'
  },
  onShow() {
    const member = storage.getMember()
    this.setData({
      points: storage.getPoints(),
      planStatusText: member ? member.name : '免费体验'
    })
  },
  selectPlan(e) {
    this.setData({ selectedId: e.currentTarget.dataset.id })
  },
  goOrder() {
    const plan = getPlanById(this.data.selectedId)
    if (!plan) return
    getApp().globalData.selectedPlan = plan
    wx.navigateTo({ url: '/pages/order/order' })
  }
})
