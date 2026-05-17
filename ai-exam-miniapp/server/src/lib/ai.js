import { createMockWorksheet } from './mockWorksheet.js'
import { assertValidWorksheet, normalizeWorksheet, worksheetDefaults } from './worksheet.js'
import { resolveAiProvider } from './aiProviders.js'
import { extractExamBlueprintFromText, isFullPaperSimulation, validateExamBlueprint } from './examBlueprint.js'
import { normalizeGeometryDiagramSpec } from './geometryRenderer.js'

const DEMO_QUESTION_PATTERNS = [
  /x\s*\+\s*3\s*=\s*8/i,
  /2x\s*=\s*8/i,
  /x\s*\+\s*1\s*=\s*3/i,
  /2x\s*-\s*1\s*=\s*5/i,
  /3\s*\(\s*x\s*-\s*2\s*\)\s*=\s*9/i,
  /下列方程中[，,]\s*是一元一次方程的是/
]

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

function envNumber(value, fallback) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function aiRuntimeConfig(env = process.env) {
  const provider = resolveAiProvider(env)
  const thinkingMode = String(env.AI_THINKING_MODE || env.DEEPSEEK_THINKING || 'disabled').trim().toLowerCase()
  return {
    ...provider,
    mockMode: envFlag(env.AI_MOCK_MODE),
    fallbackToMock: envFlag(env.AI_FALLBACK_TO_MOCK),
    requestTimeoutMs: envNumber(env.AI_REQUEST_TIMEOUT_MS, 240000),
    maxTokens: envNumber(env.AI_MAX_TOKENS, 24000),
    thinkingMode: ['enabled', 'disabled'].includes(thinkingMode) ? thinkingMode : 'disabled'
  }
}

export function extractJson(text) {
  if (!text) throw new Error('模型返回为空')
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('模型未返回 JSON 对象')
  const candidate = cleaned.slice(start, end + 1)
  try {
    return JSON.parse(candidate)
  } catch (error) {
    return JSON.parse(candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'))
  }
}

function expectedQuestionCount(questionCount) {
  const count = Number(questionCount || 0)
  return Number.isFinite(count) && count > 0 ? count : 10
}

export function assertAiWorksheetPayloadSchema(payload, { questionCount = 0, expectedCount = 0, sourceBlueprint = null } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('AI JSON 必须是对象')
  }
  const worksheet = payload.worksheet || payload
  if (!worksheet || typeof worksheet !== 'object' || Array.isArray(worksheet)) {
    throw new Error('AI JSON 缺少 worksheet 对象')
  }
  if (!Array.isArray(worksheet.questions)) {
    throw new Error('AI JSON 缺少 questions 数组')
  }
  const expected = Number(expectedCount || sourceBlueprint?.totalQuestions || expectedQuestionCount(questionCount))
  if (worksheet.questions.length !== expected) {
    throw new Error(`AI JSON questions 数量必须等于 ${expected}`)
  }
  worksheet.questions.forEach((question, index) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      throw new Error(`AI JSON 第 ${index + 1} 题必须是对象`)
    }
    for (const field of ['question', 'answer', 'explanation']) {
      if (!String(question[field] || '').trim()) {
        throw new Error(`AI JSON 第 ${index + 1} 题缺少 ${field}`)
      }
    }
    if ('options' in question && !Array.isArray(question.options)) {
      throw new Error(`AI JSON 第 ${index + 1} 题 options 必须是数组`)
    }
  })
  if (sourceBlueprint?.sourceQuestionBlueprints?.length) {
    const blueprints = worksheet.sourceQuestionBlueprints || worksheet.paperBlueprint?.sourceQuestionBlueprints
    if (!Array.isArray(blueprints) || blueprints.length !== sourceBlueprint.sourceQuestionBlueprints.length) {
      throw new Error(`整卷仿真必须返回 ${sourceBlueprint.sourceQuestionBlueprints.length} 条 sourceQuestionBlueprints`)
    }
  }
  return worksheet
}

export function assertWorksheetQuality(worksheet) {
  const seen = new Set()
  for (const question of worksheet.questions || []) {
    const text = String(question.question || '').replace(/\s+/g, '')
    if (seen.has(text)) throw new Error(`AI 题目重复：第 ${question.number || '?'} 题`)
    seen.add(text)
    const fullText = [
      question.question,
      ...(Array.isArray(question.options) ? question.options : []),
      question.answer,
      question.explanation
    ].join(' ')
    if (DEMO_QUESTION_PATTERNS.some(pattern => pattern.test(fullText))) {
      throw new Error(`AI 返回了 demo/示例题：${question.question}`)
    }
  }
  return worksheet
}

function significantTokens(text = '') {
  const raw = String(text || '')
  const tokens = new Set()
  for (const token of raw.match(/[A-Za-z0-9]{3,}|[\u4e00-\u9fa5]{2,}/g) || []) {
    const normalized = token.toLowerCase()
    if (!['用户要求', '默认信息', '资料内容', '生成题目', '答案解析', '数学', '年级', '学科', '难度'].includes(normalized)) {
      tokens.add(normalized)
    }
  }
  return tokens
}

function hasParsedUpload(fileText = '') {
  const text = String(fileText || '').trim()
  return !!text && !text.includes('未启用 OCR') && !text.includes('未提取到可用文本') && !text.includes('无上传资料')
}

export function assertUploadedSourceUsage(worksheet, fileText = '') {
  if (!hasParsedUpload(fileText)) return worksheet
  const sourceTokens = significantTokens(fileText)
  const sourceAnchors = Array.isArray(worksheet.sourceAnchors) ? worksheet.sourceAnchors : []
  if (!sourceAnchors.length) {
    throw new Error('AI 未返回 sourceAnchors，无法证明题目基于上传资料生成')
  }
  const validAnchors = sourceAnchors.filter(anchor => {
    const text = String(anchor || '').trim()
    if (!text) return false
    if (String(fileText).includes(text)) return true
    return significantTokens(text).size && [...significantTokens(text)].some(token => sourceTokens.has(token))
  })
  if (!validAnchors.length) {
    throw new Error('AI 返回的 sourceAnchors 未命中上传资料内容')
  }
  const worksheetTokens = significantTokens([
    worksheet.title,
    ...(worksheet.questions || []).flatMap(q => [q.section, q.type, q.skill, q.question, q.answer, q.explanation, ...(q.options || [])])
  ].join('\n'))
  const overlap = [...worksheetTokens].filter(token => sourceTokens.has(token))
  if (overlap.length < 1) {
    throw new Error('生成题目与上传资料缺少可验证的关键词重合')
  }
  return worksheet
}

export function assertFullPaperSimulation(worksheet, sourceBlueprint = null) {
  if (!sourceBlueprint?.sourceQuestionBlueprints?.length) return worksheet
  const expected = sourceBlueprint.totalQuestions || sourceBlueprint.sourceQuestionBlueprints.length
  if ((worksheet.questions || []).length !== expected) {
    throw new Error(`整卷仿真必须生成 ${expected} 题`)
  }
  const sectionCounts = (worksheet.questions || []).reduce((acc, question) => {
    const type = String(question.type || question.section || '')
    if (type.includes('选择')) acc.choice += 1
    else if (type.includes('填空')) acc.blank += 1
    else if (type.includes('解答')) acc.solution += 1
    return acc
  }, { choice: 0, blank: 0, solution: 0 })
  if (sectionCounts.choice !== 10 || sectionCounts.blank !== 8 || sectionCounts.solution !== 10) {
    throw new Error(`整卷仿真题型结构必须为 10 选择、8 填空、10 解答，当前为 ${sectionCounts.choice}/${sectionCounts.blank}/${sectionCounts.solution}`)
  }
  const sourceStems = sourceBlueprint.sourceQuestionBlueprints
    .map(item => String(item.originalStem || '').replace(/\s+/g, '').slice(0, 36))
    .filter(stem => stem.length >= 12)
  for (const question of worksheet.questions || []) {
    const text = String(question.question || '').replace(/\s+/g, '')
    if (sourceStems.some(stem => text.includes(stem) || stem.includes(text.slice(0, Math.min(24, text.length))))) {
      throw new Error(`整卷仿真第 ${question.number || '?'} 题疑似复制原题`)
    }
  }
  return worksheet
}

function buildPrompt({ prompt, fileText, defaults, questionCount, sourceBlueprint = null, retryReason = '' }) {
  const count = Number(sourceBlueprint?.totalQuestions || expectedQuestionCount(questionCount))
  const parsedUpload = hasParsedUpload(fileText)
  const schema = {
    title: '',
    grade: '',
    subject: '',
    mode: sourceBlueprint ? 'exam_simulation' : 'practice',
    questions: [{
      number: 1,
      section: '',
      type: '',
      difficulty: '',
      skill: '',
      question: '',
      questionLatex: '可选：题干中的核心数学表达式 LaTeX，例如 \\frac{x+1}{2}=3、\\sqrt{5}、\\angle ABC',
      diagramSpec: { type: 'none', points: {}, segments: [], labels: [] },
      tableSpec: { headers: [], rows: [] },
      options: [],
      answer: '',
      answerLatex: '可选：答案中的核心数学表达式 LaTeX',
      explanation: '',
      explanationSteps: ['按自然解题步骤拆成 2-5 句；不要写序号'],
      proofSteps: ['证明题可选：已知/求证/证明步骤；不要写序号']
    }],
    answerKey: [{ number: 1, answer: '', explanation: '' }],
    sourceAnchors: ['如果有上传资料，列出 2-5 个来自资料原文的关键词/短句；无上传资料则为空数组'],
    examMeta: {
      title: sourceBlueprint?.title || '',
      notice: sourceBlueprint?.notice || [],
      targetPages: sourceBlueprint?.targetPages || 0,
      totalScore: 130,
      durationMinutes: 120
    },
    sourceQuestionBlueprints: sourceBlueprint?.sourceQuestionBlueprints || [],
    paperBlueprint: {
      sourceType: parsedUpload ? 'uploaded_material' : 'prompt_or_upload',
      totalQuestions: count,
      targetDifficulty: '',
      similarityGoal: '',
      sections: [{ name: '', type: '', questionCount: count, difficulty: '', skills: [] }]
    }
  }

  return {
    system: [
      '你是中小学教研出题老师和试卷命题专家。',
      '根据用户要求和资料内容，生成一份可打印练习卷。',
      '只输出严格 JSON 对象，不要 Markdown，不要额外解释。',
      '题目必须适合打印，必须包含答案和简短解析。',
      parsedUpload
        ? '用户上传了可解析资料：必须优先依据资料内容、知识点、题型或例题结构生成，不能脱离资料自由发挥。'
        : '如果没有可解析上传资料，则依据用户输入要求生成。',
      parsedUpload
        ? '必须在 JSON 顶层返回 sourceAnchors 数组，列出 2-5 个来自上传资料原文的关键词或短句，用于证明题目来源。'
        : 'sourceAnchors 返回空数组。',
      '严禁输出演示题、样例题或常见占位题；不要使用 x+3=8、2x=8、x+1=3、2x-1=5、3(x-2)=9 等示例。',
      '每一道题都必须是新编题，题干、数字、答案、解析不得互相重复。',
      '数学题必须优先结构化：question 写自然中文题干，questionLatex/answerLatex 只放核心公式；解析必须用 explanationSteps 或 proofSteps 拆成自然步骤，不要输出一整坨长文本。',
      '重点照顾数学几何、函数图像、数轴、方程组、分式、根号、上下标和证明题。涉及这些内容时，公式必须写成 LaTeX；证明题 proofSteps 每步写清依据。',
      '涉及几何图、数轴、函数图像、电路图、光路图、化学方程式或实验图时，不要写“图略”；能抽象为图的题目必须返回 diagramSpec，表格题必须返回 tableSpec。',
      'diagramSpec 可使用类型：number_line、grid_triangle、parallel_lines、congruent_triangles、triangle_ruler、generic_geometry、angle_bisector、fence_area；几何图至少包含 points、segments、labels。',
      '如果用户要求整卷仿真，保持结构、题型、知识点和难度比例相似，但必须改写题目。',
      sourceBlueprint
        ? '当前是整卷仿真：必须严格按提供的 sourceQuestionBlueprints 逐题生成变式题，题号、题型、分值、知识点、难度一一对应。'
        : '',
      sourceBlueprint
        ? '严禁输出少量代表题；严禁输出 3/5/10 题简版；严禁逐字复制 originalStem。'
        : '',
      `questions 数组长度必须严格等于 ${count}。`,
      '输出 JSON 必须符合这个 schema：',
      JSON.stringify(schema)
    ].join('\n'),
    user: [
      `用户要求：${prompt || ''}`,
      '',
      '默认信息：',
      `年级：${defaults.grade || '未指定'}`,
      `学科：${defaults.subject || '未指定'}`,
      `难度：${defaults.difficulty || '未指定'}`,
      `模式：${defaults.mode || 'practice'}`,
      `题量：${count}`,
      '',
      parsedUpload ? '上传资料原文（必须作为出题依据）：' : '资料内容：',
      fileText ? String(fileText).slice(0, 12000) : '无上传资料',
      sourceBlueprint
        ? [
            '',
            '整卷仿真蓝图（最高优先级，必须逐题对应）：',
            JSON.stringify(sourceBlueprint)
          ].join('\n')
        : '',
      retryReason
        ? [
            '',
            '上一次返回不合格，必须修正：',
            retryReason,
            `再次强调：questions 数组长度必须严格等于 ${count}，每题必须有 question、answer、explanation，并尽量返回 questionLatex/answerLatex/explanationSteps/diagramSpec。`,
            '只能返回一个 JSON 对象，不能有 Markdown、注释或额外说明。'
          ].join('\n')
        : ''
    ].join('\n')
  }
}

async function callChatContent({ system, user, config, temperature = 0.35, maxTokens }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
    max_tokens: Number(maxTokens || config.maxTokens || 24000),
    response_format: { type: 'json_object' }
  }
  if (config.providerId === 'deepseek' && /^deepseek-v4-/i.test(config.model || '')) {
    body.thinking = { type: config.thinkingMode || 'disabled' }
  }
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`AI 接口失败：${res.status} ${body.slice(0, 300)}`)
    }
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('AI 接口响应缺少 choices[0].message.content')
    return content
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`AI 接口超时：${config.requestTimeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function callModel({ prompt, fileText, defaults, questionCount, sourceBlueprint = null, config, retryReason = '' }) {
  const messages = buildPrompt({ prompt, fileText, defaults, questionCount, sourceBlueprint, retryReason })
  const content = await callChatContent({ ...messages, config })
  return { content, messages }
}

function buildBlueprintPrompt({ prompt, fileText, defaults, baselineBlueprint, retryReason = '', repairFeedback = '' }) {
  const schema = {
    title: baselineBlueprint?.title || '',
    notice: baselineBlueprint?.notice || [],
    totalQuestions: 28,
    targetPages: 6,
    targetDifficulty: defaults.difficulty || '混合',
    sections: [
      { name: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）', type: '选择题', questionCount: 10, points: 30, difficulty: '基础-中等', skills: [] },
      { name: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）', type: '填空题', questionCount: 8, points: 24, difficulty: '基础-中等', skills: [] },
      { name: '三、解答题（本大题共 76 分）', type: '解答题', questionCount: 10, points: 76, difficulty: '中等-较难', skills: [] }
    ],
    sourceQuestionBlueprints: [{
      number: 1,
      originalStem: '',
      knowledgePoints: [],
      variationPlan: '',
      difficulty: '',
      type: '',
      score: 0,
      expectedAnswerShape: ''
    }]
  }
  return {
    system: [
      '你是初中数学教研组长，任务是分析一份原始试卷，只输出严格 JSON 对象。',
      '本阶段只做原卷分析和逐题蓝图，不生成新题。',
      '必须输出 28 条 sourceQuestionBlueprints，并保持 1-10 选择题、11-18 填空题、19-28 解答题。',
      '每条蓝图必须包含 originalStem、knowledgePoints、variationPlan、difficulty、type、score、expectedAnswerShape。',
      'originalStem 应概括原题，不要遗漏题型和核心条件；knowledgePoints 必须具体到知识点。',
      '输出 JSON 必须符合 schema：',
      JSON.stringify(schema)
    ].join('\n'),
    user: [
      `用户目标：${prompt || '整卷仿真'}`,
      '',
      `年级：${defaults.grade || '初一'}`,
      `学科：${defaults.subject || '数学'}`,
      `难度：${defaults.difficulty || '混合'}`,
      '',
      '原始 PDF 提取文本：',
      String(fileText || '').slice(0, 16000),
      baselineBlueprint
        ? [
            '',
            '程序初步识别的结构参考（仅用于校对，不可少题）：',
            JSON.stringify(baselineBlueprint)
          ].join('\n')
        : '',
      repairFeedback
        ? [
            '',
            '上一轮对比失败反馈，分析蓝图时必须修正：',
            repairFeedback
          ].join('\n')
        : '',
      retryReason
        ? [
            '',
            '上一次蓝图 JSON 不合格，必须修正：',
            retryReason
          ].join('\n')
        : ''
    ].join('\n')
  }
}

async function analyzeFullPaperBlueprint({ prompt, fileText, defaults, baselineBlueprint, config, repairFeedback = '' }) {
  let lastError
  const attempts = []
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const messages = buildBlueprintPrompt({
      prompt,
      fileText,
      defaults,
      baselineBlueprint,
      repairFeedback,
      retryReason: attempt > 1 ? lastError?.message || '' : ''
    })
    try {
      const content = await callChatContent({ ...messages, config, temperature: 0.1, maxTokens: 12000 })
      attempts.push({ stage: 'blueprint', attempt, messages, raw: content })
      const payload = extractJson(content)
      const blueprint = validateExamBlueprint(payload.blueprint || payload.paperBlueprint || payload)
      return { blueprint, attempts }
    } catch (error) {
      lastError = error
      attempts.push({ stage: 'blueprint', attempt, messages, error: error.message || String(error) })
    }
  }
  const error = new Error(`整卷蓝图分析失败：${lastError?.message || 'unknown error'}`)
  error.debugAttempts = attempts
  throw error
}

const FULL_PAPER_BATCHES = [
  { id: 'choice', label: '选择题', from: 1, to: 10, expectedCount: 10 },
  { id: 'blank', label: '填空题', from: 11, to: 18, expectedCount: 8 },
  { id: 'solution', label: '解答题', from: 19, to: 28, expectedCount: 10 }
]

function batchItems(blueprint, batch) {
  return (blueprint?.sourceQuestionBlueprints || [])
    .filter(item => item.number >= batch.from && item.number <= batch.to)
}

function buildBatchBlueprintPrompt({ prompt, defaults, batch, items, retryReason = '', repairFeedback = '' }) {
  const schema = {
    section: batch.label,
    sourceQuestionBlueprints: [{
      number: batch.from,
      originalStem: '',
      knowledgePoints: [],
      variationPlan: '',
      difficulty: '',
      type: batch.label,
      score: batch.label === '解答题' ? 6 : 3,
      expectedAnswerShape: ''
    }]
  }
  return {
    system: [
      '你是初中数学教研组长。本阶段只分析原卷的一段题目蓝图，只输出严格 JSON 对象。',
      `当前只处理第 ${batch.from}-${batch.to} 题（${batch.label}），必须输出 ${batch.expectedCount} 条 sourceQuestionBlueprints。`,
      '不得生成新题；只抽象原题、知识点、变式方向、难度、分值和答案形态。',
      '每条必须包含 number、originalStem、knowledgePoints、variationPlan、difficulty、type、score、expectedAnswerShape。',
      '输出 JSON 必须符合 schema：',
      JSON.stringify(schema)
    ].join('\n'),
    user: [
      `用户目标：${prompt || '整卷仿真'}`,
      `年级：${defaults.grade || '初一'}`,
      `学科：${defaults.subject || '数学'}`,
      '',
      '程序按 PDF 文本初步切出的本段原题参考，请逐题校正并抽象成蓝图：',
      JSON.stringify(items),
      repairFeedback ? `\n上一轮对比反馈：\n${repairFeedback}` : '',
      retryReason ? `\n上一次本段蓝图不合格：\n${retryReason}` : ''
    ].join('\n')
  }
}

function validateBatchBlueprint(payload, batch) {
  const items = payload?.sourceQuestionBlueprints || payload?.blueprint?.sourceQuestionBlueprints || payload?.paperBlueprint?.sourceQuestionBlueprints
  if (!Array.isArray(items) || items.length !== batch.expectedCount) {
    throw new Error(`${batch.label}蓝图必须包含 ${batch.expectedCount} 题`)
  }
  return items.map((item, index) => {
    const number = batch.from + index
    if (Number(item.number || number) !== number) throw new Error(`${batch.label}第 ${index + 1} 条题号应为 ${number}`)
    const type = String(item.type || batch.label)
    if (!type.includes(batch.label.replace('题', ''))) throw new Error(`${batch.label}第 ${number} 题题型错误：${type}`)
    for (const field of ['originalStem', 'variationPlan', 'difficulty', 'expectedAnswerShape']) {
      if (!String(item[field] || '').trim()) throw new Error(`${batch.label}第 ${number} 题缺少 ${field}`)
    }
    if (!Array.isArray(item.knowledgePoints) || !item.knowledgePoints.length) {
      throw new Error(`${batch.label}第 ${number} 题缺少 knowledgePoints`)
    }
    return {
      number,
      originalStem: String(item.originalStem || '').trim(),
      knowledgePoints: item.knowledgePoints.map(point => String(point || '').trim()).filter(Boolean),
      variationPlan: String(item.variationPlan || '').trim(),
      difficulty: String(item.difficulty || '中等').trim(),
      type: batch.label,
      score: Number(item.score || (batch.label === '解答题' ? 6 : 3)),
      expectedAnswerShape: String(item.expectedAnswerShape || '').trim()
    }
  })
}

async function analyzeFullPaperBlueprintInBatches({ prompt, defaults, baselineBlueprint, config, repairFeedback = '' }) {
  const attempts = []
  const sourceQuestionBlueprints = []
  for (const batch of FULL_PAPER_BATCHES) {
    let lastError
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const messages = buildBatchBlueprintPrompt({
        prompt,
        defaults,
        batch,
        items: batchItems(baselineBlueprint, batch),
        retryReason: attempt > 1 ? lastError?.message || '' : '',
        repairFeedback
      })
      try {
        const content = await callChatContent({ ...messages, config, temperature: 0.1, maxTokens: 7000 })
        attempts.push({ stage: 'blueprint', batch: batch.id, attempt, messages, raw: content })
        const items = validateBatchBlueprint(extractJson(content), batch)
        sourceQuestionBlueprints.push(...items)
        lastError = null
        break
      } catch (error) {
        lastError = error
        attempts.push({ stage: 'blueprint', batch: batch.id, attempt, messages, error: error.message || String(error) })
      }
    }
    if (lastError) {
      const error = new Error(`${batch.label}蓝图分析失败：${lastError.message || String(lastError)}`)
      error.debugAttempts = attempts
      throw error
    }
  }
  return {
    blueprint: validateExamBlueprint({
      ...baselineBlueprint,
      sourceQuestionBlueprints
    }),
    attempts
  }
}

async function generateWorksheetFromBlueprint({ prompt, fileText, defaults, sourceBlueprint, expectedCount, config, repairFeedback = '' }) {
  let lastError
  const attempts = []
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const retryReason = [
      attempt > 1 ? lastError?.message || '' : '',
      repairFeedback ? `上一轮 PDF 对比反馈：${repairFeedback}` : ''
    ].filter(Boolean).join('\n')
    try {
      const { content, messages } = await callModel({
        prompt,
        fileText,
        defaults,
        questionCount: expectedCount,
        sourceBlueprint,
        config,
        retryReason
      })
      attempts.push({ stage: 'worksheet', attempt, messages, raw: content })
      const payload = extractJson(content)
      assertAiWorksheetPayloadSchema(payload, { questionCount: expectedCount, expectedCount, sourceBlueprint })
      const worksheet = assertValidWorksheet(normalizeWorksheet(payload, {
        ...defaults,
        sourceQuestionBlueprints: sourceBlueprint?.sourceQuestionBlueprints,
        examMeta: sourceBlueprint
          ? {
              title: sourceBlueprint.title,
              notice: sourceBlueprint.notice,
              targetPages: sourceBlueprint.targetPages,
              totalScore: 130,
              durationMinutes: 120
            }
          : null
      }))
      assertWorksheetQuality(worksheet)
      assertUploadedSourceUsage(worksheet, fileText)
      assertFullPaperSimulation(worksheet, sourceBlueprint)
      return { worksheet, attempts }
    } catch (error) {
      lastError = error
      if (attempts[attempts.length - 1]?.attempt === attempt) {
        attempts[attempts.length - 1].error = error.message || String(error)
      } else {
        attempts.push({ stage: 'worksheet', attempt, error: error.message || String(error) })
      }
    }
  }
  const error = new Error(`整卷试题生成失败：${lastError?.message || 'unknown error'}`)
  error.debugAttempts = attempts
  throw error
}

function buildBatchWorksheetPrompt({ prompt, defaults, sourceBlueprint, batch, items, retryReason = '', repairFeedback = '' }) {
  const schema = {
    questions: [{
      number: batch.from,
      section: batch.label === '选择题'
        ? '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）'
        : batch.label === '填空题'
          ? '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）'
          : '三、解答题（本大题共 76 分）',
      type: batch.label,
      difficulty: '',
      skill: '',
      question: '',
      options: batch.label === '选择题' ? ['A. ', 'B. ', 'C. ', 'D. '] : [],
      answer: '',
      explanation: ''
    }]
  }
  return {
    system: [
      '你是初中数学命题老师。本阶段只根据蓝图生成一段新题，只输出严格 JSON 对象。',
      `当前只生成第 ${batch.from}-${batch.to} 题（${batch.label}），必须输出 ${batch.expectedCount} 题。`,
      '必须逐题对应蓝图的知识点、难度和题型，但题干、数字、答案必须变化，不能复制 originalStem。',
      batch.label === '选择题' ? '选择题必须有 4 个选项，answer 为 A/B/C/D。' : '',
      batch.label === '填空题' ? '填空题题干必须包含可填写空位，如 ▲ 或 ____。' : '',
      batch.label === '解答题' ? '解答题应适合打印，题干保留必要条件，不要把完整解析写进题干。' : '',
      '每题必须有 question、answer、explanation。',
      '输出 JSON 必须符合 schema：',
      JSON.stringify(schema)
    ].filter(Boolean).join('\n'),
    user: [
      `用户目标：${prompt || '整卷仿真'}`,
      `年级：${defaults.grade || '初一'}`,
      `学科：${defaults.subject || '数学'}`,
      '',
      '整卷元信息：',
      JSON.stringify({
        title: sourceBlueprint.title,
        sections: sourceBlueprint.sections,
        totalQuestions: sourceBlueprint.totalQuestions
      }),
      '',
      '本段逐题蓝图：',
      JSON.stringify(items),
      repairFeedback ? `\n上一轮 PDF 对比反馈：\n${repairFeedback}` : '',
      retryReason ? `\n上一次本段生成不合格：\n${retryReason}` : ''
    ].join('\n')
  }
}

function validateBatchQuestions(payload, batch) {
  const questions = payload?.questions || payload?.worksheet?.questions
  if (!Array.isArray(questions) || questions.length !== batch.expectedCount) {
    throw new Error(`${batch.label}必须生成 ${batch.expectedCount} 题`)
  }
  return questions.map((question, index) => {
    const number = batch.from + index
    if (Number(question.number || number) !== number) throw new Error(`${batch.label}第 ${index + 1} 题题号应为 ${number}`)
    if (!String(question.question || '').trim() || !String(question.answer || '').trim() || !String(question.explanation || '').trim()) {
      throw new Error(`${batch.label}第 ${number} 题缺少题干、答案或解析`)
    }
    const options = Array.isArray(question.options) ? question.options.map(String).filter(Boolean) : []
    if (batch.label === '选择题' && options.length !== 4) throw new Error(`选择题第 ${number} 题必须有 4 个选项`)
    return {
      number,
      section: String(question.section || (batch.label === '选择题'
        ? '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）'
        : batch.label === '填空题'
          ? '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）'
          : '三、解答题（本大题共 76 分）')).trim(),
      type: batch.label,
      difficulty: String(question.difficulty || '中等').trim(),
      skill: String(question.skill || question.knowledgePoint || '综合数学能力').trim(),
      question: String(question.question || '').trim(),
      options,
      answer: String(question.answer || '').trim(),
      explanation: String(question.explanation || '').trim()
    }
  })
}

async function generateWorksheetFromBlueprintInBatches({ prompt, fileText, defaults, sourceBlueprint, config, repairFeedback = '' }) {
  const attempts = []
  const questions = []
  for (const batch of FULL_PAPER_BATCHES) {
    let lastError
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const messages = buildBatchWorksheetPrompt({
        prompt,
        defaults,
        sourceBlueprint,
        batch,
        items: batchItems(sourceBlueprint, batch),
        retryReason: attempt > 1 ? lastError?.message || '' : '',
        repairFeedback
      })
      try {
        const content = await callChatContent({ ...messages, config, temperature: 0.25, maxTokens: 9000 })
        attempts.push({ stage: 'worksheet', batch: batch.id, attempt, messages, raw: content })
        questions.push(...validateBatchQuestions(extractJson(content), batch))
        lastError = null
        break
      } catch (error) {
        lastError = error
        attempts.push({ stage: 'worksheet', batch: batch.id, attempt, messages, error: error.message || String(error) })
      }
    }
    if (lastError) {
      const error = new Error(`${batch.label}试题生成失败：${lastError.message || String(lastError)}`)
      error.debugAttempts = attempts
      throw error
    }
  }
  const payload = {
    title: sourceBlueprint.title || `${defaults.grade || '初一'}${defaults.subject || '数学'}整卷仿真试卷`,
    grade: defaults.grade || '初一',
    subject: defaults.subject || '数学',
    mode: 'exam_simulation',
    sourceAnchors: ['初一数学', '选择题', '填空题', '解答题'],
    examMeta: {
      title: sourceBlueprint.title,
      notice: sourceBlueprint.notice,
      targetPages: sourceBlueprint.targetPages,
      totalScore: 130,
      durationMinutes: 120
    },
    sourceQuestionBlueprints: sourceBlueprint.sourceQuestionBlueprints,
    paperBlueprint: {
      sourceType: 'uploaded_material',
      totalQuestions: 28,
      targetDifficulty: sourceBlueprint.targetDifficulty,
      similarityGoal: '逐题蓝图变式，结构、知识点、难度相似，不复制原题',
      sections: sourceBlueprint.sections,
      sourceQuestionBlueprints: sourceBlueprint.sourceQuestionBlueprints
    },
    questions,
    answerKey: questions.map(question => ({
      number: question.number,
      answer: question.answer,
      explanation: question.explanation
    }))
  }
  const worksheet = assertValidWorksheet(normalizeWorksheet(payload, {
    ...defaults,
    sourceQuestionBlueprints: sourceBlueprint.sourceQuestionBlueprints,
    examMeta: payload.examMeta
  }))
  assertWorksheetQuality(worksheet)
  assertUploadedSourceUsage(worksheet, fileText)
  assertFullPaperSimulation(worksheet, sourceBlueprint)
  return { worksheet, attempts }
}

const OPTIMIZED_FULL_PAPER_GENERATION_BATCHES = [
  { id: 'choice_blank', label: '选择题+填空题', from: 1, to: 18, expectedCount: 18, maxTokens: 12000 },
  { id: 'solution', label: '解答题', from: 19, to: 28, expectedCount: 10, maxTokens: 14000 }
]

function optimizedSectionForNumber(number) {
  if (number <= 10) return {
    type: '选择题',
    section: '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分）'
  }
  if (number <= 18) return {
    type: '填空题',
    section: '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）'
  }
  return {
    type: '解答题',
    section: '三、解答题（本大题共 76 分）'
  }
}

function compactFullPaperBlueprintItem(item) {
  return {
    number: Number(item.number || 0),
    type: String(item.type || optimizedSectionForNumber(Number(item.number || 0)).type),
    score: Number(item.score || 0),
    difficulty: String(item.difficulty || '中等'),
    knowledgePoints: Array.isArray(item.knowledgePoints) ? item.knowledgePoints.map(String).filter(Boolean) : [],
    expectedAnswerShape: String(item.expectedAnswerShape || ''),
    variationPlan: String(item.variationPlan || '')
  }
}

function buildOptimizedFullPaperPrompt({ prompt, defaults, sourceBlueprint, batch, retryReason = '', repairFeedback = '' }) {
  const items = (sourceBlueprint.sourceQuestionBlueprints || [])
    .filter(item => Number(item.number) >= batch.from && Number(item.number) <= batch.to)
    .map(compactFullPaperBlueprintItem)
  const schema = {
    questions: [{
      number: batch.from,
      section: optimizedSectionForNumber(batch.from).section,
      type: optimizedSectionForNumber(batch.from).type,
      difficulty: '中等',
      skill: '知识点',
      question: '题干',
      questionLatex: 'optional LaTeX math expression for the stem',
      diagramSpec: { type: 'template', templateId: 'triangle_ruler_overlap_angle', labels: [] },
      tableSpec: { headers: [], rows: [] },
      options: batch.from <= 10 ? ['A', 'B', 'C', 'D'] : [],
      answer: '答案',
      answerLatex: 'optional LaTeX math expression for the answer',
      explanation: '一句短解析',
      explanationSteps: ['自然步骤，不写序号'],
      proofSteps: ['证明题可选步骤，不写序号']
    }]
  }
  return {
    system: [
      '你是初一数学命题老师，只返回严格 JSON 对象，不要 Markdown。',
      `任务：按蓝图生成第 ${batch.from}-${batch.to} 题，共 ${batch.expectedCount} 道${batch.label}变式新题。`,
      '题号、题型、知识点、难度必须逐题对应蓝图；数字、条件、图形关系或情境必须变化，禁止复制原题。',
      '选择题必须有 4 个 options，answer 只写 A/B/C/D；填空题和解答题不要 options。',
      '输出要像正式期末试卷：题干完整、条件清楚、语言自然，不要像摘要或知识点清单。',
      '涉及图形的题目，不要写“图略”“需具体图形”“按变式给出”等占位词；题干可写“如图”，PDF 渲染器会补示意图。',
      '选择/填空题 question 建议 45-140 字；解答题 question 建议 90-260 字；explanation 简洁但必须能校验答案。',
      '不要写命题思路，不要把完整解析写进题干。',
      'question 字段写自然中文题干；questionLatex/answerLatex 字段写标准 LaTeX 数学表达式。',
      'explanationSteps/proofSteps 必须把解析拆成自然步骤，不要在步骤里写 1、2、3 等序号；不要把解析塞成一大段。',
      '只返回符合 schema 的 JSON：',
      'Use LaTeX only in questionLatex/answerLatex, for example a^2, \\frac{1}{2}, \\sqrt{5}, \\angle ABC.',
      'For geometry questions, diagramSpec is required. Geometry diagramSpec must include points, segments, labels. Parallel diagrams must include parallelMarks. Congruent diagrams must include equalMarks. Grid diagrams must include gridSpec.',
      'Prefer semantic templateId over free coordinates when possible. Known geometry templateIds: triangle_ruler_overlap_angle, congruent_triangles_on_line, parallel_lines_transversal, grid_triangle_construction, angle_bisector_rays.',
      'For table/application questions, tableSpec is required when the source question has a table.',
      JSON.stringify(schema)
    ].join('\n'),
    user: [
      `用户目标：${prompt || '整卷仿真'}`,
      `年级：${defaults.grade || '初一'}`,
      `学科：${defaults.subject || '数学'}`,
      `试卷标题：${sourceBlueprint.title || '初一数学期末仿真试卷'}`,
      '',
      '逐题蓝图：',
      JSON.stringify(items),
      repairFeedback ? `\n上一轮 PDF 对比反馈：\n${repairFeedback}` : '',
      retryReason ? `\n上一轮本批生成失败，必须修正：\n${retryReason}` : ''
    ].join('\n')
  }
}

function validateOptimizedFullPaperQuestions(payload, batch) {
  const questions = payload?.questions || payload?.worksheet?.questions
  if (!Array.isArray(questions) || questions.length !== batch.expectedCount) {
    throw new Error(`${batch.label}必须生成 ${batch.expectedCount} 题，当前 ${Array.isArray(questions) ? questions.length : 0}`)
  }
  return questions.map((question, index) => {
    const number = batch.from + index
    const sectionInfo = optimizedSectionForNumber(number)
    if (Number(question.number || number) !== number) {
      throw new Error(`${batch.label}第 ${index + 1} 题题号应为 ${number}`)
    }
    const options = Array.isArray(question.options) ? question.options.map(String).filter(Boolean) : []
    if (sectionInfo.type === '选择题' && options.length !== 4) {
      throw new Error(`选择题第 ${number} 题必须有 4 个选项`)
    }
    if (!String(question.question || '').trim() || !String(question.answer || '').trim() || !String(question.explanation || '').trim()) {
      throw new Error(`${batch.label}第 ${number} 题缺少题干、答案或解析`)
    }
    const normalizedDiagram = normalizeGeometryDiagramSpec(question.diagramSpec, number)
    return {
      number,
      section: String(question.section || sectionInfo.section).trim(),
      type: sectionInfo.type,
      difficulty: String(question.difficulty || '中等').trim(),
      skill: String(question.skill || question.knowledgePoint || '综合数学能力').trim(),
      question: String(question.question || '').trim(),
      questionLatex: String(question.questionLatex || question.latexQuestion || question.latex || '').trim(),
      options,
      answer: String(question.answer || '').trim(),
      answerLatex: String(question.answerLatex || '').trim(),
      diagramSpec: normalizedDiagram.spec,
      diagramSpecSource: normalizedDiagram.source,
      tableSpec: question.tableSpec && typeof question.tableSpec === 'object' && !Array.isArray(question.tableSpec) ? question.tableSpec : null,
      explanation: String(question.explanation || '').trim(),
      explanationSteps: Array.isArray(question.explanationSteps) ? question.explanationSteps : [],
      proofSteps: Array.isArray(question.proofSteps) ? question.proofSteps : []
    }
  })
}

async function generateWorksheetFromBlueprintOptimized({ prompt, fileText, defaults, sourceBlueprint, config, repairFeedback = '' }) {
  const attempts = []
  const questions = []
  for (const batch of OPTIMIZED_FULL_PAPER_GENERATION_BATCHES) {
    let lastError
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const messages = buildOptimizedFullPaperPrompt({
        prompt,
        defaults,
        sourceBlueprint,
        batch,
        retryReason: attempt > 1 ? lastError?.message || '' : '',
        repairFeedback
      })
      try {
        const content = await callChatContent({ ...messages, config, temperature: 0.25, maxTokens: batch.maxTokens })
        attempts.push({ stage: 'worksheet', batch: batch.id, attempt, messages, raw: content })
        questions.push(...validateOptimizedFullPaperQuestions(extractJson(content), batch))
        lastError = null
        break
      } catch (error) {
        lastError = error
        attempts.push({ stage: 'worksheet', batch: batch.id, attempt, messages, error: error.message || String(error) })
      }
    }
    if (lastError) {
      const error = new Error(`${batch.label}试题生成失败：${lastError.message || String(lastError)}`)
      error.debugAttempts = attempts
      throw error
    }
  }
  const payload = {
    title: sourceBlueprint.title || `${defaults.grade || '初一'}${defaults.subject || '数学'}整卷仿真试卷`,
    grade: defaults.grade || '初一',
    subject: defaults.subject || '数学',
    mode: 'exam_simulation',
    sourceAnchors: ['初一数学', '选择题', '填空题', '解答题'],
    examMeta: {
      title: sourceBlueprint.title,
      notice: sourceBlueprint.notice,
      targetPages: sourceBlueprint.targetPages,
      totalScore: 130,
      durationMinutes: 120
    },
    sourceQuestionBlueprints: sourceBlueprint.sourceQuestionBlueprints,
    paperBlueprint: {
      sourceType: 'uploaded_material',
      totalQuestions: 28,
      targetDifficulty: sourceBlueprint.targetDifficulty,
      similarityGoal: '逐题蓝图变式，结构、知识点、难度和打印观感接近原卷，但不复制原题。',
      sections: sourceBlueprint.sections,
      sourceQuestionBlueprints: sourceBlueprint.sourceQuestionBlueprints
    },
    questions,
    answerKey: questions.map(question => ({
      number: question.number,
      answer: question.answer,
      explanation: question.explanation
    }))
  }
  const worksheet = assertValidWorksheet(normalizeWorksheet(payload, {
    ...defaults,
    sourceQuestionBlueprints: sourceBlueprint.sourceQuestionBlueprints,
    examMeta: payload.examMeta
  }))
  assertWorksheetQuality(worksheet)
  assertUploadedSourceUsage(worksheet, fileText)
  assertFullPaperSimulation(worksheet, sourceBlueprint)
  return { worksheet, attempts }
}

export async function generateFullPaperWithAI({ prompt, fileText = '', grade = '', subject = '', difficulty = '', mode = 'exam_simulation', questionCount = 28, repairFeedback = '' }) {
  const baseDefaults = worksheetDefaults({ prompt, grade, subject, difficulty, mode })
  const defaults = { ...baseDefaults, mode: 'exam_simulation' }
  const config = aiRuntimeConfig()
  if (config.mockMode) {
    throw new Error('整卷真实验收禁止 AI_MOCK_MODE=true，请设置 AI_MOCK_MODE=false。')
  }
  if (config.fallbackToMock) {
    throw new Error('整卷真实验收禁止 AI_FALLBACK_TO_MOCK=true，请设置 AI_FALLBACK_TO_MOCK=false。')
  }
  if (!config.apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY 或 AI_API_KEY，已禁止使用 demo/mock 题目。请在服务端环境变量配置 DeepSeek API Key 后重启后端。')
  }
  const baselineBlueprint = extractExamBlueprintFromText(fileText, defaults)
  if (!baselineBlueprint) {
    throw new Error('无法从原始 PDF 文本识别 28 题整卷结构，不能开始真 AI 整卷仿真。')
  }
  const debug = []
  const analysis = await analyzeFullPaperBlueprint({ prompt, fileText, defaults, baselineBlueprint, config, repairFeedback })
  debug.push(...analysis.attempts)
  const generated = await generateWorksheetFromBlueprintOptimized({
    prompt,
    fileText,
    defaults,
    sourceBlueprint: analysis.blueprint,
    config,
    repairFeedback
  })
  debug.push(...generated.attempts)
  return { worksheet: generated.worksheet, source: 'ai', sourceBlueprint: analysis.blueprint, aiDebug: debug }
}

function createFallbackWorksheet({ prompt, grade, subject, difficulty, mode, questionCount, defaults, sourceBlueprint, reason }) {
  const worksheet = assertValidWorksheet(normalizeWorksheet(createMockWorksheet(prompt, {
    grade,
    subject,
    difficulty,
    mode,
    questionCount: Number(sourceBlueprint?.totalQuestions || expectedQuestionCount(questionCount)),
    sourceBlueprint
  }), defaults))
  return { worksheet, source: 'mock', fallbackReason: reason || 'mock fallback' }
}

export async function generateWorksheetWithAI({ prompt, fileText = '', grade = '', subject = '', difficulty = '', mode = '', questionCount = 0 }) {
  const baseDefaults = worksheetDefaults({ prompt, grade, subject, difficulty, mode })
  const fullPaperRequested = isFullPaperSimulation({ mode: baseDefaults.mode, prompt, fileText })
  const sourceBlueprint = fullPaperRequested ? extractExamBlueprintFromText(fileText, baseDefaults) : null
  const normalizedMode = sourceBlueprint ? 'exam_simulation' : baseDefaults.mode
  const defaults = { ...baseDefaults, mode: normalizedMode }
  const expectedCount = Number(sourceBlueprint?.totalQuestions || expectedQuestionCount(questionCount))
  const config = aiRuntimeConfig()
  if (config.mockMode) {
    return createFallbackWorksheet({
      prompt,
      grade,
      subject,
      difficulty,
      mode,
      questionCount: expectedCount,
      defaults,
      sourceBlueprint,
      reason: 'AI_MOCK_MODE enabled'
    })
  }
  if (!config.apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY 或 AI_API_KEY，已禁止使用 demo/mock 题目。请在服务端环境变量配置 DeepSeek API Key 后重启后端。')
  }

  if (fullPaperRequested && sourceBlueprint) {
    return generateFullPaperWithAI({ prompt, fileText, grade, subject, difficulty, mode: normalizedMode, questionCount: expectedCount })
  }

  let lastError
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { content } = await callModel({
        prompt,
        fileText,
        defaults,
        questionCount: expectedCount,
        sourceBlueprint,
        config,
        retryReason: attempt > 1 ? lastError?.message || '' : ''
      })
      const payload = extractJson(content)
      assertAiWorksheetPayloadSchema(payload, { questionCount, expectedCount, sourceBlueprint })
      const worksheet = assertValidWorksheet(normalizeWorksheet(payload, {
        ...defaults,
        sourceQuestionBlueprints: sourceBlueprint?.sourceQuestionBlueprints,
        examMeta: sourceBlueprint
          ? {
              title: sourceBlueprint.title,
              notice: sourceBlueprint.notice,
              targetPages: sourceBlueprint.targetPages,
              totalScore: 130,
              durationMinutes: 120
            }
          : null
      }))
      assertWorksheetQuality(worksheet)
      assertUploadedSourceUsage(worksheet, fileText)
      assertFullPaperSimulation(worksheet, sourceBlueprint)
      return { worksheet, source: 'ai' }
    } catch (error) {
      lastError = error
    }
  }

  if (config.fallbackToMock) {
    return createFallbackWorksheet({
      prompt,
      grade,
      subject,
      difficulty,
      mode,
      questionCount: expectedCount,
      defaults,
      sourceBlueprint,
      reason: lastError?.message || 'AI generation failed'
    })
  }

  throw new Error(`DeepSeek 真实生成失败，已禁止使用 demo/mock 题目：${lastError?.message || 'AI generation failed'}`)
}
