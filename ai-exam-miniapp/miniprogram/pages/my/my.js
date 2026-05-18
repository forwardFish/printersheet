const storage = require('../../utils/storage')
const billing = require('../../utils/billing')
const api = require('../../services/api')
const modal = require('../../utils/modal')
const share = require('../../utils/share')

const GUEST_AVATAR = '/assets/avatar-guest.png'
const SHARE_STATUS_CLEAR_MS = 2600
const DEFAULT_MEMBER = {
  name: 'pro',
  expire: '到期时间： 2026-06-17',
  points: 3
}

function maskNickname(name = '') {
  const text = String(name || '').trim()
  if (!text) return 'We**'
  if (/^[A-Za-z0-9_ -]+$/.test(text)) {
    const visible = text.replace(/\s+/g, '').slice(0, 2) || text.slice(0, 1)
    return `${visible}**`
  }
  return `${Array.from(text)[0]}**`
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
    isLoggedIn: true,
    avatarUrl: GUEST_AVATAR,
    displayName: 'We**',
    displayId: '104a9c90-5fc0-461e-995a-42928a37b2c5',
    memberName: DEFAULT_MEMBER.name,
    memberExpireText: DEFAULT_MEMBER.expire,
    displayPoints: DEFAULT_MEMBER.points,
    freeTip: '已解锁后端权益，下载权限以后端判断为准。',
    shareStatusText: '',
    showShareMock: false
  },
  onLoad() {
    share.enableShareMenu()
  },
  onShow() {
    share.enableShareMenu()
    if (this.shareRewardPending) {
      this.shareRewardPending = false
      const result = storage.claimDailyTimelineShareReward()
      setTemporaryShareStatus(this, result.message)
      modal.showTip(result.success ? '+1 点已到账' : '今日已奖励')
    }
    this.refresh()
  },
  async refresh() {
    if (storage.getToken()) {
      try {
        const [me, worksheets, orders] = await Promise.all([api.getMe(), api.getWorksheets(), api.getOrders()])
        const user = me.user || storage.getUser() || {}
        this.setData({
          recordCount: (worksheets.records || []).length,
          purchaseCount: (orders.orders || []).length,
          isLoggedIn: true,
          avatarUrl: user.avatarUrl || user.avatar || GUEST_AVATAR,
          displayName: maskNickname(user.nickname || user.nickName || user.name || 'We'),
          displayId: user.id || user.openid || '104a9c90-5fc0-461e-995a-42928a37b2c5',
          memberName: me.isPaid ? me.planCode : 'pro',
          memberExpireText: me.isPaid ? `到期时间： ${billing.formatDate(me.planExpiresAt)}` : DEFAULT_MEMBER.expire,
          displayPoints: me.pointsBalance ?? storage.getPoints(),
          freeTip: '已解锁后端权益，下载权限以后端判断为准。'
        })
        return
      } catch (e) {
        modal.showError(e.message || '同步失败', { title: '同步失败' })
      }
    }
    const records = storage.getRecords()
    const purchases = storage.getPurchases()
    const user = storage.getUser()
    const member = storage.getMember()
    const isLoggedIn = !!(user && (user.nickname || user.avatar || user.id || user.openid))
    const planCode = billing.getPlanCode(member)
    const isPaid = billing.isPaidPlan(member)
    this.setData({
      recordCount: records.length,
      purchaseCount: purchases.length,
      isLoggedIn,
      avatarUrl: isLoggedIn ? (user.avatar || user.avatarUrl || GUEST_AVATAR) : GUEST_AVATAR,
      displayName: isLoggedIn ? maskNickname(user.nickname || user.nickName || user.name) : 'We**',
      displayId: isLoggedIn ? (user.id || user.openid || '') : '104a9c90-5fc0-461e-995a-42928a37b2c5',
      memberName: isPaid ? (member.name || member.memberName || planCode) : 'pro',
      memberExpireText: isPaid ? `到期时间： ${billing.formatDate(member.planExpiresAt || member.expireAt)}` : DEFAULT_MEMBER.expire,
      displayPoints: storage.getPoints(),
      freeTip: '已解锁后端权益，下载权限以后端判断为准。'
    })
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
