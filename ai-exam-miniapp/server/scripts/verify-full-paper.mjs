import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFParse } from 'pdf-parse'
import { aiRuntimeConfig, generateFullPaperWithAI } from '../src/lib/ai.js'
import { buildPdf } from '../src/lib/buildPdf.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(scriptDir, '..')
const projectRoot = path.resolve(serverRoot, '..', '..')
const targetPdf = path.join(projectRoot, 'docs', 'test', 'pdf', '初一数学.pdf')
const generatedRoot = path.join(projectRoot, 'docs', 'test', 'generated')
const maxRounds = Number(process.env.FULL_PAPER_VERIFY_ROUNDS || 5)

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

function countByType(questions = []) {
  return questions.reduce((acc, question) => {
    const type = String(question.type || question.section || '')
    if (type.includes('选择')) acc.choice += 1
    else if (type.includes('填空')) acc.blank += 1
    else if (type.includes('解答')) acc.solution += 1
    return acc
  }, { choice: 0, blank: 0, solution: 0 })
}

function keywordScore(worksheet) {
  const expected = ['幂', '三角形', '数轴', '整式', '角', '方程组', '不等式', '因式分解', '全等', '面积', '规律']
  const text = JSON.stringify(worksheet, null, 2)
  const hits = expected.filter(keyword => text.includes(keyword))
  return {
    hits,
    score: Math.round((hits.length / expected.length) * 100)
  }
}

function scoreWorksheet({ worksheet, generatedPdfInfo }) {
  const counts = countByType(worksheet.questions || [])
  const pdfText = String(generatedPdfInfo?.text || '')
  const structureChecks = [
    (worksheet.questions || []).length === 28,
    counts.choice === 10,
    counts.blank === 8,
    counts.solution === 10,
    (worksheet.paperBlueprint?.totalQuestions || 0) === 28,
    (worksheet.sourceQuestionBlueprints || []).length === 28,
    /注意事项/.test(pdfText),
    /选择题/.test(pdfText) && /填空题/.test(pdfText) && /解答题/.test(pdfText),
    !/答案与解析/.test(pdfText)
  ]
  const pages = Number(generatedPdfInfo?.pages || 0)
  const pageScore = pages >= 5 && pages <= 7 ? 100 : Math.max(0, 100 - Math.abs(pages - 6) * 25)
  const knowledge = keywordScore(worksheet)
  const structureScore = Math.round(structureChecks.filter(Boolean).length / structureChecks.length * 100)
  const finalScore = Math.round(structureScore * 0.5 + knowledge.score * 0.3 + pageScore * 0.2)
  return {
    finalScore,
    structureScore,
    knowledgeScore: knowledge.score,
    pageScore,
    pages,
    typeCounts: counts,
    knowledgeHits: knowledge.hits,
    failures: [
      (worksheet.questions || []).length === 28 ? '' : `题量应为 28，当前 ${(worksheet.questions || []).length}`,
      counts.choice === 10 && counts.blank === 8 && counts.solution === 10 ? '' : `题型应为 10/8/10，当前 ${counts.choice}/${counts.blank}/${counts.solution}`,
      pages >= 5 && pages <= 7 ? '' : `页数应为 5-7，当前 ${pages}`,
      /注意事项/.test(pdfText) ? '' : 'PDF 缺少注意事项',
      /选择题/.test(pdfText) && /填空题/.test(pdfText) && /解答题/.test(pdfText) ? '' : 'PDF 缺少三大题标题',
      !/答案与解析/.test(pdfText) ? '' : '学生版 PDF 不应默认包含答案与解析',
      knowledge.score >= 80 ? '' : `知识点覆盖不足：${knowledge.hits.join('、')}`
    ].filter(Boolean),
    verdict: finalScore >= 85 ? 'PASS' : 'REPAIR_REQUIRED'
  }
}

function repairFeedbackFromScore(score = {}) {
  const failures = Array.isArray(score.failures) ? score.failures : []
  if (!failures.length) return ''
  return [
    '上一轮未通过，请按以下问题修正：',
    ...failures.map(item => `- ${item}`),
    '保持 28 题、10/8/10 分区，不复制原题，PDF 学生版不要答案页。'
  ].join('\n')
}

function markdownReport(rounds, targetInfo) {
  const best = [...rounds].sort((a, b) => (b.score?.finalScore || 0) - (a.score?.finalScore || 0))[0]
  const lines = [
    '# 初一数学整卷仿真对比报告',
    '',
    `目标 PDF: ${targetPdf}`,
    `目标页数: ${targetInfo.pages}`,
    `最大轮次: ${maxRounds}`,
    '',
    `最终结论: ${best?.score?.verdict || best?.verdict || 'BLOCKED'}`,
    best?.blockedReason ? `阻塞原因: ${best.blockedReason}` : '',
    best?.pdfPath ? `最佳 PDF: ${best.pdfPath}` : '',
    best?.jsonPath ? `最佳 JSON: ${best.jsonPath}` : '',
    best?.debugPath ? `最佳调试记录: ${best.debugPath}` : '',
    '',
    '| 轮次 | 结论 | 总分 | 结构 | 知识点 | 页数 | 题型 | 失败摘要 |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |'
  ].filter(Boolean)
  for (const round of rounds) {
    const score = round.score || {}
    const counts = score.typeCounts || {}
    const failures = (score.failures || []).join('<br>') || round.blockedReason || ''
    lines.push(`| ${round.round} | ${score.verdict || round.verdict || 'BLOCKED'} | ${score.finalScore ?? 0} | ${score.structureScore ?? 0} | ${score.knowledgeScore ?? 0} | ${score.pages ?? 0} | ${counts.choice ?? 0}/${counts.blank ?? 0}/${counts.solution ?? 0} | ${failures} |`)
  }
  if (best?.score?.verdict !== 'PASS') {
    lines.push('', '## Remaining Gaps')
    lines.push('- 结构、知识点或页数评分未达到阈值，保持 REPAIR_REQUIRED。')
    if (best?.blockedReason) lines.push(`- ${best.blockedReason}`)
  }
  return `${lines.join('\n')}\n`
}

async function run() {
  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_FALLBACK_TO_MOCK = 'false'
  process.env.AI_REQUEST_TIMEOUT_MS = process.env.AI_REQUEST_TIMEOUT_MS || '240000'
  process.env.AI_MAX_TOKENS = process.env.AI_MAX_TOKENS || '24000'
  const targetInfo = await readPdfText(targetPdf)
  const rounds = []
  const config = aiRuntimeConfig()
  if (config.mockMode || config.fallbackToMock || !config.apiKey) {
    rounds.push({
      round: 1,
      verdict: 'BLOCKED',
      blockedReason: !config.apiKey
        ? '未配置 DEEPSEEK_API_KEY 或 AI_API_KEY，已禁止使用 demo/mock 题目。请在服务端环境变量配置 DeepSeek API Key 后重启后端。'
        : '真实验收要求 AI_MOCK_MODE=false 且 AI_FALLBACK_TO_MOCK=false。'
    })
    const report = markdownReport(rounds, targetInfo)
    await fs.mkdir(generatedRoot, { recursive: true })
    await fs.writeFile(path.join(generatedRoot, 'full-paper-compare-report.md'), report, 'utf8')
    console.log(report)
    process.exitCode = 1
    return
  }
  let repairFeedback = ''
  for (let round = 1; round <= maxRounds; round += 1) {
    const roundDir = path.join(generatedRoot, `round-${round}`)
    await fs.mkdir(roundDir, { recursive: true })
    const statusPath = path.join(roundDir, 'status.json')
    await fs.writeFile(statusPath, JSON.stringify({
      round,
      status: 'started',
      startedAt: new Date().toISOString(),
      model: config.model
    }, null, 2), 'utf8')
    try {
      console.log(`[round ${round}] start full-paper generation with ${config.model}`)
      const generated = await generateFullPaperWithAI({
        prompt: [
          '请基于上传的初一数学期末试卷生成一份整卷仿真试卷。',
          '必须保持 10 道选择题、8 道填空题、10 道解答题，共 28 题。',
          '必须逐题变式，不得复制原题。'
        ].join('\n'),
        fileText: targetInfo.text,
        grade: '初一',
        subject: '数学',
        difficulty: '混合',
        mode: 'exam_simulation',
        questionCount: 28,
        repairFeedback
      })
      const jsonPath = path.join(roundDir, 'worksheet.json')
      const pdfPath = path.join(roundDir, 'worksheet.pdf')
      const debugPath = path.join(roundDir, 'ai-debug.json')
      await fs.writeFile(statusPath, JSON.stringify({
        round,
        status: 'ai_completed',
        aiCompletedAt: new Date().toISOString(),
        debugPath
      }, null, 2), 'utf8')
      await fs.writeFile(jsonPath, JSON.stringify(generated, null, 2), 'utf8')
      await fs.writeFile(debugPath, JSON.stringify(generated.aiDebug || [], null, 2), 'utf8')
      await buildPdf({ worksheet: generated.worksheet, outputPath: pdfPath, watermark: false })
      const generatedPdfInfo = await readPdfText(pdfPath)
      const score = scoreWorksheet({ worksheet: generated.worksheet, generatedPdfInfo })
      await fs.writeFile(statusPath, JSON.stringify({
        round,
        status: score.verdict,
        finishedAt: new Date().toISOString(),
        score
      }, null, 2), 'utf8')
      rounds.push({ round, jsonPath, pdfPath, debugPath, score })
      if (score.verdict === 'PASS') break
      repairFeedback = repairFeedbackFromScore(score)
    } catch (error) {
      const debugPath = path.join(roundDir, 'error.json')
      await fs.writeFile(debugPath, JSON.stringify({
        message: error.message || String(error),
        debugAttempts: error.debugAttempts || []
      }, null, 2), 'utf8')
      await fs.writeFile(statusPath, JSON.stringify({
        round,
        status: 'BLOCKED',
        finishedAt: new Date().toISOString(),
        message: error.message || String(error),
        debugPath
      }, null, 2), 'utf8')
      rounds.push({
        round,
        verdict: 'BLOCKED',
        blockedReason: error.message || String(error),
        debugPath
      })
      repairFeedback = `上一轮调用失败：${error.message || String(error)}`
    }
  }
  const report = markdownReport(rounds, targetInfo)
  const reportPath = path.join(generatedRoot, 'full-paper-compare-report.md')
  await fs.writeFile(reportPath, report, 'utf8')
  console.log(report)
  const best = rounds.find(round => round.score?.verdict === 'PASS')
  process.exitCode = best ? 0 : 1
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
