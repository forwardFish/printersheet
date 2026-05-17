const storage = require('../../utils/storage')
const billing = require('../../utils/billing')

const GUEST_AVATAR = '/assets/avatar-guest.png'
const DEFAULT_MEMBER = {
  name: 'Free',
  expire: '未购买月卡',
  points: 3
}

function maskNickname(name = '') {
  const text = String(name || '').trim()
  if (!text) return '未登录'
  if (/^[A-Za-z0-9_ -]+$/.test(text)) {
    const visible = text.replace(/\s+/g, '').slice(0, 2) || text.slice(0, 1)
    return `${visible}**`
  }
  return `${Array.from(text)[0]}**`
}

Page({
  data: {
    recordCount: 0,
    purchaseCount: 0,
    isLoggedIn: false,
    avatarUrl: GUEST_AVATAR,
    displayName: '未登录',
    displayId: '',
    memberName: DEFAULT_MEMBER.name,
    memberExpireText: DEFAULT_MEMBER.expire,
    displayPoints: DEFAULT_MEMBER.points,
    freeTip: '',
    shareStatusText: ''
  },
  onShow() {
    if (this.shareRewardPending) {
      this.shareRewardPending = false
      const result = storage.claimDailyTimelineShareReward()
      this.setData({ shareStatusText: result.message })
      wx.showToast({ title: result.success ? '+1 点已到账' : '今日已奖励', icon: result.success ? 'success' : 'none' })
    }
    this.refresh()
  },
  refresh() {
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
      displayName: isLoggedIn ? maskNickname(user.nickname || user.nickName || user.name) : '未登录',
      displayId: isLoggedIn ? (user.id || user.openid || '') : '',
      memberName: isPaid ? (member.name || member.memberName || planCode) : 'Free',
      memberExpireText: isPaid ? `到期时间：${billing.formatDate(member.planExpiresAt || member.expireAt)}` : '当前套餐：Free',
      displayPoints: storage.getPoints(),
      freeTip: isPaid ? '已解锁无水印 PDF；Pro / Teacher 可下载 Word。' : '升级后可解锁无水印 PDF、Word 下载、整卷仿真。'
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
    this.setData({ shareStatusText: '分享完成后，奖励会自动到账。' })
  },
  copyInviteLink() {
    const link = `/pages/index/index?inviteCode=${storage.getInviteCode()}`
    wx.setClipboardData({
      data: link,
      success: () => this.setData({ shareStatusText: '邀请链接已复制。好友通过你的链接首次购买成功，你获得 5 点奖励。' })
    })
  },
  onShareAppMessage() {
    return {
      title: 'AI 出题小助手',
      path: `/pages/index/index?inviteCode=${storage.getInviteCode()}`
    }
  },
  onShareTimeline() {
    return {
      title: 'AI 出题小助手：生成可打印练习卷',
      query: `inviteCode=${storage.getInviteCode()}`
    }
  },
  goHome() { wx.redirectTo({ url: '/pages/index/index' }) }
})
