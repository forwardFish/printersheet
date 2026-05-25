const DAILY_SHARE_POINTS = 1
const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

function dateKeyInTimeZone(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function normalizeChannel(channel = '') {
  const value = String(channel || '').trim().toLowerCase()
  return value.replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'timeline'
}

function shareRewardId({ userId, rewardDate, channel }) {
  return `daily_share_${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${rewardDate}_${channel}`
}

export class RewardService {
  constructor({ db, authService, timeZone = DEFAULT_TIME_ZONE }) {
    this.db = db
    this.authService = authService
    this.timeZone = timeZone
  }

  async claimDailyShareReward({ userId, channel = 'timeline', now = new Date() }) {
    const normalizedChannel = normalizeChannel(channel)
    const rewardDate = dateKeyInTimeZone(now, this.timeZone)
    const baseRecord = {
      id: shareRewardId({ userId, rewardDate, channel: normalizedChannel }),
      userId,
      rewardDate,
      channel: normalizedChannel,
      rewardType: 'daily_share',
      points: DAILY_SHARE_POINTS,
      status: 'granted'
    }
    const result = await this.db.createShareRewardLogIfAbsent(baseRecord)
    const account = await this.db.getPointAccount(userId)
    if (!result.created) {
      return {
        success: true,
        claimed: false,
        code: 'ALREADY_CLAIMED',
        message: 'daily share reward already claimed today',
        pointsAdded: 0,
        pointsBalance: Number(account?.balance || 0),
        rewardLog: result.record
      }
    }
    await this.authService.addPoints({
      userId,
      points: DAILY_SHARE_POINTS,
      type: 'grant',
      source: 'daily_share',
      refId: result.record.id,
      requestId: result.record.id
    })
    const updated = await this.db.getPointAccount(userId)
    return {
      success: true,
      claimed: true,
      message: 'daily share reward granted',
      pointsAdded: DAILY_SHARE_POINTS,
      pointsBalance: Number(updated?.balance || 0),
      rewardLog: result.record
    }
  }
}

export { dateKeyInTimeZone, normalizeChannel }
