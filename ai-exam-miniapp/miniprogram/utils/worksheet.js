const { normalizeWorksheetMode } = require('./billing')

const WORKSHEET_MODES = ['practice', 'exam_simulation']

function normalizeMode(mode) {
  return normalizeWorksheetMode(mode)
}

function normalizeWorksheet(data = {}) {
  const worksheet = data.worksheet || data || {}
  const questions = Array.isArray(worksheet.questions) ? worksheet.questions : []
  const normalizedQuestions = questions.map((q, index) => {
    const normalized = {
      number: Number(q.number || index + 1),
      section: String(q.section || q.type || '练习题'),
      type: String(q.type || q.section || '练习题'),
      difficulty: String(q.difficulty || '中等'),
      skill: String(q.skill || q.knowledgePoint || '综合能力'),
      question: String(q.question || q.stem || ''),
      options: Array.isArray(q.options) ? q.options : [],
      answer: String(q.answer || ''),
      explanation: String(q.explanation || '略')
    }
    if (q.questionLatex || q.latexQuestion || q.latex) normalized.questionLatex = String(q.questionLatex || q.latexQuestion || q.latex || '')
    if (q.answerLatex) normalized.answerLatex = String(q.answerLatex || '')
    if (q.explanationLatex) normalized.explanationLatex = String(q.explanationLatex || '')
    if (Array.isArray(q.explanationSteps)) normalized.explanationSteps = q.explanationSteps
    if (Array.isArray(q.proofSteps)) normalized.proofSteps = q.proofSteps
    if (q.diagramSpec && typeof q.diagramSpec === 'object' && !Array.isArray(q.diagramSpec)) normalized.diagramSpec = q.diagramSpec
    if (q.tableSpec && typeof q.tableSpec === 'object' && !Array.isArray(q.tableSpec)) normalized.tableSpec = q.tableSpec
    return normalized
  }).filter(q => q.question)

  return {
    title: String(worksheet.title || 'AI 练习卷'),
    grade: String(worksheet.grade || ''),
    subject: String(worksheet.subject || ''),
    mode: normalizeMode(worksheet.mode || 'practice'),
    questions: normalizedQuestions,
    answerKey: normalizedQuestions.map(q => ({ number: q.number, answer: q.answer, explanation: q.explanation })),
    cost: worksheet.cost || { pointsUsed: 0, ocrPages: 0, wordExportRequired: false },
    sourceFileInfo: worksheet.sourceFileInfo || null,
    paperBlueprint: worksheet.paperBlueprint || {
      sourceType: 'prompt',
      totalQuestions: normalizedQuestions.length,
      targetDifficulty: '',
      similarityGoal: '',
      sections: []
    }
  }
}

function sampleWorksheet() {
  throw new Error('前端本地模拟出题已禁用：不允许生成 demo/mock 练习卷。请连接真实后端生成。')
}

function groupBySection(questions) {
  const sections = []
  ;(questions || []).forEach(q => {
    const name = q.section || q.type || '练习题'
    let section = sections.find(s => s.name === name)
    if (!section) {
      section = { name, questions: [] }
      sections.push(section)
    }
    section.questions.push(q)
  })
  return sections
}

module.exports = { WORKSHEET_MODES, normalizeMode, normalizeWorksheet, sampleWorksheet, groupBySection }
