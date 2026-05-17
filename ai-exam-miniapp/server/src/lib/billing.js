export const GENERATION_POINT_COSTS = {
  normal: 1,
  extended: 2,
  wrong_question_similar: 2,
  upload_material: 3,
  full_paper_simulation: 10
}

export function normalizeGenerationMode(mode = '') {
  const value = String(mode || '').trim()
  if (value === 'practice') return 'normal'
  if (value === 'exam_simulation' || value === 'paper' || value === 'simulation' || value === 'exam') return 'full_paper_simulation'
  if (Object.prototype.hasOwnProperty.call(GENERATION_POINT_COSTS, value)) return value
  return 'normal'
}

export function normalizeWorksheetMode(mode = '') {
  return normalizeGenerationMode(mode) === 'full_paper_simulation' ? 'exam_simulation' : 'practice'
}

export function getGenerationPointCost(mode = '') {
  return GENERATION_POINT_COSTS[normalizeGenerationMode(mode)] || 1
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
