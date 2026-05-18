const storage = require('../../utils/storage')
const api = require('../../services/api')
const config = require('../../utils/config')
const modal = require('../../utils/modal')

const DEFAULT_AFTER_LOGIN = '/pages/my/my'

function maskId(raw = '') {
  const text = String(raw || '').trim()
  return text ? text.slice(-6) : ''
}

function persistLogin(data, userInfo = {}, fallbackId = '') {
  storage.setToken(data.token || 'local-token')
  storage.setUser({
    ...(data.user || {}),
    nickname: userInfo.nickName || (data.user && data.user.nickname) || '微信用户',
    avatar: userInfo.avatarUrl || (data.user && data.user.avatarUrl) || '/assets/avatar-guest.png',
    id: (data.user && data.user.id) || maskId(fallbackId) || '104a9c90-5fc0-461e-995a-42928a37b2c5'
  })
}

function safeDecode(value = '') {
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

function normalizeRedirectUrl(value = '') {
  const url = String(safeDecode(value) || '').trim()
  if (!url || !url.startsWith('/pages/')) return ''
  if (url.indexOf('/pages/login/login') === 0) return ''
  return url
}

function afterLogin(page) {
  const redirectUrl = normalizeRedirectUrl(page.data.redirectUrl)
  if (redirectUrl) {
    wx.redirectTo({ url: redirectUrl })
    return
  }

  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pages.length > 1) {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.redirectTo({ url: DEFAULT_AFTER_LOGIN })
    })
    return
  }

  wx.redirectTo({ url: DEFAULT_AFTER_LOGIN })
}

Page({
  data: {
    agreed: false,
    mockLoginEnabled: !!config.USE_MOCK_LOGIN,
    redirectUrl: ''
  },
  onLoad(options = {}) {
    const redirectUrl = options.redirect || options.redirectUrl || options.returnUrl || ''
    this.setData({ redirectUrl: normalizeRedirectUrl(redirectUrl) })
  },
  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },
  ensureAgreed() {
    if (this.data.agreed) return true
    modal.showTip('请先阅读并同意用户协议和隐私政策。')
    return false
  },
  async mockLogin() {
    if (!this.ensureAgreed()) return
    wx.showLoading({ title: '登录中...' })
    try {
      const mockOpenid = '104a9c90-5fc0-461e-995a-42928a37b2c5'
      const data = await api.loginWechat({ mockOpenid, userInfo: { nickName: 'We', avatarUrl: '/assets/avatar-guest.png' } })
      persistLogin(data, { nickName: 'We', avatarUrl: '/assets/avatar-guest.png' }, mockOpenid)
      wx.hideLoading()
      afterLogin(this)
    } catch (e) {
      wx.hideLoading()
      modal.showError(e.message || '登录失败', { title: '登录失败' })
    }
  },
  login() {
    if (!this.ensureAgreed()) return
    wx.getUserProfile({
      desc: '用于展示微信头像和昵称',
      success: profileRes => {
        wx.showLoading({ title: '登录中...' })
        wx.login({
          success: async loginRes => {
            const userInfo = profileRes.userInfo || {}
            try {
              const data = await api.loginWechat({ code: loginRes.code, mockOpenid: config.USE_MOCK_LOGIN ? loginRes.code : '', userInfo })
              persistLogin(data, userInfo, loginRes.code)
              wx.hideLoading()
              afterLogin(this)
            } catch (e) {
              wx.hideLoading()
              modal.showError(e.message || '登录失败', { title: '登录失败' })
            }
          },
          fail: () => {
            wx.hideLoading()
            modal.showError('微信登录失败，请稍后重试。', { title: '登录失败' })
          }
        })
      },
      fail: () => {
        if (config.USE_MOCK_LOGIN) this.mockLogin()
        else modal.showTip('已取消微信授权。')
      }
    })
  }
})
