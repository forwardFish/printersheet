const GENERATION_MODES = [
  {
    id: 'normal',
    label: '普通练习卷',
    shortLabel: '普通练习',
    cost: 1,
    questionCount: 5,
    buttonText: '生成练习卷（消耗 1 点）',
    desc: '5 题，适合快速日常练习。'
  },
  {
    id: 'extended',
    label: '加长练习卷',
    shortLabel: '加长练习',
    cost: 2,
    questionCount: 10,
    buttonText: '生成练习卷（消耗 2 点）',
    desc: '10 题，适合一组完整训练。'
  },
  {
    id: 'wrong_question_similar',
    label: '错题同类题',
    shortLabel: '错题同类题',
    cost: 2,
    questionCount: 10,
    buttonText: '生成同类题（消耗 2 点）',
    desc: '围绕易错点生成同类新题。'
  },
  {
    id: 'upload_material',
    label: '上传资料生成',
    shortLabel: '上传资料',
    cost: 3,
    questionCount: 10,
    buttonText: '根据资料生成（消耗 3 点）',
    desc: '根据上传资料生成配套练习。'
  },
  {
    id: 'full_paper_simulation',
    label: '整卷仿真',
    shortLabel: '整卷仿真',
    cost: 10,
    questionCount: 10,
    buttonText: '生成同结构练习卷（消耗 10 点）',
    desc: '分析原卷结构、题型、知识点和难度，生成新题。'
  }
]

function getGenerationMode(mode) {
  const normalized = normalizeGenerationMode(mode)
  return GENERATION_MODES.find(item => item.id === normalized) || GENERATION_MODES[0]
}

function normalizeGenerationMode(mode = '') {
  const value = String(mode || '').trim()
  if (value === 'practice') return 'normal'
  if (value === 'exam_simulation' || value === 'paper' || value === 'simulation' || value === 'exam') return 'full_paper_simulation'
  if (GENERATION_MODES.some(item => item.id === value)) return value
  return 'normal'
}

function normalizeWorksheetMode(mode = '') {
  return normalizeGenerationMode(mode) === 'full_paper_simulation' ? 'exam_simulation' : 'practice'
}

function getGenerationPointCost(mode) {
  return getGenerationMode(mode).cost
}

function getGenerationQuestionCount(mode) {
  return getGenerationMode(mode).questionCount
}

function getGenerationModeLabel(mode) {
  return getGenerationMode(mode).label
}

function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseTime(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function getPlanCode(member) {
  if (!member) return 'free'
  return String(member.planCode || member.code || member.planId || 'free').replace(/[-_]monthly$/, '').replace(/-month$/, '')
}

function isPaidPlan(member, now = Date.now()) {
  const planCode = getPlanCode(member)
  if (planCode === 'free') return false
  const expiresAt = member && (member.planExpiresAt || member.expireAt || member.expire)
  return !!expiresAt && parseTime(expiresAt) > now
}

function canRemoveWatermark(member) {
  return isPaidPlan(member)
}

function canDownloadWord(member) {
  const planCode = getPlanCode(member)
  return isPaidPlan(member) && (planCode === 'pro' || planCode === 'teacher')
}

function canUseTeacherFeatures(member) {
  return isPaidPlan(member) && getPlanCode(member) === 'teacher'
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

module.exports = {
  GENERATION_MODES,
  getGenerationMode,
  normalizeGenerationMode,
  normalizeWorksheetMode,
  getGenerationPointCost,
  getGenerationQuestionCount,
  getGenerationModeLabel,
  todayKey,
  getPlanCode,
  isPaidPlan,
  canRemoveWatermark,
  canDownloadWord,
  canUseTeacherFeatures,
  formatDate
}
