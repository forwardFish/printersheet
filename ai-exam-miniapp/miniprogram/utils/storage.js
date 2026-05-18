const KEYS = {
  POINTS: 'points',
  USER: 'user',
  MEMBER: 'member',
  RECORDS: 'records',
  PURCHASES: 'purchases',
  TOKEN: 'auth_token',
  POINT_TRANSACTIONS: 'point_transactions',
  SHARE_REWARD_LOGS: 'share_reward_logs',
  INVITE_REWARD_LOGS: 'invite_reward_logs',
  INVITE_CODE: 'invite_code',
  INVITED_BY: 'invited_by_user_id'
}

const { todayKey, normalizeGenerationMode } = require('./billing')

function nowText() {
  return new Date().toLocaleString()
}

function modeLabel(mode) {
  const normalized = normalizeGenerationMode(mode)
  if (normalized === 'extended') return '加长练习卷'
  if (normalized === 'wrong_question_similar') return '错题同类题'
  if (normalized === 'upload_material') return '上传资料'
  if (normalized === 'full_paper_simulation') return '整卷仿真'
  return '普通练习卷'
}

function statusLabel(status) {
  if (status === 'paid') return '已支付'
  if (status === 'mock_paid') return '模拟支付成功'
  return status || '已记录'
}

function normalizeRecord(record = {}) {
  const worksheet = record.worksheet || null
  const questions = worksheet && worksheet.questions ? worksheet.questions : []
  const sourceFileInfo = record.sourceFileInfo || (worksheet && worksheet.sourceFileInfo) || null
  const mode = record.mode || (worksheet && worksheet.mode) || 'practice'
  return {
    ...record,
    title: record.title || (worksheet && worksheet.title) || 'AI 练习卷',
    mode,
    modeLabel: record.modeLabel || modeLabel(mode),
    questionCount: Number(record.questionCount || questions.length || 0),
    pointsUsed: Number(record.pointsUsed || 0),
    sourceFileName: record.sourceFileName || (sourceFileInfo && sourceFileInfo.name) || '',
    sourceFileType: record.sourceFileType || (sourceFileInfo && sourceFileInfo.type) || '',
    worksheet
  }
}

function normalizePurchase(purchase = {}) {
  return {
    ...purchase,
    title: purchase.title || purchase.planName || '会员套餐',
    status: purchase.status || purchase.paymentStatus || 'paid',
    statusLabel: purchase.statusLabel || statusLabel(purchase.status || purchase.paymentStatus),
    price: purchase.price || '0',
    points: Number(purchase.points || purchase.pointsAdded || 0)
  }
}

function addPointTransaction({ type, amount, relatedId = '', remark = '' }) {
  const list = wx.getStorageSync(KEYS.POINT_TRANSACTIONS) || []
  list.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    amount: Number(amount || 0),
    balanceAfter: Number(wx.getStorageSync(KEYS.POINTS) || 0),
    relatedId,
    remark,
    createdAt: nowText()
  })
  wx.setStorageSync(KEYS.POINT_TRANSACTIONS, list.slice(0, 200))
}

function initDefaults() {
  if (wx.getStorageSync(KEYS.POINTS) === '') {
    wx.setStorageSync(KEYS.POINTS, 3)
    addPointTransaction({ type: 'new_user_bonus', amount: 3, remark: '新用户注册送 3 点' })
  }
  if (!wx.getStorageSync(KEYS.RECORDS)) wx.setStorageSync(KEYS.RECORDS, [])
  if (!wx.getStorageSync(KEYS.PURCHASES)) wx.setStorageSync(KEYS.PURCHASES, [])
  if (!wx.getStorageSync(KEYS.POINT_TRANSACTIONS)) wx.setStorageSync(KEYS.POINT_TRANSACTIONS, [])
  if (!wx.getStorageSync(KEYS.SHARE_REWARD_LOGS)) wx.setStorageSync(KEYS.SHARE_REWARD_LOGS, [])
  if (!wx.getStorageSync(KEYS.INVITE_REWARD_LOGS)) wx.setStorageSync(KEYS.INVITE_REWARD_LOGS, [])
  const transactions = wx.getStorageSync(KEYS.POINT_TRANSACTIONS) || []
  const hasLegacyVisualGrant = transactions.some(item =>
    item.type === 'new_user_bonus' &&
    Number(item.amount) === 37 &&
    String(item.remark || '').indexOf('视觉演示') >= 0
  )
  if (Number(wx.getStorageSync(KEYS.POINTS)) === 37 && hasLegacyVisualGrant) {
    wx.setStorageSync(KEYS.POINTS, 3)
    addPointTransaction({ type: 'points_migration', amount: -34, remark: '旧视觉演示默认点数纠正为注册送 3 点' })
  }
}

function getPoints() { initDefaults(); return Number(wx.getStorageSync(KEYS.POINTS) || 0) }
function setPoints(n) { wx.setStorageSync(KEYS.POINTS, Math.max(0, Number(n || 0))) }
function addPoints(n, meta = {}) {
  const amount = Number(n || 0)
  setPoints(getPoints() + amount)
  addPointTransaction({ type: meta.type || 'manual_adjustment', amount, relatedId: meta.relatedId || '', remark: meta.remark || '' })
}
function consumePoints(n, meta = {}) {
  const amount = Number(n || 0)
  const p = getPoints()
  if (p < amount) return false
  setPoints(p - amount)
  addPointTransaction({ type: meta.type || 'generate_cost', amount: -amount, relatedId: meta.relatedId || '', remark: meta.remark || '' })
  return true
}
function getUser() { return wx.getStorageSync(KEYS.USER) || null }
function setUser(user) { wx.setStorageSync(KEYS.USER, user) }
function getMember() { return wx.getStorageSync(KEYS.MEMBER) || null }
function setMember(member) { wx.setStorageSync(KEYS.MEMBER, member) }
function getPointTransactions() { initDefaults(); return wx.getStorageSync(KEYS.POINT_TRANSACTIONS) || [] }
function addRecord(record) {
  const list = wx.getStorageSync(KEYS.RECORDS) || []
  list.unshift(normalizeRecord({ id: Date.now().toString(), createdAt: nowText(), ...record }))
  wx.setStorageSync(KEYS.RECORDS, list.slice(0, 50))
}
function getRecords() { return (wx.getStorageSync(KEYS.RECORDS) || []).map(normalizeRecord) }
function addPurchase(purchase) {
  const list = wx.getStorageSync(KEYS.PURCHASES) || []
  list.unshift(normalizePurchase({ id: Date.now().toString(), paidAt: nowText(), ...purchase }))
  wx.setStorageSync(KEYS.PURCHASES, list.slice(0, 50))
}
function getPurchases() { return (wx.getStorageSync(KEYS.PURCHASES) || []).map(normalizePurchase) }
function getToken() { return wx.getStorageSync(KEYS.TOKEN) || '' }
function setToken(token) { wx.setStorageSync(KEYS.TOKEN, token || '') }
function clearToken() { wx.removeStorageSync(KEYS.TOKEN) }

function getInviteCode() {
  let code = wx.getStorageSync(KEYS.INVITE_CODE)
  if (!code) {
    const user = getUser() || {}
    const base = String(user.id || user.openid || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-8)
    code = `ps${base || Math.random().toString(36).slice(2, 8)}`
    wx.setStorageSync(KEYS.INVITE_CODE, code)
  }
  return code
}

function getInvitedBy() {
  return wx.getStorageSync(KEYS.INVITED_BY) || ''
}

function bindInviter(inviteCode) {
  const ownCode = getInviteCode()
  const code = String(inviteCode || '').trim()
  if (!code) return { success: false, code: 'INVALID_INVITE_CODE', message: '邀请链接无效。' }
  if (code === ownCode) return { success: false, code: 'SELF_INVITE_NOT_ALLOWED', message: '不能邀请自己。' }
  if (getInvitedBy()) return { success: false, code: 'ALREADY_BOUND', message: '你已经绑定过邀请人。' }
  wx.setStorageSync(KEYS.INVITED_BY, code)
  return { success: true, invitedBy: code }
}

function claimDailyTimelineShareReward(date = new Date()) {
  initDefaults()
  const rewardDate = todayKey(date)
  const logs = wx.getStorageSync(KEYS.SHARE_REWARD_LOGS) || []
  const exists = logs.some(item => item.rewardDate === rewardDate && item.rewardType === 'timeline_share')
  if (exists) {
    return { success: false, code: 'ALREADY_CLAIMED', message: '你今天已经获得过分享奖励，明天再来吧。' }
  }
  addPoints(1, { type: 'daily_share_reward', remark: '每天分享奖励 1 点' })
  logs.unshift({ id: `${Date.now()}_timeline_share`, rewardDate, rewardType: 'timeline_share', points: 1, createdAt: nowText() })
  wx.setStorageSync(KEYS.SHARE_REWARD_LOGS, logs.slice(0, 100))
  return { success: true, pointsAdded: 1, pointsBalance: getPoints(), message: '分享奖励已到账，已获得 1 点。' }
}

function rewardInviterOnFirstPurchase(orderId) {
  const invitedBy = getInvitedBy()
  if (!invitedBy) return { success: false, code: 'NO_INVITER' }
  const logs = wx.getStorageSync(KEYS.INVITE_REWARD_LOGS) || []
  if (logs.some(item => item.invitedBy === invitedBy)) return { success: false, code: 'ALREADY_REWARDED' }
  logs.unshift({ id: `${Date.now()}_invite_purchase`, invitedBy, orderId, points: 5, createdAt: nowText() })
  wx.setStorageSync(KEYS.INVITE_REWARD_LOGS, logs.slice(0, 100))
  return { success: true, invitedBy, points: 5 }
}

module.exports = {
  initDefaults,
  getPoints,
  setPoints,
  addPoints,
  consumePoints,
  getPointTransactions,
  getUser,
  setUser,
  getMember,
  setMember,
  addRecord,
  getRecords,
  addPurchase,
  getPurchases,
  getToken,
  setToken,
  clearToken,
  getInviteCode,
  bindInviter,
  getInvitedBy,
  claimDailyTimelineShareReward,
  rewardInviterOnFirstPurchase
}
