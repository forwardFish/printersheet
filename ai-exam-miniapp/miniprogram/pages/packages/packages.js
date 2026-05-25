const { PLANS, getPaidPlans, getPointPacks, getPlanById, getPlanRank, getPlanDisplayName } = require('../../utils/plans')
const storage = require('../../utils/storage')
const api = require('../../services/api')
const modal = require('../../utils/modal')

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function enrichPlans(plans, { currentPlanCode = 'free', isPaid = false } = {}) {
  const currentRank = isPaid ? getPlanRank(currentPlanCode) : 0
  return plans.map(plan => {
    const rank = getPlanRank(plan.planCode)
    const isSameRank = isPaid && rank === currentRank
    const isCurrent = isSameRank && plan.planCode === currentPlanCode
    const isLower = isPaid && currentRank > rank
    const disabled = isSameRank || isLower
    const actionLabel = !isPaid
      ? '立即购买'
      : isCurrent
        ? '当前套餐'
        : isSameRank
          ? '当前等级'
        : isLower
          ? '已开通更高套餐'
          : `升级到 ${plan.name}`
    return {
      ...plan,
      disabled,
      isCurrent,
      statusText: isCurrent ? '当前套餐' : (isSameRank ? '当前等级' : (isLower ? '已开通更高套餐' : '')),
      actionLabel
    }
  })
}

function enrichPointPacks(pointPacks) {
  return pointPacks.map(pack => ({
    ...pack,
    disabled: false,
    actionLabel: '购买能量包',
    statusText: `+${pack.points} 点`
  }))
}

function firstSelectable(plans, pointPacks, preferredId = '') {
  return [...plans, ...pointPacks].find(item => item.id === preferredId && !item.disabled) ||
    plans.find(item => !item.disabled) ||
    pointPacks[0] ||
    null
}

Page({
  data: {
    freePlan: PLANS[0],
    plans: enrichPlans(getPaidPlans()),
    pointPacks: enrichPointPacks(getPointPacks()),
    selectedId: 'pro_monthly',
    selectedActionText: '立即购买',
    selectedDisabled: false,
    points: 3,
    currentPlanCode: 'free',
    currentPlanName: '免费体验',
    memberExpireText: '',
    isPaid: false
  },
  async onShow() {
    this.setData({ points: storage.getPoints() })
    try {
      const products = api.getPlans ? await api.getPlans() : null
      const rawPlans = products?.plans?.month || getPaidPlans()
      const rawPointPacks = products?.plans?.pointPacks || getPointPacks()
      let currentPlanCode = 'free'
      let memberExpireText = ''
      let isPaid = false
      let points = storage.getPoints()
      if (storage.getToken()) {
        const me = await api.getMe()
        currentPlanCode = me.isPaid ? (me.planCode || 'free') : 'free'
        memberExpireText = me.isPaid ? formatDate(me.planExpiresAt) : ''
        isPaid = !!me.isPaid
        points = me.pointsBalance ?? storage.getPoints()
      }
      const plans = enrichPlans(rawPlans, { currentPlanCode, isPaid })
      const pointPacks = enrichPointPacks(rawPointPacks)
      const selected = firstSelectable(plans, pointPacks, this.data.selectedId)
      this.setData({
        points,
        currentPlanCode,
        currentPlanName: getPlanDisplayName(currentPlanCode),
        memberExpireText,
        isPaid,
        plans,
        pointPacks,
        selectedId: selected ? selected.id : '',
        selectedActionText: selected ? selected.actionLabel : '请选择商品',
        selectedDisabled: !selected
      })
    } catch (e) {
      modal.showError(e.message || '商品加载失败', { title: '商品加载失败' })
    }
  },
  selectPlan(e) {
    const id = e.currentTarget.dataset.id
    const item = [...this.data.plans, ...this.data.pointPacks].find(product => product.id === id)
    if (!item) return
    if (item.disabled) {
      modal.showTip(item.actionLabel || '当前商品不可购买')
      return
    }
    this.setData({
      selectedId: id,
      selectedActionText: item.actionLabel || '立即购买',
      selectedDisabled: false
    })
  },
  goOrder() {
    const plan = [...this.data.plans, ...this.data.pointPacks].find(item => item.id === this.data.selectedId) || getPlanById(this.data.selectedId)
    if (!plan || plan.disabled) {
      modal.showTip(plan?.actionLabel || '请选择可购买的商品')
      return
    }
    getApp().globalData.selectedPlan = plan
    wx.navigateTo({ url: '/pages/order/order' })
  }
})
