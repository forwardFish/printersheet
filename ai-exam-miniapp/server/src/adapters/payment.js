export class MockPaymentProvider {
  constructor({ db, orderService }) {
    this.db = db
    this.orderService = orderService
  }

  async markSuccess(orderNo) {
    return this.orderService.markPaid(orderNo, { channel: 'mock' })
  }
}

export class WechatPaymentProvider {
  async markSuccess() {
    throw new Error('Wechat Pay provider is not configured in phase 1')
  }
}
