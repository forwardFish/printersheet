const GENERATION_MODES = [
  {
    id: 'normal',
    label: '普通练习卷',
    shortLabel: '普通练习',
    cost: 1,
    questionCount: 5,
    buttonText: '一键生成练习卷',
    desc: '按年级、学科和要求生成一份基础练习。',
    placeholder: '例如：生成 5 道初一数学一元一次方程中等题，带答案解析，适合打印。',
    uploadTitle: '上传资料（PDF / Word / 图片）',
    uploadDesc: '支持 PDF、Word、图片，最多上传 10MB'
  },
  {
    id: 'extended',
    label: '加长练习卷',
    shortLabel: '加长练习',
    cost: 2,
    questionCount: 10,
    buttonText: '一键生成练习卷',
    desc: '题量更多，适合一次完整练习。',
    placeholder: '例如：生成 10 道初二物理浮力综合题，难度中等偏上，带答案解析。',
    uploadTitle: '上传资料（PDF / Word / 图片）',
    uploadDesc: '支持 PDF、Word、图片，最多上传 10MB'
  },
  {
    id: 'wrong_question_similar',
    label: '错题举一反三',
    shortLabel: '错题举一反三',
    cost: 2,
    questionCount: 0,
    buttonText: '生成相似错题练习',
    desc: '按页数计费：1页2点，每多1页加2点，最多6页。按错题内容完整生成变式题。',
    placeholder: '粘贴或描述错题，或上传错题资料。我会按页数计费，并按错题内容完整生成变式题。',
    uploadTitle: '上传错题图片 / 试卷截图',
    uploadDesc: '图片默认按 1 页计费；PDF/Word 最多 6 页'
  },
  {
    id: 'upload_material',
    label: '按资料出题',
    shortLabel: '按资料出题',
    cost: 2,
    questionCount: 0,
    buttonText: '根据资料生成',
    desc: '按页数计费：1页2点，每多1页加2点，最多6页。按资料内容完整生成新题。',
    placeholder: '上传教材、讲义、试卷或知识点资料。我会先识别页数并确认点数，再按资料内容完整生成新题。',
    uploadTitle: '上传教材 / 讲义 / 试卷 / 图片',
    uploadDesc: '图片默认按 1 页计费；PDF/Word 最多 6 页'
  }
]

const PAGE_METERED_MODES = new Set(['wrong_question_similar', 'upload_material'])
const MAX_METERED_PAGES = 6
const TEXT_CHARS_PER_PAGE = 800

function normalizeGenerationMode(mode = '') {
  const value = String(mode || '').trim()
  if (value === 'practice') return 'normal'
  if (GENERATION_MODES.some(item => item.id === value)) return value
  return 'normal'
}

function getGenerationMode(mode) {
  const normalized = normalizeGenerationMode(mode)
  return GENERATION_MODES.find(item => item.id === normalized) || GENERATION_MODES[0]
}

function normalizeWorksheetMode(mode = '') {
  return 'practice'
}

function getGenerationPointCost(mode) {
  return getGenerationMode(mode).cost
}

function isPageMeteredMode(mode) {
  return PAGE_METERED_MODES.has(normalizeGenerationMode(mode))
}

function estimateTextPages(text = '') {
  const length = String(text || '').trim().length
  if (!length) return 1
  return Math.min(MAX_METERED_PAGES + 1, Math.max(1, Math.ceil(length / TEXT_CHARS_PER_PAGE)))
}

function getMeteredPointCost(pageCount = 1) {
  const pages = Math.max(1, Math.ceil(Number(pageCount || 1)))
  return pages * 2
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
  return String(member.planCode || member.code || member.planId || 'free').replace(/[-_]monthly$/, '').replace(/[-_]yearly$/, '').replace(/-month$/, '')
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
  return isPaidPlan(member) && (planCode === 'pro' || planCode === 'teacher' || planCode === 'standard')
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
  isPageMeteredMode,
  estimateTextPages,
  getMeteredPointCost,
  MAX_METERED_PAGES,
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
