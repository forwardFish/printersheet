export const GENERATION_POINT_COSTS = {
  normal: 1,
  extended: 2,
  wrong_question_similar: 2,
  upload_material: 2
}

export const PAGE_METERED_MODES = new Set(['wrong_question_similar', 'upload_material'])

export function normalizeGenerationMode(mode = '') {
  const value = String(mode || '').trim()
  if (value === 'practice') return 'normal'
  if (Object.prototype.hasOwnProperty.call(GENERATION_POINT_COSTS, value)) return value
  return 'normal'
}

export function normalizeWorksheetMode(mode = '') {
  return 'practice'
}

export function getGenerationPointCost(mode = '') {
  return GENERATION_POINT_COSTS[normalizeGenerationMode(mode)] || 1
}

export function isPageMeteredMode(mode = '') {
  return PAGE_METERED_MODES.has(normalizeGenerationMode(mode))
}

export function estimateGeneration({ mode = '', pointsBalance = 0 } = {}) {
  const normalizedMode = normalizeGenerationMode(mode)
  const pointsRequired = getGenerationPointCost(normalizedMode)
  const balance = Number(pointsBalance || 0)
  return {
    mode: normalizedMode,
    pointsRequired,
    pointsBalance: balance,
    canGenerate: balance >= pointsRequired
  }
}
