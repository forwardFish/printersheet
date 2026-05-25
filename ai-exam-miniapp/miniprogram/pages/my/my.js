const storage = require('../../utils/storage')
const billing = require('../../utils/billing')
const api = require('../../services/api')
const modal = require('../../utils/modal')
const share = require('../../utils/share')
const { getPlanDisplayName } = require('../../utils/plans')

const GUEST_AVATAR = '/assets/avatar-guest.png'
const SHARE_STATUS_CLEAR_MS = 2600
const DEFAULT_MEMBER = {
  name: '免费体验',
  expire: '登录后查看会员权益',
  points: 3
}
const GENERIC_NICKNAMES = new Set(['微信用户', 'Wechat User', 'WeChat User'])

function isRealNickname(name = '') {
  const text = String(name || '').trim()
  return !!(text && !GENERIC_NICKNAMES.has(text))
}

function displayNickname(name = '') {
  const text = String(name || '').trim()
  return isRealNickname(text) ? text : '未设置昵称'
}

function displayAvatar(user = {}) {
  return user.avatarUrl || user.avatar || GUEST_AVATAR
}

function hasRealAvatar(user = {}) {
  const avatar = user.avatarUrl || user.avatar || ''
  return !!(avatar && avatar !== GUEST_AVATAR)
}

function profileHintFor(user = {}) {
  if (isRealNickname(user.nickname || user.nickName || user.name) && hasRealAvatar(user)) return '真实微信头像昵称已同步'
  return '请选择微信头像并填写昵称'
}

function isAuthError(error) {
  const message = String((error && (error.message || error.errMsg || error.code)) || error || '')
  return /unauthorized|401|403|token|auth|鉴权|授权|登录/i.test(message)
}

function clearLoginState() {
  storage.clearToken()
  storage.setUser(null)
}

function guestProfilePatch(records = storage.getRecords(), purchases = storage.getPurchases()) {
  return {
    recordCount: records.length,
    purchaseCount: purchases.length,
    isLoggedIn: false,
    avatarUrl: GUEST_AVATAR,
    displayName: '未登陆',
    loginStateText: '未登陆',
    profileHint: '点击登录，同步微信头像和昵称',
    memberName: DEFAULT_MEMBER.name,
    memberExpireText: DEFAULT_MEMBER.expire,
    displayPoints: storage.getPoints(),
    freeTip: '登录后同步点数、套餐和生成记录。'
  }
}

function setTemporaryShareStatus(page, message) {
  if (page.shareStatusTimer) clearTimeout(page.shareStatusTimer)
  page.setData({ shareStatusText: message })
  page.shareStatusTimer = setTimeout(() => {
    page.shareStatusTimer = null
    page.setData({ shareStatusText: '' })
  }, SHARE_STATUS_CLEAR_MS)
}

Page({
  data: {
    recordCount: 0,
    purchaseCount: 0,
    isLoggedIn: false,
    avatarUrl: GUEST_AVATAR,
    displayName: '未登陆',
    loginStateText: '未登陆',
    profileHint: '点击登录，同步微信头像和昵称',
    memberName: DEFAULT_MEMBER.name,
    memberExpireText: DEFAULT_MEMBER.expire,
    displayPoints: DEFAULT_MEMBER.points,
    freeTip: '登录后同步点数、套餐和生成记录。',
    shareStatusText: '',
    showShareMock: false
  },
  onLoad() {
    share.enableShareMenu()
  },
  async onShow() {
    share.enableShareMenu()
    if (this.shareRewardPending) {
      this.shareRewardPending = false
      await this.claimDailyShareReward()
    }
    this.refresh()
  },
  async claimDailyShareReward() {
    try {
      const result = storage.getToken()
        ? await api.claimDailyShareReward('timeline')
        : storage.claimDailyTimelineShareReward()
      const granted = result.claimed === true || Number(result.pointsAdded || 0) > 0
      if (typeof result.pointsBalance === 'number') this.setData({ displayPoints: result.pointsBalance })
      setTemporaryShareStatus(this, result.message)
      modal.showTip(granted ? '+1 点已到账' : '今日已奖励')
    } catch (e) {
      if (isAuthError(e)) {
        clearLoginState()
        this.setData(guestProfilePatch())
        setTemporaryShareStatus(this, '登录已过期，请重新登录')
        return
      }
      setTemporaryShareStatus(this, e.message || '分享奖励同步失败')
      modal.showError(e.message || '分享奖励同步失败', { title: '奖励同步失败' })
    }
  },
  async refresh() {
    const cachedUser = storage.getUser()
    if (storage.getToken() && cachedUser) {
      const nickname = cachedUser.nickname || cachedUser.nickName || cachedUser.name
      this.setData({
        isLoggedIn: true,
        avatarUrl: displayAvatar(cachedUser),
        displayName: displayNickname(nickname)
      })
    }

    if (storage.getToken()) {
      try {
        const [me, worksheets, orders] = await Promise.all([api.getMe(), api.getWorksheets(), api.getOrders()])
        const user = { ...(cachedUser || {}), ...(me.user || {}) }
        const nickname = user.nickname || user.nickName || user.name
        storage.setUser(user)
        this.setData({
          recordCount: (worksheets.records || []).length,
          purchaseCount: (orders.orders || []).length,
          isLoggedIn: true,
          avatarUrl: displayAvatar(user),
          displayName: displayNickname(nickname),
          loginStateText: '微信已登录',
          profileHint: profileHintFor(user),
          memberName: me.isPaid ? getPlanDisplayName(me.planCode) : DEFAULT_MEMBER.name,
          memberExpireText: me.isPaid ? `到期时间： ${billing.formatDate(me.planExpiresAt)}` : DEFAULT_MEMBER.expire,
          displayPoints: me.pointsBalance ?? storage.getPoints(),
          freeTip: '已解锁后端权益，下载权限以后端判断为准。'
        })
        return
      } catch (e) {
        if (isAuthError(e)) {
          clearLoginState()
          this.setData(guestProfilePatch())
          return
        }
        if (cachedUser) return
        modal.showError(e.message || '同步失败', { title: '同步失败' })
      }
    }

    const records = storage.getRecords()
    const purchases = storage.getPurchases()
    this.setData(guestProfilePatch(records, purchases))
  },
  ensureLogin() {
    if (this.data.isLoggedIn) return
    wx.navigateTo({ url: '/pages/login/login' })
  },
  goPackages() { wx.navigateTo({ url: '/pages/packages/packages' }) },
  goRecords() { wx.navigateTo({ url: '/pages/records/records' }) },
  goPurchases() { wx.navigateTo({ url: '/pages/purchase-records/purchase-records' }) },
  markShareIntent() {
    this.shareRewardPending = true
    this.setData({ showShareMock: true })
    setTemporaryShareStatus(this, '分享完成后，奖励会自动到账。')
  },
  closeShareMock() {
    this.setData({ showShareMock: false })
  },
  sharePosterToTimeline() {
    share.enableShareMenu()
    if (!wx.showShareImageMenu || !wx.getImageInfo) {
      modal.showTip('请点击右上角菜单，选择“分享到朋友圈”。')
      return
    }
    wx.getImageInfo({
      src: share.SHARE_POSTER_IMAGE,
      success: res => {
        wx.showShareImageMenu({
          path: res.path,
          fail: () => modal.showTip('请点击右上角菜单，选择“分享到朋友圈”。')
        })
      },
      fail: () => modal.showTip('海报加载失败，请稍后重试。')
    })
  },
  copyInviteLink() {
    const link = `/pages/index/index?inviteCode=${storage.getInviteCode()}`
    wx.setClipboardData({
      data: link,
      showToast: false,
      success: () => setTemporaryShareStatus(this, '邀请链接已复制，可发给好友。')
    })
  },
  onShareAppMessage() {
    return share.appShare(storage.getInviteCode())
  },
  onShareTimeline() {
    return share.timelineShare(storage.getInviteCode())
  },
  goHome() { wx.redirectTo({ url: '/pages/index/index' }) }
})
