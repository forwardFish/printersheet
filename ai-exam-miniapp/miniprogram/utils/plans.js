const PLANS = [
  {
    id: 'free',
    name: '免费体验',
    billing: 'free',
    billingLabel: '体验',
    productType: 'plan',
    planCode: 'free',
    price: '0',
    origin: '',
    points: 3,
    memberName: '免费体验',
    benefits: ['新用户免费 3 点', 'PDF 带水印', '不支持 Word', '可体验生成']
  },
  {
    id: 'starter_monthly',
    name: 'Starter',
    billing: 'month',
    billingLabel: '月',
    productType: 'plan',
    planCode: 'starter',
    price: '9.9',
    origin: '',
    points: 30,
    memberName: 'Starter 月卡',
    benefits: ['每月 30 点', '适合轻量练习', 'PDF 无水印', '暂不支持 Word']
  },
  {
    id: 'pro_monthly',
    name: 'Pro',
    billing: 'month',
    billingLabel: '月',
    productType: 'plan',
    planCode: 'pro',
    price: '19.9',
    origin: '',
    points: 80,
    memberName: 'Pro 月卡',
    recommend: true,
    benefits: ['每月 80 点', '约可生成 80 份普通练习卷，或 8 份整卷仿真', '无水印 PDF', 'Word 下载', '完整答案解析']
  },
  {
    id: 'teacher_monthly',
    name: 'Teacher',
    billing: 'month',
    billingLabel: '月',
    productType: 'plan',
    planCode: 'teacher',
    price: '39.9',
    origin: '',
    points: 200,
    memberName: 'Teacher 月卡',
    benefits: ['每月 200 点', '适合老师和家教', '无水印 PDF', 'Word 下载', '整卷仿真与批量使用']
  },
  {
    id: 'standard_yearly',
    name: '标准版',
    billing: 'year',
    billingLabel: '年',
    productType: 'plan',
    planCode: 'standard',
    price: '399',
    origin: '',
    points: 960,
    memberName: '标准版 年度会员',
    benefits: ['有效期 12 个月', 'PDF 无水印', 'Word 下载', '完整答案解析']
  }
]

const POINT_PACKS = [
  {
    id: 'small_pack',
    name: '小加量包',
    productType: 'point_pack',
    billing: 'once',
    billingLabel: '次',
    price: '9.9',
    points: 25,
    memberName: '小加量包',
    benefits: ['立即到账 25 点', '不改变当前套餐']
  },
  {
    id: 'large_pack',
    name: '大加量包',
    productType: 'point_pack',
    billing: 'once',
    billingLabel: '次',
    price: '29.9',
    points: 100,
    memberName: '大加量包',
    benefits: ['立即到账 100 点', '不改变当前套餐']
  }
]

function getPaidPlans() {
  return PLANS.filter(plan => plan.id !== 'free' && plan.id !== 'standard_yearly')
}

function getPointPacks() {
  return POINT_PACKS
}

function getPlanById(planId) {
  return PLANS.find(plan => plan.id === planId) || POINT_PACKS.find(pack => pack.id === planId) || null
}

function getDefaultPlan() {
  return getPlanById('standard_yearly') || getPlanById('pro_monthly')
}

module.exports = { PLANS, POINT_PACKS, getPaidPlans, getPointPacks, getPlanById, getDefaultPlan }
