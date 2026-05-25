const storage = require('../../utils/storage')
const api = require('../../services/api')
const modal = require('../../utils/modal')

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDate(value) {
  if (!value) return '待支付'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusLabel(status = '') {
  const key = String(status || '').trim()
  if (key === 'paid' || key === 'mock_paid') return '已支付'
  if (key === 'created' || key === 'pending') return '待支付'
  if (key === 'refunded') return '已退款'
  return key || '已记录'
}

function priceText(order = {}) {
  if (order.price !== undefined && order.price !== null && order.price !== '') return `¥${order.price}`
  if (order.amountCents) return `¥${(Number(order.amountCents) / 100).toFixed(2)}`
  return '¥0'
}

function viewOrder(order = {}) {
  const points = Number(order.points || order.pointsAdded || 0)
  const status = order.status || order.paymentStatus
  const planName = order.planName || order.productName || order.memberName || order.title || '点数套餐'
  return {
    ...order,
    title: order.title || planName,
    planName,
    statusText: order.statusLabel || statusLabel(status),
    timeText: formatDate(order.paidAt || order.fulfilledAt || order.createdAt),
    priceText: priceText(order),
    pointsText: points ? `增加 ${points} 点` : '点数待确认',
    expireText: order.expireAt || order.planExpiresAt ? `有效期至 ${formatDate(order.expireAt || order.planExpiresAt)}` : '',
    orderNoText: order.orderNo ? `订单号 ${order.orderNo}` : ''
  }
}

Page({
  data: { records: [] },
  async onShow() {
    if (!storage.getToken()) {
      this.setData({ records: storage.getPurchases().map(viewOrder) })
      return
    }
    try {
      const data = await api.getOrders()
      this.setData({ records: (data.orders || []).map(viewOrder) })
    } catch (e) {
      modal.showError(e.message || '加载失败', { title: '购买记录加载失败' })
      this.setData({ records: storage.getPurchases().map(viewOrder) })
    }
  }
})
