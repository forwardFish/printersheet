import crypto from 'crypto'
import { v4 as uuid } from 'uuid'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export class AuthService {
  constructor({ db, env }) {
    this.db = db
    this.env = env
  }

  createToken(user) {
    const payload = base64url(JSON.stringify({ userId: user.id, openid: user.openid, iat: Date.now() }))
    return `${payload}.${sign(payload, this.env.authSecret)}`
  }

  async verifyToken(token) {
    const [payload, signature] = String(token || '').split('.')
    if (!payload || !signature || sign(payload, this.env.authSecret) !== signature) return null
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const user = await this.db.findUserById(parsed.userId)
    if (!user) return null
    return user
  }

  async login({ code, mockOpenid, userInfo = {} } = {}) {
    if (this.env.nodeEnv === 'production' && mockOpenid) {
      const error = new Error('mock openid is forbidden in production')
      error.statusCode = 400
      throw error
    }
    const openid = String(mockOpenid || code || '').trim() || (this.env.nodeEnv === 'production' ? '' : 'dev-mock-openid')
    if (!openid) {
      const error = new Error('wechat login code is required')
      error.statusCode = 400
      throw error
    }
    let user = await this.db.findUserByOpenid(openid)
    let firstLogin = false
    if (!user) {
      firstLogin = true
      user = await this.db.create('users', {
        id: uuid(),
        openid,
        nickname: userInfo.nickName || userInfo.nickname || 'Wechat User',
        avatarUrl: userInfo.avatarUrl || ''
      })
      await this.db.create('point_accounts', { id: uuid(), userId: user.id, balance: 0 })
      await this.addPoints({ userId: user.id, points: 3, type: 'grant', source: 'new_user_bonus', refId: user.id })
    }
    return { token: this.createToken(user), user, firstLogin }
  }

  async addPoints({ userId, points, type, source, refId, requestId }) {
    const account = await this.db.getPointAccount(userId)
    const nextBalance = Number(account?.balance || 0) + Number(points || 0)
    await this.db.setPointBalance(userId, nextBalance)
    return this.db.create('point_ledger', {
      id: uuid(),
      userId,
      type,
      points: Number(points || 0),
      balanceAfter: nextBalance,
      source,
      refId,
      requestId: requestId || ''
    })
  }

  async consumePoints({ userId, points, source, refId, requestId }) {
    const account = await this.db.getPointAccount(userId)
    const balance = Number(account?.balance || 0)
    const amount = Number(points || 0)
    if (balance < amount) {
      const error = new Error('insufficient points')
      error.statusCode = 402
      throw error
    }
    const nextBalance = balance - amount
    await this.db.setPointBalance(userId, nextBalance)
    return this.db.create('point_ledger', {
      id: uuid(),
      userId,
      type: 'consume',
      points: -amount,
      balanceAfter: nextBalance,
      source,
      refId,
      requestId
    })
  }

  async refundPoints({ userId, points, source, refId, requestId }) {
    return this.addPoints({ userId, points, type: 'refund', source, refId, requestId })
  }
}
