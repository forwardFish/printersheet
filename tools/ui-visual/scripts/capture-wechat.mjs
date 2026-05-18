import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import automator from 'miniprogram-automator'
import { defaultRound, pageTargets, pendingTargets, repoRoot } from './visual-targets.mjs'

const root = fileURLToPath(repoRoot)
const projectPath = path.join(root, 'project.config.json')
const outputRoot = path.join(root, 'docs', 'UI', '小程序', '复刻对比', process.env.UI_ROUND || defaultRound)
const captureDir = path.join(outputRoot, 'captures')
const reportPath = path.join(outputRoot, 'capture-summary.json')
const port = Number(process.env.WX_AUTOMATOR_PORT || 9420)

const cliCandidates = [
  process.env.WX_DEVTOOLS_CLI,
  'D:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
  path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'cli.bat'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', '微信开发者工具', 'cli.bat')
].filter(Boolean)

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function findCli() {
  for (const candidate of cliCandidates) {
    if (await exists(candidate)) return candidate
  }
  return ''
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))
  ])
}

function runCli(cliPath, args) {
  const escapedArgs = args.map(arg => `'${String(arg).replaceAll("'", "''")}'`).join(' ')
  const command = `& '${cliPath.replaceAll("'", "''")}' ${escapedArgs}`
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    windowsHide: true
  })
}

async function connectAutomation() {
  const deadline = Date.now() + Number(process.env.WX_AUTOMATOR_TIMEOUT || 60000)
  let lastError = null
  while (Date.now() < deadline) {
    try {
      return await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` })
    } catch (error) {
      lastError = error
      await wait(1000)
    }
  }
  throw lastError || new Error(`Failed connecting to ws://127.0.0.1:${port}`)
}

async function captureTarget(miniProgram, target) {
  const page = await withTimeout(miniProgram.reLaunch(target.page), 30000, `${target.id} reLaunch`)
  await wait(350)
  if (target.data && Object.keys(target.data).length) {
    await withTimeout(page.setData(target.data), 10000, `${target.id} setData`)
  }
  await wait(target.settleMs || 800)
  const actualPath = path.join(captureDir, `${target.id}.png`)
  await withTimeout(page.screenshot({ path: actualPath }), 30000, `${target.id} screenshot`)
  return {
    id: target.id,
    page: target.page,
    reference: target.reference,
    actual: path.relative(root, actualPath).replaceAll(path.sep, '/'),
    status: 'CAPTURED'
  }
}

async function main() {
  await fs.mkdir(captureDir, { recursive: true })
  const cliPath = await findCli()
  const summary = {
    status: 'BLOCKED_BY_ENVIRONMENT',
    projectPath,
    cliPath,
    port,
    capturedAt: new Date().toISOString(),
    captures: [],
    pending: pendingTargets,
    errors: []
  }

  if (!cliPath) {
    summary.errors.push('未找到微信开发者工具 cli.bat。请安装微信开发者工具或设置 WX_DEVTOOLS_CLI。')
    await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    process.exitCode = 2
    return
  }

  let miniProgram
  try {
    const quit = runCli(cliPath, ['quit'])
    summary.quitExitCode = quit.status
    summary.quitStdout = quit.stdout || ''
    summary.quitStderr = quit.stderr || ''
    const auto = runCli(cliPath, ['auto', '--project', root, '--auto-port', String(port), '--trust-project'])
    summary.autoExitCode = auto.status
    summary.autoStdout = auto.stdout || ''
    summary.autoStderr = auto.stderr || ''
    miniProgram = await connectAutomation()
    for (const target of pageTargets) {
      try {
        summary.captures.push(await captureTarget(miniProgram, target))
      } catch (error) {
        summary.captures.push({
          id: target.id,
          page: target.page,
          reference: target.reference,
          status: 'CAPTURE_FAILED',
          error: error?.message || String(error)
        })
      }
    }
    summary.status = summary.captures.every(item => item.status === 'CAPTURED')
      ? 'CAPTURED_WITH_PENDING_REFERENCES'
      : 'CAPTURE_PARTIAL'
  } catch (error) {
    summary.errors.push(error?.message || String(error))
  } finally {
    if (miniProgram) await miniProgram.disconnect()
    await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  }

  if (summary.errors.length || summary.captures.length !== pageTargets.length || !summary.captures.every(item => item.status === 'CAPTURED')) {
    process.exitCode = 2
  }
}

main().catch(async error => {
  await fs.mkdir(outputRoot, { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify({
    status: 'BLOCKED_BY_ENVIRONMENT',
    error: error?.stack || String(error),
    capturedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8')
  process.exitCode = 2
})
