import crypto from 'crypto'
import https from 'https'
import { v4 as uuid } from 'uuid'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function httpError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function readHttpsJson(url, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      family: 4,
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json'
      }
    }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () => {
        let data = {}
        try {
          data = body ? JSON.parse(body) : {}
        } catch (e) {
          reject(httpError(`wechat code2Session response is not JSON: ${e.message || body}`, 502))
          return
        }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data })
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('request timeout'))
    })
    req.on('error', reject)
    req.end()
  })
}

function wechatNetworkError(error) {
  const message = error && error.message ? error.message : String(error || 'unknown')
  return httpError(`微信登录网络请求失败：后端无法访问 api.weixin.qq.com（${message}）。请检查云托管服务出网/DNS/TLS 配置，或重新部署后端后重试。`, 502)
}

function friendlyWechatSessionError(data = {}) {
  const errcode = data.errcode
  const errmsg = String(data.errmsg || '').trim()
  const lower = errmsg.toLowerCase()
  if (lower.includes('resource is not found') || lower.includes('reource is not found')) {
    return '微信登录配置不可用：code2Session 返回 resource not found。请确认后端 WECHAT_APP_ID/WECHAT_APP_SECRET 与当前小程序 AppID 一致，并重启后端。'
  }
  if (errcode === 40029) return '微信登录 code 已失效或无效，请重新点击登录。'
  if (errcode === 40125) return '微信 AppSecret 无效，请在后端重新配置 WECHAT_APP_SECRET。'
  if (errcode === 40013) return '微信 AppID 无效，请确认后端 WECHAT_APP_ID 与小程序项目 AppID 一致。'
  return `wechat code2Session failed: ${errcode} ${errmsg}`.trim()
}

function publicUser(user) {
  if (!user) return user
  const { sessionKey, ...safeUser } = user
  return safeUser
}

function cleanProfileText(value = '', maxLength = 80) {
  return String(value || '').trim().slice(0, maxLength)
}

export class AuthService {
  constructor({ db, env, fetchImpl = globalThis.fetch }) {
    this.db = db
    this.env = env
    this.fetchImpl = fetchImpl
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
    return publicUser(user)
  }

  async exchangeWechatCode(code) {
    if (!this.env.wechatAppId || !this.env.wechatAppSecret) {
      throw httpError('WECHAT_APP_ID/WECHAT_APP_SECRET is not configured', 500)
    }
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
    url.searchParams.set('appid', this.env.wechatAppId)
    url.searchParams.set('secret', this.env.wechatAppSecret)
    url.searchParams.set('js_code', code)
    url.searchParams.set('grant_type', 'authorization_code')
    let data
    let status
    let ok
    try {
      const res = await this.fetchImpl(url)
      data = await res.json().catch(() => ({}))
      status = res.status
      ok = res.ok
    } catch (fetchError) {
      try {
        const fallback = await readHttpsJson(url)
        data = fallback.data
        status = fallback.status
        ok = fallback.ok
      } catch (httpsError) {
        throw wechatNetworkError(httpsError || fetchError)
      }
    }
    if (!ok) throw httpError(`wechat code2Session HTTP ${status}`, 502)
    if (data.errcode) throw httpError(friendlyWechatSessionError(data), 401)
    if (!data.openid) throw httpError('wechat code2Session response missing openid', 502)
    return data
  }

  async login({ code, mockOpenid, userInfo = {} } = {}) {
    if (this.env.nodeEnv === 'production' && mockOpenid) {
      throw httpError('mock openid is forbidden in production', 400)
    }
    const loginCode = String(code || '').trim()
    if (!mockOpenid && !loginCode) {
      throw httpError('wechat login code is required', 400)
    }
    const wechatSession = mockOpenid
      ? { openid: String(mockOpenid).trim(), unionid: '', session_key: '' }
      : await this.exchangeWechatCode(loginCode)
    const openid = String(wechatSession.openid || '').trim()
    if (!openid) {
      throw httpError('wechat login code is required', 400)
    }
    let user = await this.db.findUserByOpenid(openid)
    let firstLogin = false
    const sessionPatch = {
      nickname: userInfo.nickName || userInfo.nickname || user?.nickname || '',
      avatarUrl: userInfo.avatarUrl || user?.avatarUrl || '',
      unionid: wechatSession.unionid || user?.unionid || '',
      sessionKey: wechatSession.session_key || user?.sessionKey || '',
      sessionKeyUpdatedAt: wechatSession.session_key ? new Date().toISOString() : user?.sessionKeyUpdatedAt
    }
    if (!user) {
      firstLogin = true
      user = await this.db.create('users', {
        id: uuid(),
        openid,
        ...sessionPatch
      })
      await this.db.create('point_accounts', { id: uuid(), userId: user.id, balance: 0 })
      await this.addPoints({ userId: user.id, points: 3, type: 'grant', source: 'new_user_bonus', refId: user.id })
    } else {
      user = await this.db.update('users', user.id, sessionPatch)
    }
    return { token: this.createToken(user), user: publicUser(user), firstLogin }
  }

  async updateProfile(userId, { nickname = '', avatarUrl = '' } = {}) {
    const user = await this.db.findUserById(userId)
    if (!user) throw httpError('user not found', 404)
    const patch = {}
    const nextNickname = cleanProfileText(nickname, 40)
    const nextAvatarUrl = cleanProfileText(avatarUrl, 500)
    if (nextNickname) patch.nickname = nextNickname
    if (nextAvatarUrl) patch.avatarUrl = nextAvatarUrl
    if (!Object.keys(patch).length) throw httpError('profile data is required', 400)
    const updated = await this.db.update('users', user.id, patch)
    return publicUser(updated)
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
