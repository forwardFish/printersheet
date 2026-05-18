const {
  normalizeGenerationMode,
  normalizeWorksheetMode,
  getGenerationPointCost
} = require('./billing')

const WORKSHEET_MODES = ['practice', 'exam_simulation']

const EQUATION_QUESTIONS = [
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '一元一次方程概念', question: '下列方程中，是一元一次方程的是（    ）', options: ['A. 2x+3=5', 'B. x²+1=0', 'C. 1/2x-2=3', 'D. 3x-2y=5'], answer: 'A', explanation: '一元一次方程只含一个未知数，且未知数次数为 1。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '解一元一次方程', question: '方程 2x-1=5 的解是（    ）', options: ['A. x=2', 'B. x=3', 'C. x=4', 'D. x=5'], answer: 'B', explanation: '2x-1=5，两边加 1 得 2x=6，所以 x=3。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '方程解的意义', question: '若 x=2 是方程 ax-4=0 的解，则 a 的值是（    ）', options: ['A. 2', 'B. -2', 'C. 4', 'D. -4'], answer: 'A', explanation: '把 x=2 代入 ax-4=0，得 2a-4=0，所以 a=2。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '简单', skill: '解方程', question: '方程 3x-6=0 的解是 __________。', answer: 'x=2', explanation: '3x=6，所以 x=2。' },
  { section: '三、解方程（每题 6 分，共 18 分）', type: '解答题', difficulty: '中等', skill: '解方程', question: '4x+7=15', answer: 'x=2', explanation: '4x=8，所以 x=2。' },
  { section: '三、解方程（每题 6 分，共 18 分）', type: '解答题', difficulty: '中等', skill: '解方程', question: '2(x-3)=10', answer: 'x=8', explanation: 'x-3=5，所以 x=8。' },
  { section: '三、解方程（每题 6 分，共 18 分）', type: '解答题', difficulty: '中等', skill: '移项', question: '5-2x=7-x', answer: 'x=-2', explanation: '移项得 -x=2，所以 x=-2。' },
  { section: '四、应用题（每题 7 分，共 14 分）', type: '应用题', difficulty: '中等', skill: '列方程', question: '某商品原价 x 元，降价 20% 后的价格为 80 元，求原价 x。', answer: '100 元', explanation: '0.8x=80，所以 x=100。' },
  { section: '四、应用题（每题 7 分，共 14 分）', type: '应用题', difficulty: '中等', skill: '列方程', question: '小明的年龄比小华大 3 岁，若小明今年 x 岁，再过 2 年后，小明的年龄是小华的 1.5 倍，求两人今年的年龄。', answer: '小明 7 岁，小华 4 岁', explanation: '设小华今年 y 岁，则小明 y+3 岁，列方程 y+5=1.5(y+2)。' }
]

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
    title: String(worksheet.title || '初一数学一元一次方程练习卷'),
    grade: String(worksheet.grade || '初一'),
    subject: String(worksheet.subject || '数学'),
    mode: normalizeMode(worksheet.mode || 'practice'),
    questions: normalizedQuestions,
    answerKey: normalizedQuestions.map(q => ({ number: q.number, answer: q.answer, explanation: q.explanation })),
    cost: worksheet.cost || { pointsUsed: 1, ocrPages: 0, wordExportRequired: false },
    sourceFileInfo: worksheet.sourceFileInfo || null,
    paperBlueprint: worksheet.paperBlueprint || {
      sourceType: 'prompt',
      totalQuestions: normalizedQuestions.length,
      targetDifficulty: '中等',
      similarityGoal: '围绕用户输入生成可打印练习',
      sections: []
    }
  }
}

function sampleWorksheet(prompt = '', options = {}) {
  const generationMode = normalizeGenerationMode(options.generationMode || options.mode || 'normal')
  const mode = normalizeMode(generationMode)
  const questionCount = Math.max(1, Number(options.questionCount || 9))
  const questions = Array.from({ length: questionCount }, (_, index) => ({ number: index + 1, ...EQUATION_QUESTIONS[index % EQUATION_QUESTIONS.length] }))
  return normalizeWorksheet({
    title: '初一数学一元一次方程练习卷',
    grade: options.grade || '初一',
    subject: options.subject || '数学',
    mode,
    questions,
    cost: { pointsUsed: getGenerationPointCost(generationMode), ocrPages: 0, wordExportRequired: false }
  })
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
