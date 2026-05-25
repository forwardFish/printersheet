const storage = require('../../utils/storage')
const api = require('../../services/api')
const config = require('../../utils/config')
const modal = require('../../utils/modal')

const DEFAULT_AFTER_LOGIN = '/pages/my/my'
const HOME_PAGE = '/pages/index/index'
const DEFAULT_AVATAR = '/assets/avatar.png'

function maskId(raw = '') {
  const text = String(raw || '').trim()
  return text ? text.slice(-6) : ''
}

function persistLogin(data, userInfo = {}, fallbackId = '') {
  const token = String(data.token || '').trim()
  if (!token) throw new Error('登录失败，请重新登录。')
  const nickname = String(userInfo.nickName || userInfo.nickname || (data.user && data.user.nickname) || '').trim()
  const avatarUrl = userInfo.avatarUrl || (data.user && (data.user.avatarUrl || data.user.avatar)) || DEFAULT_AVATAR
  storage.setToken(token)
  storage.setUser({
    ...(data.user || {}),
    nickname,
    nickName: nickname,
    avatarUrl,
    avatar: avatarUrl,
    id: (data.user && data.user.id) || maskId(fallbackId) || ''
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
  wx.showToast({ title: '登录成功', icon: 'success', duration: 900 })
  const redirectUrl = normalizeRedirectUrl(page.data.redirectUrl)
  const goNext = () => {
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
  setTimeout(goNext, 300)
}

Page({
  data: {
    agreed: false,
    redirectUrl: '',
    showTermsPopup: true,
    pendingLoginAfterConsent: false,
    showProfilePopup: false,
    avatarUrl: DEFAULT_AVATAR,
    nickname: '',
    hasChosenAvatar: false,
    profileSubmitting: false
  },
  onLoad(options = {}) {
    const redirectUrl = options.redirect || options.redirectUrl || options.returnUrl || ''
    this.setData({ redirectUrl: normalizeRedirectUrl(redirectUrl) })
  },
  toggleAgree() {
    const nextAgreed = !this.data.agreed
    this.setData({
      agreed: nextAgreed,
      showTermsPopup: nextAgreed ? false : this.data.showTermsPopup,
      pendingLoginAfterConsent: nextAgreed ? false : this.data.pendingLoginAfterConsent
    })
  },
  noop() {},
  showTermsPrompt(pendingLoginAfterConsent = false) {
    this.setData({
      showTermsPopup: true,
      pendingLoginAfterConsent
    })
  },
  agreeTermsAndContinue() {
    const shouldContinueLogin = this.data.pendingLoginAfterConsent
    this.setData({
      agreed: true,
      showTermsPopup: false,
      pendingLoginAfterConsent: false
    })
    if (shouldContinueLogin) {
      this.setData({ showProfilePopup: true })
    }
  },
  cancelTermsPrompt() {
    this.setData({
      agreed: false,
      showTermsPopup: false,
      pendingLoginAfterConsent: false,
      showProfilePopup: false
    })
    wx.showToast({ title: '已取消登录', icon: 'none', duration: 900 })
    setTimeout(() => {
      wx.reLaunch({
        url: HOME_PAGE,
        fail: () => wx.redirectTo({ url: HOME_PAGE })
      })
    }, 260)
  },
  ensureAgreed() {
    if (this.data.agreed) return true
    this.showTermsPrompt(true)
    return false
  },
  ensureProfile(nickname = this.data.nickname) {
    if (!this.data.hasChosenAvatar || !this.data.avatarUrl || this.data.avatarUrl === DEFAULT_AVATAR) {
      modal.showTip('请先选择微信头像。')
      return false
    }
    if (!String(nickname || '').trim()) {
      modal.showTip('请先选择或填写微信昵称。')
      return false
    }
    return true
  },
  onChooseAvatar(e) {
    const avatarUrl = e && e.detail && e.detail.avatarUrl
    if (!avatarUrl) return
    this.setData({ avatarUrl, hasChosenAvatar: true })
  },
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },
  closeProfilePopup() {
    if (this.data.profileSubmitting) return
    this.setData({ showProfilePopup: false })
  },
  login() {
    if (!this.ensureAgreed()) return
    this.setData({ showProfilePopup: true })
  },
  goHome() {
    wx.reLaunch({
      url: HOME_PAGE,
      fail: () => wx.redirectTo({ url: HOME_PAGE })
    })
  },
  confirmProfileLogin(e) {
    const formNickname = e && e.detail && e.detail.value && e.detail.value.nickname
    const nickname = String(formNickname || this.data.nickname || '').trim()
    if (!this.ensureProfile(nickname)) return
    const userInfo = { nickName: nickname, avatarUrl: this.data.avatarUrl }
    this.setData({ profileSubmitting: true })
    wx.showLoading({ title: '登录中...' })
    wx.login({
      success: async loginRes => {
        try {
          const data = await api.loginWechat({
            code: loginRes.code,
            userInfo,
            mockOpenid: config.USE_MOCK_LOGIN ? loginRes.code : ''
          })
          persistLogin(data, userInfo, loginRes.code)
          this.setData({ profileSubmitting: false, showProfilePopup: false })
          wx.hideLoading()
          afterLogin(this)
        } catch (e) {
          this.setData({ profileSubmitting: false, showProfilePopup: false })
          wx.hideLoading()
          modal.showError(e.message || '登录失败', { title: '登录失败' })
        }
      },
      fail: () => {
        this.setData({ profileSubmitting: false })
        wx.hideLoading()
        modal.showError('微信登录失败，请稍后重试。', { title: '登录失败' })
      }
    })
  }
})
