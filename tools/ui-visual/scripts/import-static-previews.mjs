import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultRound, getCandidate, getCandidateId, getPageTargets, pendingTargets, repoRoot } from './visual-targets.mjs'

const root = fileURLToPath(repoRoot)
const candidateId = getCandidateId()
const candidate = getCandidate(candidateId)
const round = process.env.UI_ROUND || defaultRound
const outputRoot = path.join(root, 'docs', 'UI', '小程序', '复刻对比', round)
const captureDir = path.join(outputRoot, 'captures')
const reportPath = path.join(outputRoot, 'capture-summary.json')

const worksheetStaticMap = {
  login: 'ai-worksheet-miniprogram/preview_1.png',
  'home-normal': 'ai-worksheet-miniprogram/preview_2.png',
  'home-grade-selector': 'ai-worksheet-miniprogram/preview_3.png',
  'home-recent': 'ai-worksheet-miniprogram/preview_4.png',
  preview: 'ai-worksheet-miniprogram/preview_6.png',
  packages: 'ai-worksheet-miniprogram/preview_7.png',
  order: 'ai-worksheet-miniprogram/preview_8.png',
  my: 'ai-worksheet-miniprogram/preview_9.png'
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function main() {
  await fs.mkdir(captureDir, { recursive: true })
  const summary = {
    status: 'STATIC_PREVIEW_IMPORTED',
    evidenceKind: 'static-preview',
    note: 'These images come from ai-worksheet-miniprogram preview PNGs, not from a live WeChat miniprogram runtime.',
    candidate: {
      id: candidate.id,
      label: candidate.label,
      projectRoot: candidate.projectRoot
    },
    generatedAt: new Date().toISOString(),
    captures: [],
    pending: [...pendingTargets],
    errors: []
  }

  if (candidateId !== 'worksheet') {
    summary.status = 'UNSUPPORTED_CANDIDATE'
    summary.errors.push('Static preview import is only defined for UI_CANDIDATE=worksheet.')
    await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    process.exitCode = 2
    return
  }

  const targets = getPageTargets(candidateId)
  for (const target of targets) {
    const source = worksheetStaticMap[target.id]
    if (!source) {
      summary.pending.push({
        id: target.id,
        page: target.page,
        reference: target.reference,
        reason: 'No static preview PNG was generated for this page state.'
      })
      continue
    }

    const sourcePath = path.join(root, source)
    if (!(await exists(sourcePath))) {
      summary.captures.push({
        id: target.id,
        page: target.page,
        reference: target.reference,
        status: 'CAPTURE_FAILED',
        error: `Missing static preview: ${source}`
      })
      continue
    }

    const actualPath = path.join(captureDir, `${target.id}.png`)
    await fs.copyFile(sourcePath, actualPath)
    summary.captures.push({
      id: target.id,
      page: target.page,
      reference: target.reference,
      actual: path.relative(root, actualPath).replaceAll(path.sep, '/'),
      source,
      status: 'CAPTURED',
      evidenceKind: 'static-preview'
    })
  }

  if (summary.captures.some(item => item.status !== 'CAPTURED')) {
    summary.status = 'STATIC_PREVIEW_PARTIAL'
    process.exitCode = 2
  }
  await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
}

main().catch(async error => {
  await fs.mkdir(outputRoot, { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify({
    status: 'STATIC_PREVIEW_FAILED',
    evidenceKind: 'static-preview',
    error: error?.stack || String(error),
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8')
  process.exitCode = 2
})
