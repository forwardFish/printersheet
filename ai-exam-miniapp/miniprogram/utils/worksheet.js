const {
  normalizeGenerationMode,
  normalizeWorksheetMode,
  getGenerationPointCost
} = require('./billing')

const WORKSHEET_MODES = ['practice', 'exam_simulation']

const EQUATION_QUESTIONS = [
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '一元一次方程概念', question: '下列方程中，是一元一次方程的是（    ）', options: ['A. 2x+3=5', 'B. x²-1=0', 'C. 1/2 + 2 = 3', 'D. 3x+2y=5'], answer: 'A', explanation: '一元一次方程只含一个未知数，且未知数次数为 1。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '解一元一次方程', question: '方程 2x-1=5 的解是（    ）', options: ['A. x=2', 'B. x=3', 'C. x=4', 'D. x=5'], answer: 'B', explanation: '2x-1=5，两边加 1 得 2x=6，所以 x=3。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '方程解的意义', question: '若 x=2 是方程 ax-4=0 的解，则 a 的值是（    ）', options: ['A. 2', 'B. -2', 'C. 4', 'D. -4'], answer: 'A', explanation: '把 x=2 代入 ax-4=0，得 2a-4=0，所以 a=2。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '移项', question: '解方程 x+7=12 时，正确的移项结果是（    ）', options: ['A. x=12+7', 'B. x=12-7', 'C. x=7-12', 'D. x=-12-7'], answer: 'B', explanation: '等式两边同时减去 7，得到 x=12-7。' },
  { section: '一、选择题（每题 3 分，共 15 分）', type: '选择题', difficulty: '中等', skill: '去括号', question: '方程 3(x-2)=9 的解是（    ）', options: ['A. x=1', 'B. x=3', 'C. x=5', 'D. x=6'], answer: 'C', explanation: '两边除以 3 得 x-2=3，所以 x=5。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '简单', skill: '解方程', question: '方程 3x+6=0 的解是 __________。', answer: 'x=-2', explanation: '3x=-6，所以 x=-2。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '中等', skill: '等式性质', question: '若 5x=20，则 x=__________。', answer: '4', explanation: '等式两边同时除以 5，得 x=4。' },
  { section: '二、填空题（每题 3 分，共 15 分）', type: '填空题', difficulty: '中等', skill: '合并同类项', question: '方程 4x-2x=18 的解是 __________。', answer: 'x=9', explanation: '4x-2x=2x，2x=18，所以 x=9。' },
  { section: '三、解答题（共 20 分）', type: '解答题', difficulty: '中等', skill: '方程应用', question: '某数的 3 倍加 5 等于 20，求这个数。', answer: '5', explanation: '设这个数为 x，则 3x+5=20，解得 x=5。' },
  { section: '三、解答题（共 20 分）', type: '解答题', difficulty: '中等', skill: '列方程解应用题', question: '小明买 3 支同价钢笔和 2 元橡皮共花 17 元，每支钢笔多少元？', answer: '5 元', explanation: '设每支钢笔 x 元，则 3x+2=17，解得 x=5。' }
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
    title: String(worksheet.title || 'AI 智能练习卷'),
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
  const generationMode = normalizeGenerationMode(options.generationMode || options.mode || (prompt.includes('整卷') ? 'full_paper_simulation' : 'normal'))
  const mode = normalizeMode(generationMode)
  const questionCount = Math.max(1, Number(options.questionCount || 10))
  const questions = Array.from({ length: questionCount }, (_, index) => ({ number: index + 1, ...EQUATION_QUESTIONS[index % EQUATION_QUESTIONS.length] }))
  return normalizeWorksheet({
    title: prompt.includes('方程') ? '初一数学一元一次方程练习卷' : 'AI 智能练习卷',
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
    if (!section) { section = { name, questions: [] }; sections.push(section) }
    section.questions.push(q)
  })
  return sections
}

module.exports = { WORKSHEET_MODES, normalizeMode, normalizeWorksheet, sampleWorksheet, groupBySection }
