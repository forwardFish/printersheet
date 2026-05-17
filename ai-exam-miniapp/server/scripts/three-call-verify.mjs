import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFParse } from 'pdf-parse'
import { aiRuntimeConfig, extractJson } from '../src/lib/ai.js'
import { buildPdf } from '../src/lib/buildPdf.js'
import { extractExamBlueprintFromText, validateExamBlueprint } from '../src/lib/examBlueprint.js'
import { assertValidWorksheet, normalizeWorksheet } from '../src/lib/worksheet.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(scriptDir, '..')
const projectRoot = path.resolve(serverRoot, '..', '..')
const targetPdf = path.join(projectRoot, 'docs', 'test', 'pdf', '初一数学.pdf')
const outputDir = path.join(projectRoot, 'docs', 'test', 'generated', 'three-call')

const timeoutMs = Number(process.env.THREE_CALL_TIMEOUT_MS || process.env.AI_REQUEST_TIMEOUT_MS || 420000)
const modelMaxTokens = Number(process.env.AI_MAX_TOKENS || 24000)

async function readPdfText(file) {
  const data = await fs.readFile(file)
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    return {
      pages: Number(result.total || result.numpages || 0),
      text: String(result.text || '').replace(/\s+/g, ' ').trim()
    }
  } finally {
    await parser.destroy?.()
  }
}

async function callJson({ label, system, user, config, maxTokens = modelMaxTokens, temperature = 0.25 }) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const promptPath = path.join(outputDir, `${label}.prompt.json`)
  const rawPath = path.join(outputDir, `${label}.raw.json`)
  await fs.writeFile(promptPath, JSON.stringify({ system, user, maxTokens, temperature }, null, 2), 'utf8')
  const requestBody = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  }
  if (config.providerId === 'deepseek' && /^deepseek-v4-/i.test(config.model || '')) {
    requestBody.thinking = { type: config.thinkingMode || 'disabled' }
  }
  try {
    console.log(`[${label}] calling ${config.model}, max_tokens=${maxTokens}, timeout=${timeoutMs}ms`)
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${label} DeepSeek HTTP ${res.status}: ${body.slice(0, 500)}`)
    }
    const responseBody = await res.json()
    await fs.writeFile(rawPath, JSON.stringify(responseBody, null, 2), 'utf8')
    const content = responseBody.choices?.[0]?.message?.content || ''
    if (!content.trim()) throw new Error(`${label} DeepSeek returned empty content`)
    const parsed = extractJsonLenient(content)
    const elapsedMs = Date.now() - startedAt
    console.log(`[${label}] done in ${Math.round(elapsedMs / 1000)}s`)
    return { parsed, elapsedMs, promptPath, rawPath, contentLength: content.length }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${label} DeepSeek timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function extractJsonLenient(text) {
  try {
    return extractJson(text)
  } catch (error) {
    const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) throw error
    const candidate = cleaned.slice(start, end + 1)
    return JSON.parse(candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'))
  }
}

function compactBlueprintItem(item, { includeStem = true } = {}) {
  const compact = {
    number: item.number,
    type: item.type,
    score: item.score,
    difficulty: item.difficulty,
    knowledgePoints: item.knowledgePoints,
    expectedAnswerShape: item.expectedAnswerShape,
    variationPlan: item.variationPlan
  }
  if (includeStem) compact.originalStem = String(item.originalStem || '').slice(0, 100)
  return compact
}

function sectionForNumber(number) {
  if (number <= 10) return '选择题'
  if (number <= 18) return '填空题'
  return '解答题'
}

function buildBlueprintPrompt({ sourceText, baseline }) {
  return {
    system: [
      '你是初一数学试卷分析专家，只返回 JSON，不要 Markdown。',
      '任务：基于原始 PDF 文本，产出 28 题整卷仿真蓝图。',
      '每题必须包含 originalStem、knowledgePoints、variationPlan、difficulty、type、score、expectedAnswerShape。',
      '题型必须严格为 1-10 选择题、11-18 填空题、19-28 解答题。',
      'originalStem 可摘要，不要长篇抄原题；variationPlan 要说明怎样变式，保证不是逐字复制。',
      '不要使用 LaTeX 反斜杠命令；分数写成 1/2，根号写成 根号4，幂写成 x^2。'
    ].join('\n'),
    user: [
      '返回 JSON schema：',
      JSON.stringify({
        title: '初一数学期末仿真试卷',
        notice: ['注意事项 1', '注意事项 2', '注意事项 3'],
        totalQuestions: 28,
        targetPages: 6,
        targetDifficulty: '混合',
        sections: [
          { name: '一、选择题（本大题共10小题，每小题3分，共30分）', type: '选择题', questionCount: 10, points: 30, difficulty: '基础-中等', skills: [] },
          { name: '二、填空题（本大题共8小题，每小题3分，共24分）', type: '填空题', questionCount: 8, points: 24, difficulty: '基础-中等', skills: [] },
          { name: '三、解答题（本大题共10小题，共76分）', type: '解答题', questionCount: 10, points: 76, difficulty: '中等-较难', skills: [] }
        ],
        sourceQuestionBlueprints: [compactBlueprintItem(baseline.sourceQuestionBlueprints[0])]
      }),
      '',
      '本地初步识别蓝图，用它校准题号/题型/分值，不要减少题目：',
      JSON.stringify({
        title: baseline.title,
        totalQuestions: baseline.totalQuestions,
        sections: baseline.sections,
        sourceQuestionBlueprints: baseline.sourceQuestionBlueprints.map(compactBlueprintItem)
      }),
      '',
      '原始 PDF 文本：',
      sourceText.slice(0, 22000)
    ].join('\n')
  }
}

function buildQuestionPrompt({ label, blueprint, numbers, title, grade, subject }) {
  const sectionName = numbers.map(sectionForNumber).filter((item, index, arr) => arr.indexOf(item) === index).join('+')
  const items = blueprint.sourceQuestionBlueprints
    .filter(item => numbers.includes(Number(item.number)))
    .map(item => compactBlueprintItem(item, { includeStem: false }))
  return {
    system: [
      '你是初一数学命题老师，只返回 JSON，不要 Markdown。',
      `任务：按给定蓝图生成 ${numbers.length} 道${sectionName}变式新题。`,
      '必须逐题对应蓝图的题号、题型、知识点、难度和答案形态。',
      '必须改变数字、条件、图形关系或情境，禁止复制原题。',
      '选择题必须有 4 个 options，answer 用 A/B/C/D；填空题和解答题不需要 options。',
      'question 写学生试卷题干；answer 写标准答案；explanation 写简要解题过程。',
      '不要输出整份试卷，只输出本批 questions 数组。',
      '输出必须极简：选择/填空题 question 不超过 90 字，解答题 question 不超过 180 字，explanation 不超过 45 字。',
      '不要展开长证明，不要写命题思路，不要自我解释。',
      '不要使用 LaTeX 反斜杠命令；分数写成 1/2，根号写成 根号4，幂写成 x^2。'
    ].join('\n'),
    user: [
      `批次：${label}`,
      `年级：${grade}`,
      `学科：${subject}`,
      `标题：${title}`,
      `题号范围：${numbers[0]}-${numbers[numbers.length - 1]}`,
      '',
      '返回 JSON schema：',
      JSON.stringify({
        questions: [{
          number: numbers[0],
          section: sectionForNumber(numbers[0]),
          type: sectionForNumber(numbers[0]),
          difficulty: '中等',
          skill: '知识点',
          question: '题干',
          options: sectionForNumber(numbers[0]) === '选择题' ? ['A', 'B', 'C', 'D'] : [],
          answer: '答案',
          explanation: '解析'
        }]
      }),
      '',
      '逐题蓝图：',
      JSON.stringify(items)
    ].join('\n')
  }
}

function countByType(questions = []) {
  return questions.reduce((acc, question) => {
    const type = `${question.type || ''}${question.section || ''}`
    if (type.includes('选择')) acc.choice += 1
    else if (type.includes('填空')) acc.blank += 1
    else if (type.includes('解答')) acc.solution += 1
    return acc
  }, { choice: 0, blank: 0, solution: 0 })
}

function scoreWorksheet({ worksheet, generatedPdfInfo }) {
  const questions = worksheet.questions || []
  const counts = countByType(questions)
  const pages = Number(generatedPdfInfo.pages || 0)
  const text = JSON.stringify(worksheet, null, 2)
  const expectedKnowledge = ['幂', '三角形', '数轴', '实数', '整式', '角', '方程组', '不等式', '因式分解', '全等', '面积', '规律']
  const knowledgeHits = expectedKnowledge.filter(keyword => text.includes(keyword))
  const checks = [
    questions.length === 28,
    counts.choice === 10,
    counts.blank === 8,
    counts.solution === 10,
    pages >= 5 && pages <= 7,
    worksheet.sourceQuestionBlueprints?.length === 28,
    !String(generatedPdfInfo.text || '').includes('答案与解析')
  ]
  const structureScore = Math.round(checks.filter(Boolean).length / checks.length * 100)
  const knowledgeScore = Math.round(knowledgeHits.length / expectedKnowledge.length * 100)
  const pageScore = pages >= 5 && pages <= 7 ? 100 : Math.max(0, 100 - Math.abs(pages - 6) * 25)
  const finalScore = Math.round(structureScore * 0.55 + knowledgeScore * 0.25 + pageScore * 0.2)
  const failures = [
    questions.length === 28 ? '' : `题量应为 28，当前 ${questions.length}`,
    counts.choice === 10 && counts.blank === 8 && counts.solution === 10 ? '' : `题型应为 10/8/10，当前 ${counts.choice}/${counts.blank}/${counts.solution}`,
    pages >= 5 && pages <= 7 ? '' : `页数应为 5-7，当前 ${pages}`,
    knowledgeScore >= 75 ? '' : `知识点覆盖不足：${knowledgeHits.join('、')}`,
    String(generatedPdfInfo.text || '').includes('答案与解析') ? '学生版 PDF 不应包含答案页' : ''
  ].filter(Boolean)
  return {
    verdict: finalScore >= 85 ? 'PASS' : 'REPAIR_REQUIRED',
    finalScore,
    structureScore,
    knowledgeScore,
    pageScore,
    pages,
    typeCounts: counts,
    knowledgeHits,
    failures
  }
}

async function run() {
  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_FALLBACK_TO_MOCK = 'false'
  process.env.AI_REQUEST_TIMEOUT_MS = String(timeoutMs)

  await fs.mkdir(outputDir, { recursive: true })
  const config = aiRuntimeConfig()
  if (!config.apiKey) {
    throw new Error('BLOCKED: missing DEEPSEEK_API_KEY or AI_API_KEY')
  }
  if (config.mockMode || config.fallbackToMock) {
    throw new Error('BLOCKED: AI_MOCK_MODE and AI_FALLBACK_TO_MOCK must both be false')
  }

  const targetInfo = await readPdfText(targetPdf)
  const baseline = extractExamBlueprintFromText(targetInfo.text, { grade: '初一', subject: '数学', difficulty: '混合' })
  if (!baseline) throw new Error('无法从目标 PDF 识别整卷蓝图')

  const timings = []
  const blueprintPath = path.join(outputDir, 'blueprint.json')
  let blueprint
  try {
    const existing = JSON.parse(await fs.readFile(blueprintPath, 'utf8'))
    blueprint = validateExamBlueprint(existing)
    timings.push({ label: '01-blueprint', elapsedMs: 0, contentLength: 0, reused: true })
    console.log('[01-blueprint] reused existing blueprint.json')
  } catch {
    const blueprintPrompt = buildBlueprintPrompt({ sourceText: targetInfo.text, baseline })
    const blueprintCall = await callJson({
      label: '01-blueprint',
      ...blueprintPrompt,
      config,
      maxTokens: 12000,
      temperature: 0.15
    })
    timings.push({ label: '01-blueprint', elapsedMs: blueprintCall.elapsedMs, contentLength: blueprintCall.contentLength })
    blueprint = validateExamBlueprint({
      ...baseline,
      ...blueprintCall.parsed,
      totalQuestions: 28
    })
    await fs.writeFile(blueprintPath, JSON.stringify(blueprint, null, 2), 'utf8')
  }

  const firstPrompt = buildQuestionPrompt({
    label: '选择题+填空题',
    blueprint,
    numbers: Array.from({ length: 18 }, (_, index) => index + 1),
    title: blueprint.title,
    grade: '初一',
    subject: '数学'
  })
  const firstQuestions = await callJson({
    label: '02-choice-blank',
    ...firstPrompt,
    config,
    maxTokens: 8000,
    temperature: 0.25
  })
  timings.push({ label: '02-choice-blank', elapsedMs: firstQuestions.elapsedMs, contentLength: firstQuestions.contentLength })

  const secondPrompt = buildQuestionPrompt({
    label: '解答题',
    blueprint,
    numbers: Array.from({ length: 10 }, (_, index) => index + 19),
    title: blueprint.title,
    grade: '初一',
    subject: '数学'
  })
  const secondQuestions = await callJson({
    label: '03-solution',
    ...secondPrompt,
    config,
    maxTokens: 10000,
    temperature: 0.25
  })
  timings.push({ label: '03-solution', elapsedMs: secondQuestions.elapsedMs, contentLength: secondQuestions.contentLength })

  const questions = [
    ...(Array.isArray(firstQuestions.parsed.questions) ? firstQuestions.parsed.questions : []),
    ...(Array.isArray(secondQuestions.parsed.questions) ? secondQuestions.parsed.questions : [])
  ].sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
  if (questions.length !== 28) throw new Error(`three-call generated ${questions.length} questions, expected 28`)

  const worksheet = normalizeWorksheet({
    title: blueprint.title || '初一数学期末仿真试卷',
    grade: '初一',
    subject: '数学',
    mode: 'exam_simulation',
    examMeta: {
      title: blueprint.title || '初一数学期末仿真试卷',
      notice: blueprint.notice,
      targetPages: 6,
      totalScore: 130,
      durationMinutes: 120
    },
    paperBlueprint: {
      sourceType: 'uploaded_pdf_three_call_ai',
      totalQuestions: 28,
      targetDifficulty: blueprint.targetDifficulty,
      similarityGoal: '结构、知识点、难度、题量和打印观感接近原卷，但题目为变式新题。',
      sections: blueprint.sections,
      sourceQuestionBlueprints: blueprint.sourceQuestionBlueprints
    },
    sourceQuestionBlueprints: blueprint.sourceQuestionBlueprints,
    questions
  }, {
    grade: '初一',
    subject: '数学',
    difficulty: '混合',
    mode: 'exam_simulation',
    sourceQuestionBlueprints: blueprint.sourceQuestionBlueprints,
    examMeta: { title: blueprint.title, notice: blueprint.notice, targetPages: 6 }
  })
  assertValidWorksheet(worksheet)

  const worksheetPath = path.join(outputDir, 'worksheet.json')
  const pdfPath = path.join(outputDir, 'worksheet.pdf')
  await fs.writeFile(worksheetPath, JSON.stringify({ worksheet, timings }, null, 2), 'utf8')
  await buildPdf({ worksheet, outputPath: pdfPath, watermark: false })
  const generatedPdfInfo = await readPdfText(pdfPath)
  const score = scoreWorksheet({ worksheet, generatedPdfInfo })
  const report = {
    verdict: score.verdict,
    model: config.model,
    targetPdf,
    targetPages: targetInfo.pages,
    worksheetPath,
    pdfPath,
    blueprintPath: path.join(outputDir, 'blueprint.json'),
    timings,
    score
  }
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = score.verdict === 'PASS' ? 0 : 1
}

run().catch(async error => {
  await fs.mkdir(outputDir, { recursive: true })
  const report = {
    verdict: String(error.message || error).startsWith('BLOCKED') ? 'BLOCKED' : 'REPAIR_REQUIRED',
    error: error.message || String(error)
  }
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8')
  console.error(JSON.stringify(report, null, 2))
  process.exitCode = 1
})
