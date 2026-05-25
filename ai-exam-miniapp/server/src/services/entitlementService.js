import { getPlanRank } from '../lib/plans.js'

export class EntitlementService {
  constructor({ db }) {
    this.db = db
  }

  async getActiveMembership(userId) {
    const memberships = await this.db.listActiveMemberships(userId)
    return memberships.sort((a, b) => {
      const rankDiff = getPlanRank(b.planCode) - getPlanRank(a.planCode)
      if (rankDiff) return rankDiff
      return String(b.expiresAt || '').localeCompare(String(a.expiresAt || ''))
    })[0] || null
  }

  async getEntitlements(userId) {
    const account = await this.db.getPointAccount(userId)
    const membership = await this.getActiveMembership(userId)
    const planCode = membership?.planCode || 'free'
    return {
      planCode,
      membership,
      planExpiresAt: membership?.expiresAt || null,
      pointsBalance: Number(account?.balance || 0),
      isPaid: planCode !== 'free',
      canRemoveWatermark: planCode !== 'free',
      canDownloadWord: ['pro', 'teacher'].includes(planCode)
    }
  }
}
