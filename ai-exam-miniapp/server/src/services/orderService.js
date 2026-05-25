import { v4 as uuid } from 'uuid'
import { POINT_PACKS, PRICING_PLANS, getPlanRank } from '../lib/plans.js'

const PRODUCTS = [...PRICING_PLANS, ...POINT_PACKS]

function amountCents(price) {
  return Math.round(Number(price || 0) * 100)
}

function formatAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, '')
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function httpError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export class OrderService {
  constructor({ db, authService, env = {} }) {
    this.db = db
    this.authService = authService
    this.env = env
  }

  productAmountCents(product) {
    const originalAmountCents = amountCents(product.price)
    if (this.env.paymentTestMode && originalAmountCents > 0) {
      return Math.max(1, Number(this.env.wechatPayTestAmountCents || 1))
    }
    return originalAmountCents
  }

  productView(product) {
    const originalAmountCents = amountCents(product.price)
    const effectiveAmountCents = this.productAmountCents(product)
    return {
      ...product,
      productCode: product.id,
      originalPrice: product.price,
      originalAmountCents,
      price: formatAmount(effectiveAmountCents),
      amountCents: effectiveAmountCents,
      paymentTestMode: !!(this.env.paymentTestMode && originalAmountCents > 0)
    }
  }

  listProducts() {
    return PRODUCTS.map(product => this.productView(product))
  }

  async createOrder({ userId, productCode }) {
    const product = PRODUCTS.find(item => item.id === productCode)
    if (!product) {
      throw httpError('product not found', 404)
    }
    if (product.productType === 'plan') {
      const active = (await this.db.listActiveMemberships(userId))
        .sort((a, b) => {
          const rankDiff = getPlanRank(b.planCode) - getPlanRank(a.planCode)
          if (rankDiff) return rankDiff
          return String(b.expiresAt || '').localeCompare(String(a.expiresAt || ''))
        })[0]
      const activeRank = getPlanRank(active?.planCode)
      const targetRank = getPlanRank(product.planCode)
      if (activeRank >= targetRank && activeRank > 0) {
        throw httpError(activeRank === targetRank
          ? '当前套餐等级已开通，请选择更高套餐或购买能量包。'
          : '已开通更高套餐，请购买能量包或等待套餐到期后再购买。', 409)
      }
    }
    const originalAmountCents = amountCents(product.price)
    const effectiveAmountCents = this.productAmountCents(product)
    return this.db.create('orders', {
      id: uuid(),
      orderNo: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      productCode: product.id,
      productType: product.productType,
      productName: product.name,
      planCode: product.planCode || '',
      points: Number(product.points || 0),
      originalAmountCents,
      originalPrice: product.price,
      amountCents: effectiveAmountCents,
      price: formatAmount(effectiveAmountCents),
      paymentTestMode: !!(this.env.paymentTestMode && originalAmountCents > 0),
      status: 'pending',
      prepayId: '',
      paidAt: null,
      fulfilledAt: null
    })
  }

  async findUserOrder({ userId, orderNo }) {
    const order = await this.db.findOrderByOrderNo(orderNo)
    if (!order || order.userId !== userId) return null
    return order
  }

  async attachPrepay(orderNo, { prepayId }) {
    const existing = await this.db.findOrderByOrderNo(orderNo)
    if (!existing) throw httpError('order not found', 404)
    return this.db.replace('orders', existing.id, { ...existing, prepayId })
  }

  async markPaid(orderNo, { channel = 'mock', transactionId = '', paidAt = '', notifyPayload = null } = {}) {
    const existing = await this.db.findOrderByOrderNo(orderNo)
    if (!existing) throw httpError('order not found', 404)
    let order = existing
    if (order.status !== 'paid') {
      order = await this.db.replace('orders', order.id, {
        ...order,
        status: 'paid',
        paymentChannel: channel,
        transactionId,
        paidAt: paidAt || new Date().toISOString(),
        notifyPayload
      })
    }
    if (order.fulfilledAt) return { order, fulfilled: false }
    await this.fulfill(order)
    order = await this.db.findOrderByOrderNo(orderNo)
    return { order, fulfilled: true }
  }

  async fulfill(order) {
    const product = PRODUCTS.find(item => item.id === order.productCode)
    if (!product) throw new Error('product not found')
    if (product.points) {
      await this.authService.addPoints({
        userId: order.userId,
        points: product.points,
        type: product.productType === 'point_pack' ? 'point_pack_purchase' : 'plan_purchase_bonus',
        source: 'order',
        refId: order.orderNo
      })
    }
    if (product.productType === 'plan') {
      const active = (await this.db.listActiveMemberships(order.userId))
        .sort((a, b) => {
          const rankDiff = getPlanRank(b.planCode) - getPlanRank(a.planCode)
          if (rankDiff) return rankDiff
          return String(b.expiresAt || '').localeCompare(String(a.expiresAt || ''))
        })[0]
      const base = active && active.planCode === product.planCode && new Date(active.expiresAt).getTime() > Date.now()
        ? new Date(active.expiresAt)
        : new Date()
      await this.db.create('memberships', {
        id: uuid(),
        userId: order.userId,
        planCode: product.planCode,
        planId: product.id,
        name: product.memberName,
        startsAt: base.toISOString(),
        expiresAt: addDays(base, 31).toISOString(),
        sourceOrderNo: order.orderNo
      })
    }
    await this.db.replace('orders', order.id, { ...order, fulfilledAt: new Date().toISOString() })
  }
}
