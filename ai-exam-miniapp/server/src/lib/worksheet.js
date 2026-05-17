import { getGenerationPointCost, normalizeGenerationMode, normalizeWorksheetMode } from './billing.js'

export const WORKSHEET_MODES = ['practice', 'exam_simulation']
export const QUESTION_TYPES = ['选择题', '填空题', '解答题', '判断题', '应用题']

export function normalizeMode(mode = '') {
  return normalizeWorksheetMode(mode)
}

function normalizeQuestion(question, index, defaults) {
  const q = question || {}
  const options = Array.isArray(q.options)
    ? q.options.map(option => String(option || '').trim()).filter(Boolean)
    : []
  const type = String(q.type || q.section || '???').trim()
  const normalized = {
    number: Number(q.number || index + 1),
    section: String(q.section || type || '???').trim(),
    type,
    difficulty: String(q.difficulty || defaults.difficulty || '??').trim(),
    skill: String(q.skill || q.knowledgePoint || q.knowledge || '????').trim(),
    question: String(q.question || q.stem || q.title || '').trim(),
    options,
    answer: String(q.answer || '').trim(),
    explanation: String(q.explanation || q.analysis || '?').trim()
  }
  if (q.questionLatex || q.latexQuestion || q.latex) {
    normalized.questionLatex = String(q.questionLatex || q.latexQuestion || q.latex || '').trim()
  }
  if (q.answerLatex) normalized.answerLatex = String(q.answerLatex || '').trim()
  if (q.explanationLatex) normalized.explanationLatex = String(q.explanationLatex || '').trim()
  if (Array.isArray(q.explanationSteps)) {
    normalized.explanationSteps = q.explanationSteps
      .map(step => typeof step === 'object' && step !== null
        ? String(step.text || step.content || step.statement || step.reason || step.latex || '').trim()
        : String(step || '').trim())
      .filter(Boolean)
  }
  if (Array.isArray(q.proofSteps)) {
    normalized.proofSteps = q.proofSteps
      .map(step => typeof step === 'object' && step !== null
        ? String(step.text || step.content || step.statement || step.reason || step.latex || '').trim()
        : String(step || '').trim())
      .filter(Boolean)
  }
  if (Array.isArray(q.renderBlocks)) {
    normalized.renderBlocks = q.renderBlocks
      .filter(block => block && typeof block === 'object' && !Array.isArray(block))
      .map(block => ({
        type: String(block.type || 'text').trim(),
        text: String(block.text || block.content || '').trim(),
        latex: String(block.latex || '').trim()
      }))
      .filter(block => block.text || block.latex)
  }
  if (q.diagramSpec && typeof q.diagramSpec === 'object' && !Array.isArray(q.diagramSpec)) {
    normalized.diagramSpec = q.diagramSpec
  }
  if (q.tableSpec && typeof q.tableSpec === 'object' && !Array.isArray(q.tableSpec)) {
    normalized.tableSpec = q.tableSpec
  }
  return normalized
}

function normalizeAnswerKey(answerKey, questions) {
  const keyed = Array.isArray(answerKey) ? answerKey : []
  if (keyed.length) {
    return keyed.map((item, index) => ({
      number: Number(item.number || questions[index]?.number || index + 1),
      answer: String(item.answer || questions[index]?.answer || '').trim(),
      explanation: String(item.explanation || questions[index]?.explanation || '略').trim()
    }))
  }
  return questions.map(q => ({
    number: q.number,
    answer: q.answer,
    explanation: q.explanation
  }))
}

function normalizeSourceFileInfo(sourceFileInfo = {}) {
  const source = sourceFileInfo || {}
  if (!source.name && !source.type && !source.size) return null
  return {
    name: String(source.name || source.fileName || '').trim(),
    type: String(source.type || source.mimeType || '').trim(),
    size: Number(source.size || 0),
    parsedTextLength: Number(source.parsedTextLength || 0),
    parserStatus: String(source.parserStatus || source.status || 'parsed').trim(),
    parserMessage: String(source.parserMessage || source.message || '').trim()
  }
}

function normalizePaperBlueprint(paperBlueprint, questions) {
  const blueprint = paperBlueprint || {}
  const sections = Array.isArray(blueprint.sections) && blueprint.sections.length
    ? blueprint.sections.map(section => ({
      name: String(section.name || section.section || '练习题').trim(),
      type: String(section.type || '').trim(),
      questionCount: Number(section.questionCount || section.count || 0),
      points: Number(section.points || 0),
      difficulty: String(section.difficulty || '').trim(),
      skills: Array.isArray(section.skills) ? section.skills.map(String) : []
    }))
    : Object.values(questions.reduce((acc, q) => {
      const name = q.section || q.type || '练习题'
      if (!acc[name]) acc[name] = { name, type: q.type, questionCount: 0, difficulty: q.difficulty, skills: [] }
      acc[name].questionCount += 1
      if (q.skill && !acc[name].skills.includes(q.skill)) acc[name].skills.push(q.skill)
      return acc
    }, {}))
  return {
    sourceType: String(blueprint.sourceType || 'prompt_or_upload').trim(),
    totalQuestions: Number(blueprint.totalQuestions || questions.length),
    targetDifficulty: String(blueprint.targetDifficulty || '').trim(),
    similarityGoal: String(blueprint.similarityGoal || '题型结构、知识点和难度相似，不复制原题').trim(),
    sections
  }
}

function normalizeSourceQuestionBlueprints(sourceQuestionBlueprints = []) {
  if (!Array.isArray(sourceQuestionBlueprints)) return []
  return sourceQuestionBlueprints.map((item, index) => ({
    number: Number(item.number || index + 1),
    originalStem: String(item.originalStem || '').trim(),
    knowledgePoints: Array.isArray(item.knowledgePoints)
      ? item.knowledgePoints.map(point => String(point || '').trim()).filter(Boolean)
      : [],
    variationPlan: String(item.variationPlan || '').trim(),
    difficulty: String(item.difficulty || '中等').trim(),
    type: String(item.type || '').trim(),
    score: Number(item.score || 0),
    expectedAnswerShape: String(item.expectedAnswerShape || '').trim()
  })).filter(item => item.number > 0)
}

function normalizeExamMeta(examMeta = {}, paperBlueprint = {}) {
  const meta = examMeta || {}
  const notice = Array.isArray(meta.notice || paperBlueprint.notice)
    ? (meta.notice || paperBlueprint.notice).map(item => String(item || '').trim()).filter(Boolean)
    : []
  if (!meta.title && !notice.length && !meta.targetPages && !paperBlueprint.targetPages) return null
  return {
    title: String(meta.title || paperBlueprint.title || '').trim(),
    notice,
    targetPages: Number(meta.targetPages || paperBlueprint.targetPages || 0),
    totalScore: Number(meta.totalScore || paperBlueprint.totalScore || 130),
    durationMinutes: Number(meta.durationMinutes || paperBlueprint.durationMinutes || 120)
  }
}

export function normalizeWorksheet(data, defaults = {}) {
  const worksheet = data?.worksheet || data || {}
  const questions = Array.isArray(worksheet.questions) ? worksheet.questions : []
  const normalizedQuestions = questions.map((q, i) => normalizeQuestion(q, i, defaults)).filter(q => q.question)

  const title = String(worksheet.title || defaults.title || 'AI 智能练习卷').trim()
  const grade = String(worksheet.grade || defaults.grade || '').trim()
  const subject = String(worksheet.subject || defaults.subject || '').trim()
  const mode = normalizeMode(worksheet.mode || defaults.mode || 'practice')
  const answerKey = normalizeAnswerKey(worksheet.answerKey, normalizedQuestions)
  const pointsUsed = Number(worksheet.cost?.pointsUsed || defaults.pointsUsed || 0)
  const sourceFileInfo = normalizeSourceFileInfo(worksheet.sourceFileInfo || defaults.sourceFileInfo)
  const paperBlueprint = normalizePaperBlueprint(worksheet.paperBlueprint, normalizedQuestions)
  const sourceAnchors = Array.isArray(worksheet.sourceAnchors)
    ? worksheet.sourceAnchors.map(anchor => String(anchor || '').trim()).filter(Boolean).slice(0, 8)
    : []
  const sourceQuestionBlueprints = normalizeSourceQuestionBlueprints(
    worksheet.sourceQuestionBlueprints || worksheet.paperBlueprint?.sourceQuestionBlueprints || defaults.sourceQuestionBlueprints
  )
  const examMeta = normalizeExamMeta(worksheet.examMeta || defaults.examMeta, worksheet.paperBlueprint || {})

  const normalized = {
    title,
    grade,
    subject,
    mode,
    questions: normalizedQuestions,
    answerKey,
    cost: {
      pointsUsed,
      ocrPages: Number(worksheet.cost?.ocrPages || defaults.ocrPages || 0),
      wordExportRequired: Boolean(worksheet.cost?.wordExportRequired || false)
    },
    sourceAnchors,
    paperBlueprint,
    sourceQuestionBlueprints
  }
  if (examMeta) normalized.examMeta = examMeta
  if (sourceFileInfo) normalized.sourceFileInfo = sourceFileInfo
  return normalized
}

export function validateWorksheet(worksheet) {
  const errors = []
  if (!worksheet || typeof worksheet !== 'object') {
    errors.push('练习卷数据为空')
    return { valid: false, errors }
  }
  if (!Array.isArray(worksheet.questions) || worksheet.questions.length === 0) {
    errors.push('练习卷至少需要包含 1 道题')
  }
  if (!WORKSHEET_MODES.includes(worksheet.mode)) {
    errors.push(`mode 必须是 ${WORKSHEET_MODES.join(' 或 ')}`)
  }
  for (const q of worksheet.questions || []) {
    if (!q.question || !q.answer || !q.explanation) {
      errors.push(`第 ${q.number || '?'} 题缺少题干、答案或解析`)
    }
  }
  if (!Array.isArray(worksheet.answerKey) || worksheet.answerKey.length !== (worksheet.questions || []).length) {
    errors.push('answerKey 必须与 questions 一一对应')
  }
  return { valid: errors.length === 0, errors }
}

export function assertValidWorksheet(worksheet) {
  const result = validateWorksheet(worksheet)
  if (!result.valid) throw new Error(result.errors[0])
  return worksheet
}

export function pointsFor({ prompt = '', mode = '', questionCount = 0, worksheet }) {
  if (prompt.includes('整卷') || prompt.includes('同结构') || prompt.includes('试卷')) return 10
  const normalizedMode = normalizeGenerationMode(mode || worksheet?.generationMode || worksheet?.mode)
  if (normalizedMode !== 'normal') return getGenerationPointCost(normalizedMode)
  const count = Number(questionCount || worksheet?.questions?.length || 0)
  return count > 5 ? getGenerationPointCost('extended') : getGenerationPointCost('normal')
}

export function worksheetDefaults({ prompt = '', grade = '', subject = '', difficulty = '', mode = '' }) {
  const topic = prompt.includes('方程') ? '一元一次方程' : '综合练习'
  const titleParts = [grade, subject, topic].filter(Boolean)
  return {
    title: titleParts.length ? `${titleParts.join('')}练习卷` : 'AI 智能练习卷',
    grade,
    subject,
    difficulty,
    mode: normalizeMode(mode || 'practice')
  }
}
