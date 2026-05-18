import { classifyGeometryQuestion } from './geometryClassifier.js'

const TARGET_SECTION_SPECS = [
  { name: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', from: 1, to: 10, score: 3 },
  { name: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', from: 11, to: 18, score: 3 },
  { name: '三、解答题（本大题共 76 分）', type: '解答题', from: 19, to: 28, score: 6 }
]

const KNOWLEDGE_BY_NUMBER = {
  1: ['同底数幂除法', '幂运算'],
  2: ['三角形三边关系'],
  3: ['数轴', '实数大小比较'],
  4: ['整式乘法', '完全平方公式'],
  5: ['平行线角度', '三角尺角度'],
  6: ['同底数幂乘法', '幂的性质'],
  7: ['代数式求值', '整体代入'],
  8: ['二元一次方程组消元'],
  9: ['三角形翻折', '角度分类讨论'],
  10: ['全等三角形', '动点问题'],
  11: ['单项式乘法'],
  12: ['多边形内角和'],
  13: ['不等式性质', '命题真假'],
  14: ['全等三角形性质', '线段和差'],
  15: ['平方差', '实数大小比较'],
  16: ['方位角', '三角形内角和'],
  17: ['二元一次方程组', '参数范围'],
  18: ['面积分割', '三角形中线'],
  19: ['零指数幂', '负整数指数幂', '整式化简'],
  20: ['因式分解', '提公因式', '十字相乘'],
  21: ['二元一次方程组求解'],
  22: ['平行线证明', '全等三角形判定'],
  23: ['一元一次不等式组'],
  24: ['平行线判定', '角度推理'],
  25: ['几何证明', '三角形全等'],
  26: ['方案应用题', '方程与不等式'],
  27: ['图形面积', '分类讨论'],
  28: ['规律探究', '代数表达']
}

function compactText(text = '') {
  return String(text || '')
    .replace(/--\s*\d+\s+of\s+\d+\s*--/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferTitle(text, defaults = {}) {
  const compact = compactText(text)
  const match = compact.match(/(?:\d{4}~\d{4}\s*)?学年.*?初一数学/)
  if (match) return match[0].trim()
  const gradeSubject = [defaults.grade || '初一', defaults.subject || '数学'].filter(Boolean).join('')
  return `${gradeSubject}整卷仿真试卷`
}

function inferQuestionType(number) {
  const spec = TARGET_SECTION_SPECS.find(item => number >= item.from && number <= item.to)
  return spec || TARGET_SECTION_SPECS[TARGET_SECTION_SPECS.length - 1]
}

function stemForNumber(text, number) {
  const compact = compactText(text)
  const current = new RegExp(`(?:^|\\s)${number}\\s*[.．]\\s*`)
  const next = new RegExp(`\\s${number + 1}\\s*[.．]\\s*`)
  const startMatch = current.exec(compact)
  if (!startMatch) return ''
  const start = startMatch.index + startMatch[0].length
  const rest = compact.slice(start)
  const nextMatch = next.exec(rest)
  return (nextMatch ? rest.slice(0, nextMatch.index) : rest).slice(0, 220).trim()
}

function variationPlanFor(number, type) {
  if (type === '选择题') return '保持四选一形式和考点，替换数字、图形条件或表达式，四个选项重新计算。'
  if (type === '填空题') return '保持单空填答形式和考点，替换条件或参数，答案应为一个数、式子或判断词。'
  if (number >= 19 && number <= 21) return '保持计算/因式分解/方程组题型，替换系数和式子，步骤量接近原题。'
  return '保持几何或应用题的证明/推理层级，替换点位、角度、线段或情境，保留必要作答过程。'
}

function difficultyFor(number) {
  if (number <= 4 || (number >= 11 && number <= 13) || number === 19) return '基础'
  if (number <= 8 || number <= 18 || number <= 23) return '中等'
  return '较难'
}

function expectedAnswerShape(number, type) {
  if (type === '选择题') return '单个选项字母'
  if (type === '填空题') return '一个数值、代数式或判断词'
  if (number <= 21 || number === 23) return '分步计算结果'
  return '证明或说明过程'
}

export function extractExamBlueprintFromText(fileText = '', defaults = {}) {
  const text = compactText(fileText)
  const looksLikeFullPaper = /初一数学/.test(text) && /选择题/.test(text) && /填空题/.test(text) && /解答题/.test(text)
  const detectedNumbers = []
  for (let i = 1; i <= 40; i += 1) {
    if (new RegExp(`(?:^|\\s)${i}\\s*[.．]`).test(text)) detectedNumbers.push(i)
  }
  const totalQuestions = detectedNumbers.includes(28) || looksLikeFullPaper ? 28 : detectedNumbers.length
  if (totalQuestions < 20) return null

  const sourceQuestionBlueprints = Array.from({ length: 28 }, (_, index) => {
    const number = index + 1
    const section = inferQuestionType(number)
    const originalStem = stemForNumber(text, number)
    const knowledgePoints = KNOWLEDGE_BY_NUMBER[number] || ['缁煎悎鏁板鑳藉姏']
    const geometry = classifyGeometryQuestion({ number, originalStem, knowledgePoints, type: section.type })
    return {
      number,
      originalStem,
      knowledgePoints: KNOWLEDGE_BY_NUMBER[number] || ['综合数学能力'],
      variationPlan: variationPlanFor(number, section.type),
      difficulty: difficultyFor(number),
      type: section.type,
      score: section.score,
      expectedAnswerShape: expectedAnswerShape(number, section.type),
      needsDiagram: geometry.needsDiagram,
      diagramSpecRequired: geometry.diagramSpecRequired,
      geometryDomain: geometry.geometryDomain,
      geometryTemplateFamily: geometry.templateFamily,
      diagramRequiredReason: geometry.reason
    }
  })

  return {
    title: inferTitle(text, defaults),
    notice: [
      '本试卷由填空题、选择题和解答题三大题组成，共 28 小题，满分 130 分，考试用时 120 分钟。',
      '答题前请填写学校、姓名、考场号、座位号和考试号。',
      '答案请填写在答题卷相应位置。'
    ],
    totalQuestions: 28,
    targetPages: 6,
    targetDifficulty: defaults.difficulty || '混合',
    sections: TARGET_SECTION_SPECS.map(section => ({
      name: section.name,
      type: section.type,
      questionCount: section.to - section.from + 1,
      points: section.score * (section.to - section.from + 1),
      difficulty: section.type === '解答题' ? '中等-较难' : '基础-中等',
      skills: [...new Set(sourceQuestionBlueprints
        .filter(item => item.number >= section.from && item.number <= section.to)
        .flatMap(item => item.knowledgePoints))]
    })),
    sourceQuestionBlueprints
  }
}

export function isFullPaperSimulation({ mode = '', prompt = '', fileText = '' } = {}) {
  const text = `${prompt}\n${fileText}`
  return mode === 'exam_simulation' || mode === 'full_paper_simulation' || /整卷仿真|同结构|试卷/.test(text)
}

export function validateExamBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== 'object' || Array.isArray(blueprint)) {
    throw new Error('整卷蓝图必须是 JSON 对象')
  }
  const items = blueprint.sourceQuestionBlueprints
  if (!Array.isArray(items) || items.length !== 28) {
    throw new Error('整卷蓝图必须包含 28 条 sourceQuestionBlueprints')
  }
  const counts = items.reduce((acc, item, index) => {
    if (Number(item.number || index + 1) !== index + 1) {
      throw new Error(`整卷蓝图第 ${index + 1} 条题号不连续`)
    }
    const type = String(item.type || '')
    if (type.includes('选择')) acc.choice += 1
    else if (type.includes('填空')) acc.blank += 1
    else if (type.includes('解答')) acc.solution += 1
    else throw new Error(`整卷蓝图第 ${index + 1} 条题型无效`)
    for (const field of ['originalStem', 'variationPlan', 'difficulty', 'expectedAnswerShape']) {
      if (!String(item[field] || '').trim()) throw new Error(`整卷蓝图第 ${index + 1} 条缺少 ${field}`)
    }
    if (!Array.isArray(item.knowledgePoints) || item.knowledgePoints.length === 0) {
      throw new Error(`整卷蓝图第 ${index + 1} 条缺少 knowledgePoints`)
    }
    return acc
  }, { choice: 0, blank: 0, solution: 0 })
  if (counts.choice !== 10 || counts.blank !== 8 || counts.solution !== 10) {
    throw new Error(`整卷蓝图题型结构必须为 10/8/10，当前为 ${counts.choice}/${counts.blank}/${counts.solution}`)
  }
  const sections = Array.isArray(blueprint.sections) && blueprint.sections.length
    ? blueprint.sections
    : TARGET_SECTION_SPECS.map(section => ({
        name: section.name,
        type: section.type,
        questionCount: section.to - section.from + 1,
        points: section.score * (section.to - section.from + 1),
        difficulty: section.type === '解答题' ? '中等-较难' : '基础-中等',
        skills: [...new Set(items
          .filter(item => item.number >= section.from && item.number <= section.to)
          .flatMap(item => item.knowledgePoints))]
      }))
  return {
    title: String(blueprint.title || '初一数学整卷仿真试卷').trim(),
    notice: Array.isArray(blueprint.notice) ? blueprint.notice.map(String).filter(Boolean) : [],
    totalQuestions: 28,
    targetPages: Number(blueprint.targetPages || 6),
    targetDifficulty: String(blueprint.targetDifficulty || '混合').trim(),
    sections,
    sourceQuestionBlueprints: items.map((item, index) => ({
      number: index + 1,
      originalStem: String(item.originalStem || '').trim(),
      knowledgePoints: item.knowledgePoints.map(point => String(point || '').trim()).filter(Boolean),
      variationPlan: String(item.variationPlan || '').trim(),
      difficulty: String(item.difficulty || '中等').trim(),
      type: String(item.type || '').trim(),
      score: Number(item.score || inferQuestionType(index + 1).score),
      expectedAnswerShape: String(item.expectedAnswerShape || '').trim(),
      needsDiagram: classifyGeometryQuestion(item).needsDiagram,
      diagramSpecRequired: classifyGeometryQuestion(item).diagramSpecRequired,
      geometryDomain: classifyGeometryQuestion(item).geometryDomain,
      geometryTemplateFamily: classifyGeometryQuestion(item).templateFamily,
      diagramRequiredReason: String(item.diagramRequiredReason || classifyGeometryQuestion(item).reason).trim()
    }))
  }
}
