import { v4 as uuid } from 'uuid'
import { POINT_PACKS, PRICING_PLANS } from '../lib/plans.js'

const PRODUCTS = [...PRICING_PLANS, ...POINT_PACKS]

function amountCents(price) {
  return Math.round(Number(price || 0) * 100)
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export class OrderService {
  constructor({ db, authService }) {
    this.db = db
    this.authService = authService
  }

  listProducts() {
    return PRODUCTS.map(product => ({
      ...product,
      productCode: product.id,
      amountCents: amountCents(product.price)
    }))
  }

  createOrder({ userId, productCode }) {
    const product = PRODUCTS.find(item => item.id === productCode)
    if (!product) {
      const error = new Error('product not found')
      error.statusCode = 404
      throw error
    }
    return this.db.create('orders', {
      id: uuid(),
      orderNo: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      productCode: product.id,
      productType: product.productType,
      productName: product.name,
      planCode: product.planCode || '',
      points: Number(product.points || 0),
      amountCents: amountCents(product.price),
      price: product.price,
      status: 'pending',
      paidAt: null,
      fulfilledAt: null
    })
  }

  async markPaid(orderNo, { channel = 'mock' } = {}) {
    const existing = await this.db.findOrderByOrderNo(orderNo)
    if (!existing) {
      const error = new Error('order not found')
      error.statusCode = 404
      throw error
    }
    let order = existing
    if (order.status !== 'paid') {
      order = await this.db.replace('orders', order.id, { ...order, status: 'paid', paymentChannel: channel, paidAt: new Date().toISOString() })
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
      const existing = (await this.db.listActiveMemberships(order.userId))
        .find(item => item.planCode === product.planCode)
      const base = existing && new Date(existing.expiresAt).getTime() > Date.now()
        ? new Date(existing.expiresAt)
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
