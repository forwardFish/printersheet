import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { candidates, getPageTargets, repoRoot, thresholds } from './visual-targets.mjs'

const root = fileURLToPath(repoRoot)
const outputBase = path.join(root, 'docs', 'UI', '小程序', '复刻对比')
const examRound = process.env.EXAM_ROUND || process.env.UI_EXAM_ROUND || 'candidate-exam'
const worksheetRound = process.env.WORKSHEET_ROUND || process.env.UI_WORKSHEET_ROUND || 'candidate-worksheet'
const reportRound = process.env.REPORT_ROUND || process.env.UI_REPORT_ROUND || `candidate-comparison-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}`
const reportRoot = path.join(outputBase, reportRound)

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

function byId(results = []) {
  return new Map(results.map(item => [item.id, item]))
}

function fmtPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(4)}%` : 'n/a'
}

function chooseWinner(exam, worksheet) {
  if (exam && worksheet) {
    if (exam.diffRatio === worksheet.diffRatio) return 'tie'
    return exam.diffRatio < worksheet.diffRatio ? 'exam' : 'worksheet'
  }
  if (exam) return 'exam'
  if (worksheet) return 'worksheet'
  return 'missing'
}

function summarizeCandidate(summary, round) {
  return {
    round,
    candidate: summary?.candidate || null,
    status: summary?.status || 'MISSING',
    verdict: summary?.verdict || 'BLOCKED_BY_ENVIRONMENT',
    capturedPageCount: summary?.capturedPageCount || 0,
    compared: summary?.compared || 0,
    averageRatio: summary?.averageRatio ?? null,
    averagePercent: summary?.averagePercent ?? null,
    errors: summary?.errors || []
  }
}

async function writeReadme(summary) {
  const lines = [
    '# candidate UI comparison',
    '',
    `- generatedAt: ${summary.generatedAt}`,
    `- sourceOfTruth: \`docs/UI/小程序\``,
    `- examRound: \`${summary.exam.round}\``,
    `- worksheetRound: \`${summary.worksheet.round}\``,
    `- verdict: \`${summary.verdict}\``,
    '',
    '## Candidate totals',
    '',
    '| candidate | status | verdict | captured pages | compared | average diff |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    `| exam | ${summary.exam.status} | ${summary.exam.verdict} | ${summary.exam.capturedPageCount} | ${summary.exam.compared} | ${fmtPercent(summary.exam.averageRatio)} |`,
    `| worksheet | ${summary.worksheet.status} | ${summary.worksheet.verdict} | ${summary.worksheet.capturedPageCount} | ${summary.worksheet.compared} | ${fmtPercent(summary.worksheet.averageRatio)} |`,
    '',
    '## Page winners',
    '',
    '| page | reference | exam diff | worksheet diff | winner |',
    '| --- | --- | ---: | ---: | --- |'
  ]

  for (const row of summary.pages) {
    lines.push(`| ${row.id} | ${row.reference} | ${fmtPercent(row.exam?.diffRatio)} | ${fmtPercent(row.worksheet?.diffRatio)} | ${row.winner} |`)
  }

  lines.push('', '## Notes', '')
  lines.push('- The page winner is based on lower pixel diff when both candidates have a captured comparison.')
  lines.push('- Missing captures do not prove a visual loss; they are treated as weaker evidence and kept out of pixel winner selection.')
  lines.push('- Functional completeness is intentionally not scored here; fusion should keep `ai-exam-miniapp` business logic as the integration target.')
  await fs.writeFile(path.join(reportRoot, 'README.md'), `${lines.join('\n')}\n`, 'utf8')
}

async function main() {
  await fs.mkdir(reportRoot, { recursive: true })
  const examSummary = await readJson(path.join(outputBase, examRound, 'pixelmatch-summary.json'), {})
  const worksheetSummary = await readJson(path.join(outputBase, worksheetRound, 'pixelmatch-summary.json'), {})
  const examResults = byId(examSummary.results || [])
  const worksheetResults = byId(worksheetSummary.results || [])
  const targetIds = getPageTargets('exam').map(target => ({
    id: target.id,
    reference: target.reference
  }))

  const pages = targetIds.map(target => {
    const exam = examResults.get(target.id) || null
    const worksheet = worksheetResults.get(target.id) || null
    return {
      id: target.id,
      reference: target.reference,
      exam,
      worksheet,
      winner: chooseWinner(exam, worksheet)
    }
  })

  const worksheetWins = pages.filter(item => item.winner === 'worksheet').length
  const examWins = pages.filter(item => item.winner === 'exam').length
  const missing = pages.filter(item => item.winner === 'missing').length
  const verdict = missing > 0
    ? 'BLOCKED_BY_ENVIRONMENT'
    : worksheetWins > 0
      ? 'FUSION_RECOMMENDED'
      : 'KEEP_EXAM_UI'

  const summary = {
    generatedAt: new Date().toISOString(),
    reportRound,
    sourceOfTruth: 'docs/UI/小程序',
    thresholds,
    candidates,
    exam: summarizeCandidate(examSummary, examRound),
    worksheet: summarizeCandidate(worksheetSummary, worksheetRound),
    pageWinCounts: {
      exam: examWins,
      worksheet: worksheetWins,
      tie: pages.filter(item => item.winner === 'tie').length,
      missing
    },
    verdict,
    pages
  }

  await fs.writeFile(path.join(reportRoot, 'candidate-comparison-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeReadme(summary)
  if (verdict === 'BLOCKED_BY_ENVIRONMENT') process.exitCode = 2
}

main().catch(async error => {
  await fs.mkdir(reportRoot, { recursive: true })
  await fs.writeFile(path.join(reportRoot, 'candidate-comparison-summary.json'), `${JSON.stringify({
    status: 'COMPARE_FAILED',
    verdict: 'BLOCKED_BY_ENVIRONMENT',
    error: error?.stack || String(error),
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8')
  process.exitCode = 2
})
