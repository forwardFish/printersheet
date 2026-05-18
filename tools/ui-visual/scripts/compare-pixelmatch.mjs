import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import sharp from 'sharp'
import { assetTargets, defaultRound, pageTargets, pendingTargets, repoRoot, thresholds } from './visual-targets.mjs'

const root = fileURLToPath(repoRoot)
const round = process.env.UI_ROUND || defaultRound
const outputRoot = path.join(root, 'docs', 'UI', '小程序', '复刻对比', round)
const captureSummaryPath = path.join(outputRoot, 'capture-summary.json')
const reportPath = path.join(outputRoot, 'pixelmatch-summary.json')

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function decodePng(file) {
  return PNG.sync.read(await fs.readFile(file))
}

async function normalizeToReference(actualPath, width, height) {
  const buffer = await sharp(actualPath)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer()
  return PNG.sync.read(buffer)
}

async function compareOne(target) {
  const referencePath = path.join(root, target.reference)
  const actualPath = path.join(root, target.actual)
  const targetDir = path.join(outputRoot, target.id)
  await fs.mkdir(targetDir, { recursive: true })

  const reference = await decodePng(referencePath)
  const actual = await normalizeToReference(actualPath, reference.width, reference.height)
  const diff = new PNG({ width: reference.width, height: reference.height })
  const diffPixels = pixelmatch(reference.data, actual.data, diff.data, reference.width, reference.height, {
    threshold: Number(process.env.PIXELMATCH_THRESHOLD || 0.12),
    includeAA: true,
    diffColor: [255, 0, 80],
    aaColor: [255, 184, 0]
  })
  const totalPixels = reference.width * reference.height
  const diffRatio = diffPixels / totalPixels

  const referenceCopy = path.join(targetDir, 'reference.png')
  const actualCopy = path.join(targetDir, 'actual.png')
  const diffPath = path.join(targetDir, 'diff.png')
  await fs.copyFile(referencePath, referenceCopy)
  await sharp(actualPath).resize(reference.width, reference.height, { fit: 'fill' }).png().toFile(actualCopy)
  await fs.writeFile(diffPath, PNG.sync.write(diff))

  const metrics = {
    id: target.id,
    reference: target.reference,
    actual: target.actual,
    width: reference.width,
    height: reference.height,
    totalPixels,
    diffPixels,
    diffRatio,
    diffPercent: Number((diffRatio * 100).toFixed(4)),
    threshold: thresholds.perPageRatio,
    passed: diffRatio <= thresholds.perPageRatio,
    artifacts: {
      reference: path.relative(root, referenceCopy).replaceAll(path.sep, '/'),
      actual: path.relative(root, actualCopy).replaceAll(path.sep, '/'),
      diff: path.relative(root, diffPath).replaceAll(path.sep, '/')
    }
  }
  await fs.writeFile(path.join(targetDir, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`, 'utf8')
  return metrics
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true })
  const captureSummary = await readJson(captureSummaryPath, { captures: [] })
  const capturedTargets = (captureSummary.captures || [])
    .filter(item => item.status === 'CAPTURED' && item.actual)
    .map(item => ({ id: item.id, reference: item.reference, actual: item.actual }))

  const allTargets = [...capturedTargets, ...assetTargets]
  const results = []
  const errors = []
  for (const target of allTargets) {
    try {
      results.push(await compareOne(target))
    } catch (error) {
      errors.push({
        id: target.id,
        reference: target.reference,
        actual: target.actual,
        error: error?.message || String(error)
      })
    }
  }

  const compared = results.length
  const averageRatio = compared
    ? results.reduce((sum, item) => sum + item.diffRatio, 0) / compared
    : 1
  const capturedPageCount = capturedTargets.length
  const pageCaptureComplete = capturedPageCount === pageTargets.length
  const summary = {
    status: errors.length ? 'COMPARE_PARTIAL' : 'COMPARE_COMPLETE',
    verdict: pageCaptureComplete && compared > 0 && errors.length === 0 && averageRatio <= thresholds.averageRatio && results.every(item => item.passed)
      ? 'PASS'
      : (pageCaptureComplete ? 'REPAIR_REQUIRED' : 'BLOCKED_BY_ENVIRONMENT'),
    generatedAt: new Date().toISOString(),
    round,
    thresholds,
    expectedPageCaptures: pageTargets.length,
    capturedPageCount,
    compared,
    averageRatio,
    averagePercent: Number((averageRatio * 100).toFixed(4)),
    results,
    errors,
    pending: pendingTargets
  }
  await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  if (summary.verdict !== 'PASS') process.exitCode = 1
}

main().catch(async error => {
  await fs.mkdir(outputRoot, { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify({
    status: 'COMPARE_FAILED',
    verdict: 'REPAIR_REQUIRED',
    error: error?.stack || String(error),
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8')
  process.exitCode = 1
})
