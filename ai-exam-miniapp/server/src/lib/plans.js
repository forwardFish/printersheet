export const PRICING_PLANS = [
  {
    id: 'starter_monthly',
    name: 'Starter',
    billing: 'month',
    productType: 'plan',
    planCode: 'starter',
    price: '9.9',
    points: 30,
    memberName: 'Starter 月卡',
    benefits: ['每月 30 点', '适合轻量练习', 'PDF 无水印', '暂不支持 Word']
  },
  {
    id: 'pro_monthly',
    name: 'Pro',
    billing: 'month',
    productType: 'plan',
    planCode: 'pro',
    price: '19.9',
    points: 80,
    memberName: 'Pro 月卡',
    recommend: true,
    benefits: ['每月 80 点', '约可生成 80 份普通练习卷，或 8 份整卷仿真', '无水印 PDF', 'Word 下载', '完整答案解析']
  },
  {
    id: 'teacher_monthly',
    name: 'Teacher',
    billing: 'month',
    productType: 'plan',
    planCode: 'teacher',
    price: '39.9',
    points: 200,
    memberName: 'Teacher 月卡',
    benefits: ['每月 200 点', '适合老师和家教', '整卷仿真', 'Word 下载', '批量使用']
  }
]

export const POINT_PACKS = [
  { id: 'small_pack', name: '小加量包', productType: 'point_pack', billing: 'once', price: '9.9', points: 25, memberName: '小加量包', benefits: ['立即到账 25 点', '不改变当前套餐'] },
  { id: 'large_pack', name: '大加量包', productType: 'point_pack', billing: 'once', price: '29.9', points: 100, memberName: '大加量包', benefits: ['立即到账 100 点', '不改变当前套餐'] }
]

export function getPlansByBilling() {
  return {
    month: PRICING_PLANS,
    pointPacks: POINT_PACKS
  }
}

export function createMockPurchase(productCode) {
  const product = [...PRICING_PLANS, ...POINT_PACKS].find(item => item.id === productCode)
  if (!product) throw new Error('商品不存在')
  const paidAt = new Date()
  const expireAt = product.productType === 'plan'
    ? new Date(paidAt.getTime() + 31 * 24 * 3600 * 1000)
    : null
  return {
    success: true,
    orderId: `mock_${paidAt.getTime()}`,
    paymentStatus: 'paid',
    product,
    plan: product,
    member: product.productType === 'plan'
      ? {
          name: product.memberName,
          planId: product.id,
          planCode: product.planCode,
          expireAt: expireAt.toISOString().slice(0, 10)
        }
      : null,
    pointsAdded: product.points,
    paidAt: paidAt.toISOString()
  }
}
