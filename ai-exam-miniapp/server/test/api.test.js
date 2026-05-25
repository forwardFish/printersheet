import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { PDFParse } from 'pdf-parse'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import mammoth from 'mammoth'
import JSZip from 'jszip'

const require = createRequire(import.meta.url)
const { buildDiagramView } = require('../../miniprogram/utils/math-format.js')
const { sampleWorksheet } = require('../../miniprogram/utils/worksheet.js')
const nativeFetch = globalThis.fetch

process.env.NODE_ENV = 'test'
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:8787'
process.env.AI_MOCK_MODE = 'false'
process.env.AI_API_KEY = 'unit-test-key'
process.env.AI_BASE_URL = 'https://ai.example.test/v1'

const { createApp } = await import('../src/index.js')
const { LocalDbAdapter } = await import('../src/adapters/localDb.js')
const { AuthService } = await import('../src/services/authService.js')
const { normalizeWorksheet, pointsFor, validateWorksheet } = await import('../src/lib/worksheet.js')
const { createMockWorksheet } = await import('../src/lib/mockWorksheet.js')
const { assertAiWorksheetPayloadSchema, assertUploadedSourceUsage, assertWorksheetQuality, generateFullPaperWithAI, generateWorksheetWithAI } = await import('../src/lib/ai.js')
const { resolveAiProvider } = await import('../src/lib/aiProviders.js')
const { isFullPaperSimulation } = await import('../src/lib/examBlueprint.js')
const { buildPdf, inferQuestionDiagramSpec } = await import('../src/lib/buildPdf.js')
const { buildDocx } = await import('../src/lib/buildDocx.js')
const { toDisplayChemistry, toDisplayMath } = await import('../src/lib/mathFormat.js')
const { estimateGenerationCharge } = await import('../src/lib/meteredGeneration.js')

async function cleanGeneratedFiles() {
  for (const dir of [path.resolve('files'), path.resolve('uploads')]) {
    await fsp.mkdir(dir, { recursive: true })
    const entries = await fsp.readdir(dir)
    await Promise.all(entries.map(entry => fsp.rm(path.join(dir, entry), { recursive: true, force: true })))
  }
}

function valueFromPrompt(content, label, fallback) {
  const match = String(content || '').match(new RegExp(`- ${label}: ([^\\n]+)`))
  const value = String(match?.[1] || '').trim()
  return value && value !== 'unspecified' ? value : fallback
}

function sourceAnchorFromPrompt(content) {
  const text = String(content || '')
  const source = String(
    text.match(/primary basis:\s*([\s\S]*?)(?:\n\nFull-paper simulation blueprint|\n\nPrevious response was invalid|$)/)?.[1] ||
    text.match(/Uploaded source text:\s*([\s\S]*?)(?:\n\nFull-paper simulation blueprint|\n\nPrevious response was invalid|$)/)?.[1] ||
    ''
  ).trim()
  if (!source || source === 'none') return ''
  return source.replace(/\s+/g, ' ').slice(0, 40)
}

function createUnitAiWorksheet(content = '') {
  const count = Math.max(1, Number(String(content).match(/Exact question count: (\d+)/)?.[1] || 5))
  const grade = valueFromPrompt(content, 'Grade', 'Grade 7')
  const subject = valueFromPrompt(content, 'Subject', 'Math')
  const difficulty = valueFromPrompt(content, 'Difficulty', 'medium')
  const anchor = sourceAnchorFromPrompt(content)
  const request = String(content).match(/User request: ([^\n]+)/)?.[1] || ''
  const requestHint = request.slice(0, 80)
  return {
    title: `${grade} ${subject} practice`,
    grade,
    subject,
    mode: 'practice',
    sourceAnchors: anchor ? [anchor] : [],
    questions: Array.from({ length: count }, (_, index) => {
      const number = index + 1
      const a = number + 4
      const b = number + 7
      const answer = number + 2
      const c = a * answer + b
      return {
        number,
        section: 'Practice',
        type: 'short answer',
        difficulty,
        skill: `${subject} ${requestHint} linear equation`,
        question: `${anchor ? `${anchor}: ` : ''}${requestHint} ${subject} item ${number}: solve ${a}x + ${b} = ${c}.`,
        options: [],
        answer: `x=${answer}`,
        explanation: `Subtract ${b}, then divide by ${a}.`
      }
    })
  }
}

function installUnitAiFetch() {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://ai.example.test/v1/chat/completions')) {
      const body = JSON.parse(init.body)
      const userContent = body.messages?.find(message => message.role === 'user')?.content || ''
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(createUnitAiWorksheet(userContent)) } }]
      }), { status: 200 })
    }
    return nativeFetch(url, init)
  }
}

test.beforeEach(async () => {
  process.env.AI_MOCK_MODE = 'false'
  process.env.DB_PROVIDER = 'local'
  process.env.FILE_PROVIDER = 'local'
  process.env.PAYMENT_PROVIDER = 'mock'
  process.env.AI_API_KEY = 'unit-test-key'
  process.env.AI_BASE_URL = 'https://ai.example.test/v1'
  process.env.LOCAL_DB_PATH = path.join(os.tmpdir(), `printersheet-dev-db-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  delete process.env.AI_PROVIDER
  delete process.env.AI_MODEL
  delete process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_BASE_URL
  delete process.env.DEEPSEEK_MODEL
  delete process.env.AI_FALLBACK_TO_MOCK
  delete process.env.AI_REQUEST_TIMEOUT_MS
  delete process.env.GENERATION_JOB_TIMEOUT_MS
  delete process.env.GENERATION_JOB_CONCURRENCY
  installUnitAiFetch()
  await cleanGeneratedFiles()
})
test.afterEach(async () => {
  globalThis.fetch = nativeFetch
  await cleanGeneratedFiles()
})

function listen(app) {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server))
  })
}

function baseUrl(server) {
  const { port } = server.address()
  return `http://127.0.0.1:${port}`
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
  return res
}

async function login(base, mockOpenid = `openid-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  const res = await postJson(`${base}/api/auth/wechat-login`, {
    mockOpenid,
    userInfo: { nickName: 'Unit User', avatarUrl: 'https://example.test/avatar.png' }
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.ok(data.token)
  return { ...data, auth: { authorization: `Bearer ${data.token}` }, mockOpenid }
}

async function makeSamplePdf(tmpDir) {
  const file = path.join(tmpDir, 'sample.pdf')
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument()
    const stream = fs.createWriteStream(file)
    stream.on('finish', resolve)
    stream.on('error', reject)
    doc.pipe(stream)
    doc.text('Linear equations worksheet. Solve x plus 3 equals 8. Create similar questions.')
    doc.end()
  })
  return file
}

async function makeSampleDocx(tmpDir) {
  const file = path.join(tmpDir, 'sample.docx')
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun('一元一次方程讲义：移项、合并同类项、求解未知数。')] })
      ]
    }]
  })
  await fsp.writeFile(file, await Packer.toBuffer(doc))
  return file
}

async function makeSampleImage(tmpDir) {
  const file = path.join(tmpDir, 'sample.png')
  await fsp.writeFile(file, Buffer.from('not-a-real-image-but-valid-upload-placeholder'))
  return file
}

async function uploadGenerate(url, filePath, fields, headers = {}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value))
  form.append('file', new Blob([await fsp.readFile(filePath)]), fields.uploadFileName || path.basename(filePath))
  return fetch(url, { method: 'POST', body: form, headers })
}

async function waitForGenerationJob(base, jobId) {
  for (let i = 0; i < 20; i += 1) {
    const res = await fetch(`${base}/api/worksheet/jobs/${jobId}`)
    const data = await res.json()
    if (data.status === 'succeeded' || data.status === 'failed') return data
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`generation job ${jobId} did not finish`)
}

async function readGeneratedPdfText(fileNameOrUrl) {
  const fileName = path.basename(String(fileNameOrUrl))
  const pdfPath = path.resolve('files', fileName)
  return fsp.readFile(pdfPath, 'latin1')
}

function assertFreeWatermarkMarker(pdfText, expected) {
  assert.equal(
    pdfText.includes('printer-sheet-free-watermark'),
    expected,
    expected ? 'free PDF must contain watermark marker' : 'member PDF must not contain free watermark marker'
  )
}

function countPdfPages(pdfText) {
  return (String(pdfText).match(/\/Type\s*\/Page\b/g) || []).length
}

async function getGeneratedPdfPageCount(fileNameOrUrl) {
  const fileName = path.basename(String(fileNameOrUrl))
  const pdfPath = path.resolve('files', fileName)
  const data = await fsp.readFile(pdfPath)
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    return result.total
  } finally {
    await parser.destroy?.()
  }
}

async function getGeneratedPdfExtractedText(fileNameOrUrl) {
  const fileName = path.basename(String(fileNameOrUrl))
  const pdfPath = path.resolve('files', fileName)
  const data = await fsp.readFile(pdfPath)
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    return String(result.text || '')
  } finally {
    await parser.destroy?.()
  }
}

test('health endpoint is available', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const res = await fetch(`${baseUrl(server)}/health`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

test('text generation returns worksheet, cost, source, and file urls', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const res = await postJson(`${baseUrl(server)}/api/generate`, {
    prompt: '生成 5 道初一数学一元一次方程中等题，带答案解析，适合打印。',
    grade: '初一',
    subject: '数学',
    difficulty: '中等',
    mode: 'practice',
    questionCount: 5
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.ok(['mock', 'ai'].includes(data.source))
  assert.equal(data.cost.pointsUsed, 1)
  assert.ok(data.pdfUrl.endsWith('.pdf'))
  assert.ok(data.wordUrl.endsWith('.docx'))
  assertFreeWatermarkMarker(await readGeneratedPdfText(`${data.worksheetId}.pdf`), true)
  assert.equal(data.worksheet.mode, 'practice')
  assert.equal(data.worksheet.questions.length, 5)
  assert.equal(data.worksheet.answerKey.length, 5)
  assert.equal(validateWorksheet(data.worksheet).valid, true)
  assert.ok(data.worksheet.questions.every(q => q.question && q.answer && q.explanation))
})

test('async generation returns a job immediately and completes in background', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const res = await postJson(`${baseUrl(server)}/api/worksheet/generate?async=1`, {
    prompt: '生成 5 道初一数学方程题',
    grade: '初一',
    subject: '数学',
    mode: 'practice',
    questionCount: 5
  })
  assert.equal(res.status, 202)
  const created = await res.json()
  assert.equal(created.success, true)
  assert.equal(created.async, true)
  assert.ok(created.jobId)
  assert.ok(['queued', 'running'].includes(created.status))

  const done = await waitForGenerationJob(baseUrl(server), created.jobId)
  assert.equal(done.success, true)
  assert.equal(done.status, 'succeeded')
  assert.equal(done.progress, 100)
  assert.ok(done.result.worksheet)
  assert.ok(done.result.pdfUrl)
  assert.equal(done.result.worksheet.questions.length, 5)
})

test('worksheet schema normalizes legacy mode without mock generator', () => {
  const worksheet = normalizeWorksheet({
    title: '结构化练习卷',
    mode: 'paper',
    questions: Array.from({ length: 10 }, (_, index) => ({
      number: index + 1,
      section: '一、练习题',
      type: '解答题',
      question: `第 ${index + 1} 题：计算 ${index + 11}+${index + 21}。`,
      answer: String(index * 2 + 32),
      explanation: '按整数加法计算。'
    })),
    cost: { pointsUsed: 10, ocrPages: 0, wordExportRequired: false },
    paperBlueprint: { totalQuestions: 10, sections: [] }
  })
  assert.equal(worksheet.mode, 'practice')
  assert.equal(worksheet.questions.length, 10)
  assert.equal(worksheet.answerKey.length, 10)
  assert.equal(worksheet.paperBlueprint.totalQuestions, 10)
  assert.equal(worksheet.cost.pointsUsed, 10)
  assert.equal(validateWorksheet(worksheet).valid, true)
})

test('worksheet schema preserves structured math, diagrams, and proof steps', () => {
  const worksheet = normalizeWorksheet({
    title: '结构化数学题',
    questions: [{
      number: 1,
      section: '一、解答题',
      type: '解答题',
      question: '如图，在数轴上点 A 表示 -2，点 B 表示 4，求 AB。',
      questionLatex: 'AB=4-(-2)',
      answer: '6',
      answerLatex: 'AB=6',
      explanation: '这段原始解析作为兜底。',
      explanationSteps: ['点 A 与点 B 的距离等于坐标差的绝对值。', '$AB=|4-(-2)|=6$。'],
      proofSteps: ['备用证明步骤'],
      diagramSpec: { type: 'number_line', axis: { min: -3, max: 5 }, points: { A: -2, B: 4 }, labels: ['A', 'B'] },
      tableSpec: { headers: ['点', '坐标'], rows: [['A', '-2'], ['B', '4']] }
    }]
  })
  const q = worksheet.questions[0]
  assert.equal(q.questionLatex, 'AB=4-(-2)')
  assert.deepEqual(q.explanationSteps, ['点 A 与点 B 的距离等于坐标差的绝对值。', '$AB=|4-(-2)|=6$。'])
  assert.equal(q.diagramSpec.type, 'number_line')
  assert.equal(q.tableSpec.headers[0], '点')
})

test('lightweight math formatting displays powers as superscripts', () => {
  assert.equal(toDisplayMath('(-2)^3 + 3 * (-1)^4 - sqrt(16) ='), '( - 2)³ + 3 × ( - 1)⁴ - √16 =')
  assert.equal(toDisplayMath('-3x^a y^2'), '- 3xᵃ y²')
  assert.equal(toDisplayMath('2x^3 y^{b+1}'), '2x³ yᵇ⁺¹')
  assert.equal(toDisplayMath('p^m=4'), 'pᵐ = 4')
  assert.equal(toDisplayMath('2a^2b'), '2a²b')
  assert.equal(toDisplayMath('AB = 12\\text{ cm}'), 'AB = 12 cm')
})

test('chemistry formatting displays formulas and valence notation', () => {
  assert.equal(toDisplayChemistry('\\text{ cm}'), 'cm')
  assert.equal(toDisplayChemistry('H2'), 'H\u2082')
  assert.equal(toDisplayChemistry('FeCl2'), 'FeCl\u2082')
  assert.equal(toDisplayChemistry('Mg^+2'), 'Mg\u00B2\u207A')
  assert.equal(toDisplayChemistry('CaCO3 + 2HCl = CaCl2 + H2O + CO2 \\uparrow'), 'CaCO\u2083 + 2HCl = CaCl\u2082 + H\u2082O + CO\u2082 \u2191')
  assert.equal(
    toDisplayChemistry('\\mathrm{2H2O \\xlongequal{通电} 2H2 \\uparrow + O2 \\uparrow}'),
    '2H\u2082O 通电\u2192 2H\u2082 \u2191 + O\u2082 \u2191'
  )
})

test('PDF export infers missing diagram for segment ratio questions', () => {
  const spec = inferQuestionDiagramSpec({
    number: 5,
    question: '如图，已知线段AB=12cm，点C是AB的中点，点D在CB上，且CD:DB=1:2。求线段AD的长度。',
    questionLatex: 'AB = 12\\text{ cm}, CD:DB = 1:2'
  })

  assert.equal(spec.type, 'generic_geometry')
  assert.deepEqual(spec.labels, ['A', 'C', 'D', 'B'])
  assert.deepEqual(spec.segments, [['A', 'B']])
  assert.deepEqual(spec.points.C, [120, 42])
  assert.deepEqual(spec.points.D, [160, 42])
})

test('PDF and DOCX exports preserve existing preview diagram specs', async () => {
  const worksheet = normalizeWorksheet({
    title: '\u521d\u4e09\u51e0\u4f55\u7ec3\u4e60\u5377',
    grade: '\u521d\u4e09',
    subject: '\u6570\u5b66',
    mode: 'practice',
    questions: [{
      number: 1,
      section: '\u9009\u62e9\u9898',
      type: '\u9009\u62e9\u9898',
      question: '\u5982\u56fe\uff0c\u5728\u2299O\u4e2d\uff0cAB\u662f\u76f4\u5f84\uff0cC\u3001D\u662f\u5706\u4e0a\u4e24\u70b9\uff0c\u8fde\u63a5AC\u3001AD\u3001BC\u3001BD\u3002',
      options: ['A. 35\u00b0', 'B. 45\u00b0', 'C. 55\u00b0', 'D. 65\u00b0'],
      answer: 'B',
      explanation: '\u540c\u5f27\u6240\u5bf9\u7684\u5706\u5468\u89d2\u76f8\u7b49\u3002',
      diagramSpec: {
        type: 'generic_geometry',
        points: { A: [0, 60], O: [120, 60], B: [240, 60], D: [35, 0], C: [180, 145] },
        segments: [['A', 'B'], ['A', 'D'], ['D', 'B'], ['A', 'C'], ['C', 'B']],
        labels: ['A', 'O', 'B', 'C', 'D']
      }
    }]
  })
  const q = worksheet.questions[0]

  assert.equal(inferQuestionDiagramSpec(q).type, 'generic_geometry')

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-diagram-export-'))
  const pdfPath = path.join(dir, 'diagram.pdf')
  const docxPath = path.join(dir, 'diagram.docx')
  await buildPdf({ worksheet, outputPath: pdfPath, watermark: false })
  await buildDocx({ worksheet, outputPath: docxPath })

  assert.ok((await fsp.stat(pdfPath)).size > 0)
  const zip = await JSZip.loadAsync(await fsp.readFile(docxPath))
  assert.ok(zip.file(/word\/media\/.*\.svg$/).length >= 1)
  assert.match(await zip.file('word/document.xml').async('string'), /<w:drawing>/)
})

test('mini-program geometry preview uses physical rpx geometry instead of distorted percentages', () => {
  const view = buildDiagramView({
    type: 'generic_geometry',
    points: { A: [0, 0], B: [4, 0], C: [2, 3] },
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A']],
    labels: [{ point: 'A', text: 'A' }, { point: 'B', text: 'B' }, { point: 'C', text: 'C' }]
  })

  assert.equal(view.type, 'geometry')
  assert.equal(view.segments.length, 3)
  assert.match(view.segments[0].style, /left:\d+(?:\.\d+)?rpx;top:\d+(?:\.\d+)?rpx;width:\d+(?:\.\d+)?rpx;transform:rotate\(0deg\);/)
  assert.ok(view.segments.every(segment => !segment.style.includes('%')))
  assert.ok(view.labels.every(label => !label.style.includes('%')))
})

test('mini-program preview accepts semantic geometry diagram specs', () => {
  const view = buildDiagramView({
    diagramType: 'ISOSCELES_TRIANGLE',
    params: {
      topPoint: 'A',
      leftPoint: 'B',
      rightPoint: 'C',
      equalSides: [['A', 'B'], ['A', 'C']],
      knownAngles: [{ point: 'B', value: '40\\circ' }]
    }
  })

  assert.equal(view.type, 'geometry')
  assert.equal(view.segments.length, 3)
  assert.ok(view.angleLabels.some(item => item.text && !item.text.includes('\\circ')))
  assert.ok(view.labels.every(label => label.style.includes('rpx')))
})

test('PDF and DOCX exports render a five-question semantic geometry sheet', async () => {
  const worksheet = normalizeWorksheet({
    title: 'semantic geometry sheet',
    grade: 'Grade 7',
    subject: 'Math',
    mode: 'practice',
    questions: [
      ['TRIANGLE_ANGLE_SUM', { angles: { A: '50°', B: '60°', C: '?' } }],
      ['ISOSCELES_TRIANGLE', { topPoint: 'A', leftPoint: 'B', rightPoint: 'C', knownAngles: [{ point: 'B', value: '40°' }] }],
      ['RIGHT_TRIANGLE', { vertices: ['A', 'B', 'C'], rightAngleAt: 'C' }],
      ['CONGRUENT_TRIANGLES', { leftTriangle: ['A', 'B', 'C'], rightTriangle: ['D', 'E', 'F'] }],
      ['PARALLEL_LINES_ANGLE', { angles: [{ point: 'E', value: '∠1' }, { point: 'F', value: '∠2' }] }]
    ].map(([diagramType, params], index) => ({
      number: index + 1,
      section: 'geometry',
      type: 'short',
      question: `Use the diagram for question ${index + 1}.`,
      answer: 'ok',
      explanation: 'The template renderer owns the diagram coordinates.',
      needsDiagram: true,
      diagramSpecRequired: true,
      diagramSpec: { diagramType, params }
    }))
  })

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-semantic-geometry-'))
  const pdfPath = path.join(dir, 'semantic.pdf')
  const docxPath = path.join(dir, 'semantic.docx')
  await buildPdf({ worksheet, outputPath: pdfPath, watermark: false })
  await buildDocx({ worksheet, outputPath: docxPath })

  assert.ok((await fsp.stat(pdfPath)).size > 0)
  const zip = await JSZip.loadAsync(await fsp.readFile(docxPath))
  assert.ok(zip.file(/word\/media\/.*\.svg$/).length >= 4)
  assert.equal(((await zip.file('word/document.xml').async('string')).match(/<w:drawing>/g) || []).length, 5)
})

test('PDF diagram inference does not use geometry fallback for algebra questions by number', () => {
  const spec = inferQuestionDiagramSpec({
    number: 5,
    question: 'Solve 3x + 4 = 19.',
    skill: 'linear equation'
  })
  assert.equal(spec, null)
})

test('AI config uses explicit prompt, schema validation, and model env vars', async () => {
  const originalFetch = globalThis.fetch
  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_API_KEY = 'unit-test-key'
  process.env.AI_BASE_URL = 'https://ai.example.test/v1'
  process.env.AI_MODEL = 'unit-test-model'

  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://ai.example.test/v1/chat/completions')
      assert.equal(init.headers.Authorization, 'Bearer unit-test-key')
      const body = JSON.parse(init.body)
      assert.equal(body.model, 'unit-test-model')
      assert.match(body.messages[0].content, /questions 数组长度必须严格等于 2/)
      assert.match(body.messages[0].content, /questionLatex/)
      assert.match(body.messages[0].content, /explanationSteps/)
      assert.match(body.messages[0].content, /diagramSpec/)
      assert.match(body.messages[0].content, /"paperBlueprint"/)
      assert.match(body.messages[1].content, /用户要求：generate algebra worksheet/)
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Algebra worksheet',
              grade: 'Grade 7',
              subject: 'Math',
              mode: 'practice',
              sourceAnchors: ['linear equations notes'],
              questions: [
                { number: 1, section: 'A', type: 'short', difficulty: 'medium', skill: 'linear equation', question: 'Solve 5x - 6 = 14.', options: [], answer: 'x=4', explanation: 'Add 6, then divide by 5.' },
                { number: 2, section: 'A', type: 'short', difficulty: 'medium', skill: 'linear equation', question: 'Solve 3x + 4 = 19.', options: [], answer: 'x=5', explanation: 'Subtract 4, then divide by 3.' }
              ]
            })
          }
        }]
      }), { status: 200 })
    }

    const result = await generateWorksheetWithAI({
      prompt: 'generate algebra worksheet',
      fileText: 'linear equations notes',
      grade: 'Grade 7',
      subject: 'Math',
      difficulty: 'medium',
      mode: 'practice',
      questionCount: 2
    })
    assert.equal(result.source, 'ai')
    assert.equal(result.worksheet.questions.length, 2)
    assert.equal(validateWorksheet(result.worksheet).valid, true)
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.AI_FALLBACK_TO_MOCK
  }
})

test('AI provider config can switch models without code changes', () => {
  const deepseek = resolveAiProvider({
    AI_PROVIDER: 'deepseek',
    AI_API_KEY: 'unit-test-key',
    AI_BASE_URL: 'https://api.deepseek.com',
    AI_MODEL: 'deepseek-v4-pro'
  })
  assert.equal(deepseek.providerId, 'deepseek')
  assert.equal(deepseek.model, 'deepseek-v4-pro')
  assert.equal(deepseek.baseUrl, 'https://api.deepseek.com')
  assert.equal(deepseek.apiKey, 'unit-test-key')

  const compatible = resolveAiProvider({
    AI_PROVIDER: 'openaiCompatible',
    AI_API_KEY: 'unit-test-key-2',
    AI_BASE_URL: 'https://llm.example.test/v1',
    AI_MODEL: 'candidate-model'
  })
  assert.equal(compatible.providerId, 'openaiCompatible')
  assert.equal(compatible.model, 'candidate-model')
  assert.equal(compatible.baseUrl, 'https://llm.example.test/v1')
})

test('AI retry includes schema failure reason before succeeding', async () => {
  const originalFetch = globalThis.fetch
  process.env.AI_MOCK_MODE = 'false'
  process.env.DEEPSEEK_API_KEY = 'unit-test-key'
  process.env.DEEPSEEK_BASE_URL = 'https://deepseek.example.test'
  process.env.DEEPSEEK_MODEL = 'deepseek-chat'
  let calls = 0

  try {
    globalThis.fetch = async (_, init) => {
      calls += 1
      const body = JSON.parse(init.body)
      if (calls === 1) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ title: 'Bad', questions: [] }) } }]
        }), { status: 200 })
      }
      assert.match(body.messages[1].content, /Previous response was invalid/)
      assert.match(body.messages[1].content, /questions 数量必须等于 2/)
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Fixed worksheet',
              grade: '初一',
              subject: '数学',
              mode: 'practice',
              sourceAnchors: [],
              questions: [
                { number: 1, section: '一、填空题', type: '填空题', difficulty: '中等', skill: '一元一次方程', question: '5x-6=14，x=____。', options: [], answer: '4', explanation: '两边同时加 6，再除以 5。' },
                { number: 2, section: '一、填空题', type: '填空题', difficulty: '中等', skill: '一元一次方程', question: '3x+4=19，x=____。', options: [], answer: '5', explanation: '两边同时减 4，再除以 3。' }
              ]
            })
          }
        }]
      }), { status: 200 })
    }
    const result = await generateWorksheetWithAI({ prompt: '生成 2 道一元一次方程题', questionCount: 2 })
    assert.equal(result.source, 'ai')
    assert.equal(result.worksheet.questions.length, 2)
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('AI quality gate rejects demo questions and retries with the reason', async () => {
  const originalFetch = globalThis.fetch
  process.env.AI_MOCK_MODE = 'false'
  process.env.DEEPSEEK_API_KEY = 'unit-test-key'
  process.env.DEEPSEEK_BASE_URL = 'https://deepseek.example.test'
  process.env.DEEPSEEK_MODEL = 'deepseek-chat'
  let calls = 0

  try {
    globalThis.fetch = async (_, init) => {
      calls += 1
      const body = JSON.parse(init.body)
      if (calls === 1) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
              title: 'Bad demo worksheet',
              grade: '初一',
              subject: '数学',
              mode: 'practice',
              sourceAnchors: [],
              questions: [
                  { number: 1, section: '一、填空题', type: '填空题', difficulty: '中等', skill: '一元一次方程', question: '解方程：x + 3 = 8', options: [], answer: '5', explanation: '移项得 x=5。' }
                ]
              })
            }
          }]
        }), { status: 200 })
      }
      assert.match(body.messages[1].content, /demo\/示例题/)
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Fresh worksheet',
              grade: '初一',
              subject: '数学',
              mode: 'practice',
              sourceAnchors: [],
              questions: [
                { number: 1, section: '一、填空题', type: '填空题', difficulty: '中等', skill: '一元一次方程', question: '解方程：4x - 7 = 9。', options: [], answer: '4', explanation: '4x=16，所以 x=4。' }
              ]
            })
          }
        }]
      }), { status: 200 })
    }
    const result = await generateWorksheetWithAI({ prompt: '生成 1 道新题', questionCount: 1 })
    assert.equal(result.source, 'ai')
    assert.equal(result.worksheet.questions[0].question, '解方程：4x - 7 = 9。')
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('AI upload generation must cite and use parsed uploaded material', async () => {
  const originalFetch = globalThis.fetch
  process.env.AI_MOCK_MODE = 'false'
  process.env.DEEPSEEK_API_KEY = 'unit-test-key'
  process.env.DEEPSEEK_BASE_URL = 'https://deepseek.example.test'
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro'
  let calls = 0

  try {
    globalThis.fetch = async (_, init) => {
      calls += 1
      const body = JSON.parse(init.body)
      assert.equal(body.model, 'deepseek-chat')
      assert.match(body.messages[0].content, /sourceAnchors/)
      assert.match(body.messages[1].content, /上传资料原文/)
      if (calls === 1) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'No source anchors',
                grade: '初一',
                subject: '数学',
                mode: 'practice',
                questions: [
                  { number: 1, section: '一、填空题', type: '填空题', difficulty: '中等', skill: '合并同类项', question: '7x+2x=45，x=____。', options: [], answer: '5', explanation: '9x=45，所以 x=5。' }
                ]
              })
            }
          }]
        }), { status: 200 })
      }
      assert.match(body.messages[1].content, /sourceAnchors/)
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              title: '合并同类项专项练习',
              grade: '初一',
              subject: '数学',
              mode: 'practice',
              sourceAnchors: ['合并同类项', '移项', '系数化为1'],
              questions: [
                { number: 1, section: '一、填空题', type: '填空题', difficulty: '中等', skill: '合并同类项', question: '将 6x 和 3x 合并后解方程：6x+3x=54，x=____。', options: [], answer: '6', explanation: '先合并同类项得 9x=54，再系数化为1，x=6。' }
              ]
            })
          }
        }]
      }), { status: 200 })
    }
    const result = await generateWorksheetWithAI({
      prompt: '根据上传资料生成 1 道题',
      fileText: '本讲义重点：合并同类项、移项、系数化为1。例题强调先整理方程再求解。',
      grade: '初一',
      subject: '数学',
      difficulty: '中等',
      mode: 'practice',
      questionCount: 1
    })
    assert.equal(result.source, 'ai')
    assert.deepEqual(result.worksheet.sourceAnchors, ['合并同类项', '移项', '系数化为1'])
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('long uploaded material is generated in chunks instead of one full prompt', async () => {
  const originalFetch = globalThis.fetch
  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_API_KEY = 'unit-test-key'
  process.env.AI_BASE_URL = 'https://ai.example.test/v1'
  process.env.AI_MODEL = 'unit-test-model'

  const alphaText = 'alpha_anchor linear transformation practice '.repeat(70)
  const betaText = 'beta_anchor proportional reasoning practice '.repeat(70)
  const fileText = `${alphaText}\n\n${betaText}`
  const userPrompt = 'generate Grade 7 Math worksheet from uploaded material'
  const requestLengths = []
  let calls = 0

  try {
    globalThis.fetch = async (_, init) => {
      calls += 1
      const body = JSON.parse(init.body)
      const userContent = body.messages[1].content
      requestLengths.push(userContent.length)
      assert.match(userContent, /chunk \d+\/\d+/)
      assert.ok(userContent.length < fileText.length, 'model call should not contain the whole uploaded text')
      const isBeta = calls > 1
      const anchor = isBeta ? 'beta_anchor' : 'alpha_anchor'
      const skill = isBeta ? 'proportional reasoning' : 'linear transformation'
      const offset = isBeta ? 3 : 1
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          title: 'Grade 7 Math chunk worksheet',
          grade: 'Grade 7',
          subject: 'Math',
          mode: 'practice',
          sourceAnchors: [anchor],
          questions: [
            {
              number: offset,
              section: 'Practice',
              type: 'short answer',
              difficulty: 'medium',
              skill,
              question: `${anchor} question ${offset} for Grade 7 Math`,
              options: [],
              answer: `answer ${offset}`,
              explanation: `${skill} explanation`
            },
            {
              number: offset + 1,
              section: 'Practice',
              type: 'short answer',
              difficulty: 'medium',
              skill,
              question: `${anchor} question ${offset + 1} for Grade 7 Math`,
              options: [],
              answer: `answer ${offset + 1}`,
              explanation: `${skill} explanation`
            }
          ]
        }) } }]
      }), { status: 200 })
    }

    const result = await generateWorksheetWithAI({
      prompt: userPrompt,
      fileText,
      grade: 'Grade 7',
      subject: 'Math',
      difficulty: 'medium',
      mode: 'practice',
      questionCount: 4
    })

    assert.equal(result.source, 'ai')
    assert.equal(result.sourceChunks, 2)
    assert.equal(calls, 2)
    assert.equal(result.worksheet.questions.length, 4)
    assert.deepEqual(result.worksheet.questions.map(item => item.number), [1, 2, 3, 4])
    assert.ok(result.worksheet.sourceAnchors.includes('alpha_anchor'))
    assert.ok(result.worksheet.sourceAnchors.includes('beta_anchor'))
    assert.ok(requestLengths.every(length => length < fileText.length))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('full-paper real AI path analyzes blueprint before generating worksheet', async () => {
  const originalFetch = globalThis.fetch
  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_FALLBACK_TO_MOCK = 'false'
  process.env.DEEPSEEK_API_KEY = 'unit-test-key'
  process.env.DEEPSEEK_BASE_URL = 'https://deepseek.example.test'
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro'
  process.env.AI_THINKING_MODE = 'disabled'
  const choice = '\u9009\u62e9\u9898'
  const blank = '\u586b\u7a7a\u9898'
  const solution = '\u89e3\u7b54\u9898'
  const blueprints = Array.from({ length: 28 }, (_, index) => {
    const number = index + 1
    const type = number <= 10 ? choice : (number <= 18 ? blank : solution)
    return {
      number,
      originalStem: '\u539f\u5377\u7b2c ' + number + ' \u9898\u8003\u67e5 ' + type,
      knowledgePoints: number === 1 ? ['\u5e42\u8fd0\u7b97'] : ['\u521d\u4e00\u6570\u5b66\u7efc\u5408'],
      variationPlan: '\u66ff\u6362\u6570\u5b57\u548c\u6761\u4ef6\uff0c\u4fdd\u6301\u540c\u7c7b\u77e5\u8bc6\u70b9\u3002',
      difficulty: number > 24 ? '\u8f83\u96be' : '\u4e2d\u7b49',
      type,
      score: number <= 18 ? 3 : 6,
      expectedAnswerShape: type === choice ? '\u5355\u4e2a\u9009\u9879\u5b57\u6bcd' : '\u7ed3\u679c\u6216\u8fc7\u7a0b'
    }
  })
  let calls = 0
  try {
    globalThis.fetch = async (_, init) => {
      calls += 1
      const body = JSON.parse(init.body)
      assert.deepEqual(body.thinking, { type: 'disabled' })
      if (calls === 1) {
        assert.match(body.messages[0].content, /sourceQuestionBlueprints/)
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: '\u521d\u4e00\u6570\u5b66\u6574\u5377\u4eff\u771f\u8bd5\u5377',
            notice: ['\u6ce8\u610f\u4e8b\u9879'],
            totalQuestions: 28,
            targetPages: 6,
            targetDifficulty: '\u6df7\u5408',
            sections: [
              { name: '\u4e00\u3001\u9009\u62e9\u9898', type: choice, questionCount: 10, points: 30, difficulty: '\u57fa\u7840-\u4e2d\u7b49', skills: [] },
              { name: '\u4e8c\u3001\u586b\u7a7a\u9898', type: blank, questionCount: 8, points: 24, difficulty: '\u57fa\u7840-\u4e2d\u7b49', skills: [] },
              { name: '\u4e09\u3001\u89e3\u7b54\u9898', type: solution, questionCount: 10, points: 76, difficulty: '\u4e2d\u7b49-\u8f83\u96be', skills: [] }
            ],
            sourceQuestionBlueprints: blueprints
          }) } }]
        }), { status: 200 })
      }
      assert.match(body.messages[0].content, /questions/)
      const questionSlices = [
        blueprints.slice(0, 18),
        blueprints.slice(18, 28)
      ]
      const questions = questionSlices[calls - 2].map(item => ({
        number: item.number,
        section: item.number <= 10 ? '\u4e00\u3001\u9009\u62e9\u9898' : (item.number <= 18 ? '\u4e8c\u3001\u586b\u7a7a\u9898' : '\u4e09\u3001\u89e3\u7b54\u9898'),
        type: item.type,
        difficulty: item.difficulty,
        skill: item.knowledgePoints[0],
        question: item.type === choice ? '\u53d8\u5f0f\u7b2c ' + item.number + ' \u9898\uff0c\u8003\u67e5\u5e42\u8fd0\u7b97\u4e0e\u521d\u4e00\u6570\u5b66\u7efc\u5408\uff0c\u9009\u51fa\u6b63\u786e\u7b54\u6848\u3002' : '\u53d8\u5f0f\u7b2c ' + item.number + ' \u9898\uff0c\u8003\u67e5\u521d\u4e00\u6570\u5b66\u7efc\u5408\u80fd\u529b\u3002',
        options: item.type === choice ? ['A. 1', 'B. 2', 'C. 3', 'D. 4'] : [],
        answer: item.type === choice ? 'A' : '\u7565',
        explanation: '\u6839\u636e\u540c\u7c7b\u77e5\u8bc6\u70b9\u6c42\u89e3\u3002'
      }))
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ questions }) } }]
      }), { status: 200 })
    }
    const result = await generateFullPaperWithAI({
      prompt: '\u6574\u5377\u4eff\u771f',
      fileText: '\u521d\u4e00\u6570\u5b66 \u9009\u62e9\u9898 \u586b\u7a7a\u9898 \u89e3\u7b54\u9898 \u5e42\u8fd0\u7b97 \u4e09\u89d2\u5f62 \u6570\u8f74 \u6574\u5f0f \u89d2 \u65b9\u7a0b\u7ec4 \u4e0d\u7b49\u5f0f \u56e0\u5f0f\u5206\u89e3 \u5168\u7b49 \u9762\u79ef \u89c4\u5f8b 28.',
      grade: '\u521d\u4e00',
      subject: '\u6570\u5b66',
      difficulty: '\u6df7\u5408',
      questionCount: 28
    })
    assert.equal(result.source, 'ai')
    assert.equal(calls, 3)
    assert.equal(result.worksheet.questions.length, 28)
    assert.equal(result.worksheet.sourceQuestionBlueprints.length, 28)
    assert.equal(result.aiDebug.length, 3)
    assert.equal(result.aiDebug[0].stage, 'blueprint')
    assert.equal(result.aiDebug[1].stage, 'worksheet')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('worksheet quality gate rejects repeated or demo content', () => {
  assert.throws(() => assertWorksheetQuality({ questions: [{ number: 1, question: '解方程：x + 3 = 8', answer: '5', explanation: '略' }] }), /demo\/示例题/)
  assert.throws(() => assertWorksheetQuality({ questions: [
    { number: 1, question: '解方程：4x-7=9', answer: '4', explanation: '略' },
    { number: 2, question: '解方程：4x-7=9', answer: '4', explanation: '略' }
  ] }), /重复/)
})

test('worksheet quality gate enforces diagram policy only for diagram-required geometry', () => {
  assert.doesNotThrow(() => assertWorksheetQuality({ questions: [{
    number: 1,
    question: '一个三角形两边长分别为 3 和 6，判断第三边可能取值。',
    skill: '三角形三边关系',
    answer: '5',
    explanation: '第三边长度应大于 3 且小于 9。'
  }] }))

  assert.throws(() => assertWorksheetQuality({ questions: [{
    number: 1,
    question: '如图，在正方体 ABCD-A1B1C1D1 中，点 E 为棱 BB1 的中点，求直线 AE 与平面 A1B1C1D1 所成角。',
    skill: '立体几何',
    answer: '略',
    explanation: '需要结合空间图形判断。'
  }] }), /requires diagramSpec/)

  assert.throws(() => assertWorksheetQuality({ questions: [{
    number: 1,
    question: 'Solve 3x + 4 = 19.',
    skill: 'linear equation',
    answer: 'x=5',
    explanation: 'Subtract 4, then divide by 3.',
    diagramSpec: { type: 'template', templateId: 'triangle_ruler_overlap_angle', labels: [] }
  }] }), /not diagram-required/)
})

test('upload source usage gate rejects worksheets that ignore parsed material', () => {
  assert.throws(
    () => assertUploadedSourceUsage({ questions: [{ number: 1, question: '7x=21', answer: '3', explanation: '略' }] }, '合并同类项 移项 系数化为1'),
    /sourceAnchors/
  )
  assert.throws(
    () => assertUploadedSourceUsage({
      sourceAnchors: ['完全无关'],
      questions: [{ number: 1, question: '7x=21', answer: '3', explanation: '略' }]
    }, '合并同类项 移项 系数化为1'),
    /未命中上传资料/
  )
})

test('AI mock mode and fallback-to-mock are rejected', async () => {
  const originalFetch = globalThis.fetch

  process.env.AI_MOCK_MODE = 'true'
  process.env.AI_API_KEY = 'unit-test-key'
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called in AI_MOCK_MODE')
  }
  await assert.rejects(
    () => generateWorksheetWithAI({ prompt: 'mock mode', questionCount: 4 }),
    /AI_MOCK_MODE=true 已禁用/
  )

  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_API_KEY = 'unit-test-key'
  process.env.AI_FALLBACK_TO_MOCK = 'true'
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called when fallback-to-mock is enabled')
  }
  try {
    await assert.rejects(
      () => generateWorksheetWithAI({ prompt: 'fallback after invalid JSON', questionCount: 3 }),
      /AI_FALLBACK_TO_MOCK=true 已禁用/
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.throws(() => assertAiWorksheetPayloadSchema({ questions: [] }, { questionCount: 1 }), /questions 数量/)
})

test('worksheet mock factories no longer return demo questions', () => {
  assert.throws(
    () => createMockWorksheet('生成 5 道初一数学几何题，包含三角形和平行线角度，带答案解析。'),
    /模拟出题已禁用/
  )
  assert.throws(
    () => sampleWorksheet('几何', { grade: '初一', subject: '数学', questionCount: 4 }),
    /模拟出题已禁用/
  )
})

test('plain worksheet wording does not trigger full-paper simulation', () => {
  assert.equal(isFullPaperSimulation({ mode: 'normal', prompt: '生成一份初一数学几何试卷，5 道题，带答案解析。' }), false)
  assert.equal(isFullPaperSimulation({ mode: 'normal', prompt: '生成一份几何练习卷。' }), false)
  assert.equal(isFullPaperSimulation({ mode: 'normal', prompt: '根据原卷同结构生成新题。' }), false)
  assert.equal(isFullPaperSimulation({ mode: 'full_paper_simulation', prompt: '几何题' }), false)
})

test('full-paper simulation mode is disabled and plain worksheet is not charged as simulation', async () => {
  await assert.rejects(
    () => generateWorksheetWithAI({
      prompt: '根据原卷同结构生成新题',
      grade: '初一',
      subject: '数学',
      mode: 'full_paper_simulation',
      questionCount: 10
    }),
    /整卷仿真\/模拟试卷功能已暂停/
  )
  assert.equal(pointsFor({ prompt: '生成一份初一数学几何试卷，5 道题', mode: 'normal', questionCount: 5 }), 1)
})

test('real AI mode does not silently fall back to demo worksheets', async () => {
  process.env.AI_MOCK_MODE = 'false'
  delete process.env.AI_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  await assert.rejects(
    () => generateWorksheetWithAI({ prompt: '真实生成 3 道题', questionCount: 3 }),
    /未配置 DEEPSEEK_API_KEY|禁止使用 demo\/mock/
  )

  const originalFetch = globalThis.fetch
  process.env.DEEPSEEK_API_KEY = 'unit-test-deepseek-key'
  process.env.DEEPSEEK_BASE_URL = 'https://deepseek.example.test'
  process.env.DEEPSEEK_MODEL = 'deepseek-chat'
  delete process.env.AI_FALLBACK_TO_MOCK
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'upstream failed' } }), { status: 503 })
  try {
    await assert.rejects(
      () => generateWorksheetWithAI({ prompt: '真实生成 3 道题', questionCount: 3 }),
      /DeepSeek 真实生成失败|禁止使用 demo\/mock/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('PDF and DOCX uploads generate worksheets and remove temporary uploads', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-'))
  t.after(() => fsp.rm(tmpDir, { recursive: true, force: true }))
  const pdf = await makeSamplePdf(tmpDir)
  const docx = await makeSampleDocx(tmpDir)

  for (const file of [pdf, docx]) {
    const res = await uploadGenerate(`${baseUrl(server)}/api/worksheet/generate`, file, {
      prompt: '根据资料生成 5 道同类练习题，带答案解析。',
      grade: '初一',
      subject: '数学',
      difficulty: '中等',
      mode: 'practice',
      questionCount: 5
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.worksheet.questions.length > 0)
    assert.equal(data.worksheet.sourceFileInfo.parserStatus, 'parsed')
  }

  const uploadsDir = path.resolve('uploads')
  const leftovers = fs.existsSync(uploadsDir) ? await fsp.readdir(uploadsDir) : []
  assert.equal(leftovers.length, 0)
})

test('full-paper simulation upload is rejected while the feature is paused', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const sourcePdf = path.resolve('..', '..', 'docs', 'test', 'pdf', '初一数学.pdf')
  const res = await uploadGenerate(`${baseUrl(server)}/api/worksheet/generate`, sourcePdf, {
    prompt: '基于上传试卷整卷仿真，生成同结构、同知识点、同难度的新卷。',
    grade: '初一',
    subject: '数学',
    difficulty: '混合',
    mode: 'full_paper_simulation',
    questionCount: 10
  })
  assert.equal(res.status, 500)
  const data = await res.json()
  assert.equal(data.success, false)
  assert.match(data.message, /整卷仿真|full_paper_simulation|simulation/)
})

test('image upload uses parser placeholder and unsupported uploads are rejected', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-'))
  t.after(() => fsp.rm(tmpDir, { recursive: true, force: true }))
  const image = await makeSampleImage(tmpDir)

  const imageRes = await uploadGenerate(`${baseUrl(server)}/api/worksheet/generate`, image, {
    prompt: '根据图片资料生成 5 道同类练习题，带答案解析。',
    fileName: 'sample.png',
    fileExtension: 'png',
    fileType: '图片',
    grade: '初一',
    subject: '数学',
    difficulty: '中等',
    mode: 'practice',
    questionCount: 5
  })
  assert.equal(imageRes.status, 200)
  const imageData = await imageRes.json()
  assert.equal(imageData.success, true)
  assert.equal(imageData.worksheet.sourceFileInfo.type, '图片')
  assert.equal(imageData.worksheet.sourceFileInfo.parserStatus, 'placeholder')
  assert.match(imageData.worksheet.sourceFileInfo.parserMessage, /占位|降级/)

  const noExtImageRes = await uploadGenerate(`${baseUrl(server)}/api/worksheet/generate`, image, {
    uploadFileName: '_cgi-bin_mmwebwx-bin_wechat_tmp',
    prompt: '根据微信临时图片资料生成 1 道题。',
    fileName: '_cgi-bin_mmwebwx-bin_wechat_tmp',
    fileExtension: 'png',
    fileType: '图片',
    grade: '初一',
    subject: '数学',
    difficulty: '中等',
    mode: 'practice',
    questionCount: 1
  })
  assert.equal(noExtImageRes.status, 200)
  const noExtImageData = await noExtImageRes.json()
  assert.equal(noExtImageData.success, true)
  assert.equal(noExtImageData.worksheet.sourceFileInfo.parserStatus, 'placeholder')

  const unsupported = path.join(tmpDir, 'sample.txt')
  await fsp.writeFile(unsupported, 'plain text is not an allowed upload type')
  const badRes = await uploadGenerate(`${baseUrl(server)}/api/worksheet/generate`, unsupported, {
    prompt: 'should fail',
    grade: '初一',
    subject: '数学',
    difficulty: '中等',
    mode: 'practice',
    questionCount: 5
  })
  assert.equal(badRes.status, 400)
  const badData = await badRes.json()
  assert.equal(badData.success, false)
  assert.match(badData.message, /仅支持/)

  const uploadsDir = path.resolve('uploads')
  const leftovers = fs.existsSync(uploadsDir) ? await fsp.readdir(uploadsDir) : []
  assert.equal(leftovers.length, 0)
})

test('export endpoints return binary files by default and JSON urls on request', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const worksheet = {
    title: '初一数学一元一次方程练习卷',
    grade: '初一',
    subject: '数学',
    mode: 'practice',
    questions: [{
      number: 1,
      section: '一、选择题',
      type: '选择题',
      difficulty: '中等',
      skill: '一元一次方程',
      question: '方程 x+3=8 的解是（    ）',
      options: ['A. 3', 'B. 4', 'C. 5', 'D. 6'],
      answer: 'C',
      explanation: 'x=8-3=5。'
    }]
  }

  const pdf = await postJson(`${baseUrl(server)}/api/export/pdf`, { worksheet })
  assert.equal(pdf.status, 200)
  assert.match(pdf.headers.get('content-type') || '', /pdf|octet-stream/)
  assert.ok((await pdf.arrayBuffer()).byteLength > 1000)

  const docx = await postJson(`${baseUrl(server)}/api/export/docx`, { worksheet })
  assert.equal(docx.status, 200)
  assert.match(docx.headers.get('content-type') || '', /wordprocessingml|octet-stream/)
  assert.ok((await docx.arrayBuffer()).byteLength > 1000)

  const urlRes = await postJson(`${baseUrl(server)}/api/export/pdf?returnUrl=1`, { worksheet }, { accept: 'application/json' })
  const data = await urlRes.json()
  assert.equal(data.success, true)
  assert.ok(data.pdfUrl.endsWith('.pdf'))
  const freePdfText = await readGeneratedPdfText(data.pdfUrl)
  assertFreeWatermarkMarker(freePdfText, true)
  assert.ok(freePdfText.includes('free-watermark-tiles-per-page=6'), 'free PDF should mark six visible watermark tiles per page')
  assert.equal(await getGeneratedPdfPageCount(data.pdfUrl), 2, 'single-question worksheet should only have question page + answer page')

  const memberUrlRes = await postJson(`${baseUrl(server)}/api/export/pdf?returnUrl=1`, { worksheet, watermark: false }, {
    accept: 'application/json',
    'x-plan-code': 'pro',
    'x-plan-expires-at': new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString()
  })
  const memberData = await memberUrlRes.json()
  assert.equal(memberData.success, true)
  assert.equal(memberData.watermark, false)
  assert.ok(memberData.pdfUrl.endsWith('.pdf'))
  const memberPdfText = await readGeneratedPdfText(memberData.pdfUrl)
  assertFreeWatermarkMarker(memberPdfText, false)
  assert.equal(await getGeneratedPdfPageCount(memberData.pdfUrl), 2, 'member PDF should not contain trailing blank pages either')
})

test('PDF and Word answer pages prefer structured math steps over raw long explanation', async t => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-export-'))
  t.after(() => fsp.rm(tmpDir, { recursive: true, force: true }))
  const worksheet = normalizeWorksheet({
    title: '数学结构化解析测试',
    grade: '初一',
    subject: '数学',
    mode: 'practice',
    questions: [{
      number: 1,
      section: '一、解答题',
      type: '解答题',
      difficulty: '中等',
      skill: '数轴',
      question: '如图，点 A 表示 -2，点 B 表示 4，求 AB 的长度。',
      questionLatex: 'AB=4-(-2)',
      options: [],
      answer: 'AB=6',
      answerLatex: 'AB=6',
      explanation: '原始长文本不应该优先出现在导出的答案页。',
      explanationSteps: [
        '数轴上两点距离等于对应坐标差的绝对值。',
        '$AB=|4-(-2)|=6$，所以线段 AB 的长为 6。'
      ],
      diagramSpec: { type: 'number_line', axis: { min: -3, max: 5 }, points: { A: -2, B: 4 }, labels: ['A', 'B'] },
      tableSpec: { headers: ['点', '坐标'], rows: [['A', '-2'], ['B', '4']] }
    }]
  })
  const pdfPath = path.join(tmpDir, 'structured.pdf')
  const docxPath = path.join(tmpDir, 'structured.docx')
  await buildPdf({ worksheet, outputPath: pdfPath, watermark: false })
  await buildDocx({ worksheet, outputPath: docxPath })

  const parser = new PDFParse({ data: await fsp.readFile(pdfPath) })
  let pdfText = ''
  try {
    pdfText = String((await parser.getText()).text || '')
  } finally {
    await parser.destroy?.()
  }
  assert.match(pdfText, /数轴上两点距离/)
  assert.equal(pdfText.includes('原始长文本不应该'), false)
  assert.equal(pdfText.includes('□'), false)

  const docxText = String((await mammoth.extractRawText({ path: docxPath })).value || '')
  assert.match(docxText, /数轴上两点距离/)
  assert.equal(docxText.includes('原始长文本不应该'), false)
})

test('points policy and frontend secret guard are enforced', async () => {
  assert.equal(pointsFor({ prompt: '普通练习', mode: 'practice', questionCount: 5 }), 1)
  assert.equal(pointsFor({ prompt: '普通练习', mode: 'practice', questionCount: 10 }), 2)
  assert.equal(pointsFor({ prompt: '普通练习', mode: 'extended', questionCount: 10 }), 2)
  assert.equal(pointsFor({ prompt: '错题同类题', mode: 'wrong_question_similar', questionCount: 10 }), 2)
  assert.equal(pointsFor({ prompt: '上传资料', mode: 'upload_material', questionCount: 10 }), 2)
  assert.equal(pointsFor({ prompt: '上传试卷整卷仿真', mode: 'full_paper_simulation', questionCount: 10 }), 2)

  const miniProgramRoot = path.resolve('..', 'miniprogram')
  const files = await collectFiles(miniProgramRoot)
  for (const file of files) {
    const text = await fsp.readFile(file, 'utf8')
    assert.equal(text.includes('AI_API_KEY'), false, `${file} must not mention AI_API_KEY`)
    assert.equal(text.includes('AI_BASE_URL'), false, `${file} must not mention AI_BASE_URL`)
    assert.equal(text.includes('AI_MODEL'), false, `${file} must not mention AI_MODEL`)
  }
})

test('plans and mock purchase endpoints expose state contract', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())

  const plansRes = await fetch(`${baseUrl(server)}/api/plans`)
  assert.equal(plansRes.status, 200)
  const plans = await plansRes.json()
  assert.equal(plans.success, true)
  assert.equal(plans.plans.month.length, 3)
  assert.equal(plans.plans.pointPacks.length, 2)

  const purchaseRes = await postJson(`${baseUrl(server)}/api/purchases/mock`, { productCode: 'pro_monthly' })
  assert.equal(purchaseRes.status, 200)
  const purchase = await purchaseRes.json()
  assert.equal(purchase.success, true)
  assert.equal(purchase.paymentStatus, 'paid')
  assert.equal(purchase.member.planId, 'pro_monthly')
  assert.equal(purchase.member.planCode, 'pro')
  assert.equal(purchase.pointsAdded, purchase.plan.points)
})

test('generation estimate and me endpoints expose V1 entitlement contract', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())

  const session = await login(baseUrl(server), 'me-contract-user')
  const estimate = await postJson(`${baseUrl(server)}/api/generation/estimate`, {
    mode: 'upload_material',
    prompt: 'x'.repeat(1601)
  }, session.auth)
  assert.equal(estimate.status, 200)
  assert.deepEqual(await estimate.json(), {
    success: true,
    mode: 'upload_material',
    estimatedPages: 3,
    pointsRequired: 6,
    source: 'text',
    confidence: 'estimated',
    textLength: 1601,
    maxPages: 6,
    metered: true
  })

  const orderRes = await postJson(`${baseUrl(server)}/api/orders/create`, { productCode: 'pro_monthly' }, session.auth)
  const order = (await orderRes.json()).order
  await postJson(`${baseUrl(server)}/api/dev/pay/mock-success`, { orderNo: order.orderNo }, session.auth)

  const me = await fetch(`${baseUrl(server)}/api/me`, { headers: session.auth })
  assert.equal(me.status, 200)
  const data = await me.json()
  assert.equal(data.planCode, 'pro')
  assert.equal(data.pointsBalance, 83)
  assert.equal(data.isPaid, true)
  assert.equal(data.canDownloadWord, true)
  assert.equal(data.canRemoveWatermark, true)
})

test('metered page estimate treats images as one page and rejects oversized pasted text', async () => {
  const imageCharge = await estimateGenerationCharge({
    mode: 'upload_material',
    prompt: 'generate from this picture',
    file: { originalname: 'worksheet-photo.png', mimetype: 'image/png' },
    meta: { fileExtension: 'png', fileType: 'image' }
  })
  assert.equal(imageCharge.estimatedPages, 1)
  assert.equal(imageCharge.pointsRequired, 2)
  assert.equal(imageCharge.source, 'image')

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-word-pages-'))
  const docxPath = path.join(tmpDir, 'paged.docx')
  const doc = new Document({
    sections: [{
      children: [new Paragraph({ children: [new TextRun('Word material with stored page metadata.')] })]
    }]
  })
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc))
  zip.file('docProps/app.xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">',
    '<Pages>6</Pages>',
    '</Properties>'
  ].join(''))
  await fsp.writeFile(docxPath, await zip.generateAsync({ type: 'nodebuffer' }))
  const wordCharge = await estimateGenerationCharge({
    mode: 'upload_material',
    file: { path: docxPath, originalname: 'paged.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    meta: { fileExtension: 'docx', fileType: 'Word' }
  })
  assert.equal(wordCharge.estimatedPages, 6)
  assert.equal(wordCharge.pointsRequired, 12)
  assert.equal(wordCharge.source, 'word')
  assert.equal(wordCharge.confidence, 'exact')

  const oldDocPath = path.join(tmpDir, 'legacy.doc')
  await fsp.writeFile(oldDocPath, 'not a docx zip')
  await assert.rejects(
    () => estimateGenerationCharge({
      mode: 'upload_material',
      file: { path: oldDocPath, originalname: 'legacy.doc', mimetype: 'application/msword' },
      meta: { fileExtension: 'doc', fileType: 'Word' }
    }),
    error => error.code === 'WORD_PARSE_FAILED' && /docx/.test(error.message)
  )

  const brokenDocxPath = path.join(tmpDir, 'broken.docx')
  await fsp.writeFile(brokenDocxPath, 'not a zip either')
  await assert.rejects(
    () => estimateGenerationCharge({
      mode: 'upload_material',
      file: { path: brokenDocxPath, originalname: 'broken.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      meta: { fileExtension: 'docx', fileType: 'Word' }
    }),
    error => error.code === 'WORD_PARSE_FAILED' && /Word 文件无法识别/.test(error.message)
  )
  await fsp.rm(tmpDir, { recursive: true, force: true })

  await assert.rejects(
    () => estimateGenerationCharge({
      mode: 'upload_material',
      prompt: 'long pasted source '.repeat(260)
    }),
    error => error.code === 'METERED_PAGE_LIMIT_EXCEEDED' && error.maxPages === 6
  )
})

test('authed generation estimate accepts WeChat image temp names without extension', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'wechat-image-estimate-user')
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'printersheet-wechat-image-'))
  t.after(() => fsp.rm(tmpDir, { recursive: true, force: true }))
  const imagePath = path.join(tmpDir, '_cgi-bin_mmwebwx-bin_webwxgetmsgimg')
  await fsp.writeFile(imagePath, Buffer.from('wechat temp image placeholder'))

  const res = await uploadGenerate(`${base}/api/generation/estimate`, imagePath, {
    uploadFileName: '_cgi-bin_mmwebwx-bin_webwxgetmsgimg',
    prompt: '',
    mode: 'upload_material',
    fileName: '_cgi-bin_mmwebwx-bin_webwxgetmsgimg',
    fileType: 'image',
    fileExtension: 'jpg'
  }, session.auth)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal(data.estimatedPages, 1)
  assert.equal(data.pointsRequired, 2)
  assert.equal(data.source, 'image')
})

test('phase 1 login creates local user account and grants initial points once', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)

  const first = await login(base, 'phase1-login-user')
  assert.equal(first.firstLogin, true)
  let points = await (await fetch(`${base}/api/points`, { headers: first.auth })).json()
  assert.equal(points.pointsBalance, 3)

  const second = await login(base, 'phase1-login-user')
  assert.equal(second.firstLogin, false)
  points = await (await fetch(`${base}/api/points`, { headers: second.auth })).json()
  assert.equal(points.pointsBalance, 3)

  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.equal(persisted.users.length, 1)
  assert.equal(persisted.point_accounts[0].balance, 3)
  assert.equal(persisted.point_ledger.filter(item => item.source === 'new_user_bonus').length, 1)
})

test('real WeChat login exchanges wx code for openid and keeps session key server-side', async () => {
  const db = new LocalDbAdapter(process.env.LOCAL_DB_PATH)
  const authService = new AuthService({
    db,
    env: {
      nodeEnv: 'production',
      authSecret: 'unit-auth-secret',
      wechatAppId: 'wx-real-app',
      wechatAppSecret: 'real-secret'
    },
    fetchImpl: async url => {
      assert.equal(url.searchParams.get('appid'), 'wx-real-app')
      assert.equal(url.searchParams.get('secret'), 'real-secret')
      assert.equal(url.searchParams.get('js_code'), 'wx-login-code')
      assert.equal(url.searchParams.get('grant_type'), 'authorization_code')
      return new Response(JSON.stringify({
        openid: 'real-openid-001',
        unionid: 'real-union-001',
        session_key: 'server-only-session-key'
      }), { status: 200 })
    }
  })

  const first = await authService.login({
    code: 'wx-login-code',
    userInfo: { nickName: 'Real User', avatarUrl: 'https://example.test/real.png' }
  })
  assert.equal(first.firstLogin, true)
  assert.equal(first.user.openid, 'real-openid-001')
  assert.equal(first.user.unionid, 'real-union-001')
  assert.equal(first.user.sessionKey, undefined)
  assert.ok(first.token)

  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.equal(persisted.users.length, 1)
  assert.equal(persisted.users[0].openid, 'real-openid-001')
  assert.equal(persisted.users[0].sessionKey, 'server-only-session-key')
  assert.equal(persisted.point_accounts[0].balance, 3)
  assert.equal(persisted.point_ledger.filter(item => item.source === 'new_user_bonus').length, 1)
})

test('phase 1 protected APIs require token', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())

  const res = await fetch(`${baseUrl(server)}/api/points`)
  assert.equal(res.status, 401)
})

test('daily share reward persists one log per user date and channel', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'daily-share-user')

  const firstRes = await postJson(`${base}/api/rewards/daily-share`, { channel: 'timeline' }, session.auth)
  assert.equal(firstRes.status, 200)
  const first = await firstRes.json()
  assert.equal(first.success, true)
  assert.equal(first.claimed, true)
  assert.equal(first.pointsAdded, 1)
  assert.equal(first.pointsBalance, 4)
  assert.equal(first.rewardLog.userId, session.user.id)
  assert.equal(first.rewardLog.channel, 'timeline')
  assert.match(first.rewardLog.rewardDate, /^\d{4}-\d{2}-\d{2}$/)

  const secondRes = await postJson(`${base}/api/rewards/daily-share`, { channel: 'timeline' }, session.auth)
  assert.equal(secondRes.status, 200)
  const second = await secondRes.json()
  assert.equal(second.success, true)
  assert.equal(second.claimed, false)
  assert.equal(second.code, 'ALREADY_CLAIMED')
  assert.equal(second.pointsAdded, 0)
  assert.equal(second.pointsBalance, 4)

  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.equal(persisted.share_reward_logs.length, 1)
  assert.equal(persisted.share_reward_logs[0].userId, session.user.id)
  assert.equal(persisted.share_reward_logs[0].channel, 'timeline')
  assert.equal(persisted.point_accounts.find(item => item.userId === session.user.id).balance, 4)
  assert.equal(persisted.point_ledger.filter(item => item.source === 'daily_share').length, 1)
})

test('phase 1 orders and mock payments are idempotent', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'phase1-payment-user')

  const createRes = await postJson(`${base}/api/orders/create`, { productCode: 'small_pack' }, session.auth)
  assert.equal(createRes.status, 200)
  const created = await createRes.json()
  assert.equal(created.order.status, 'pending')
  assert.equal(created.order.amountCents, 1)
  assert.equal(created.order.originalAmountCents, 990)
  assert.equal(created.order.paymentTestMode, true)

  const payRes = await postJson(`${base}/api/dev/pay/mock-success`, { orderNo: created.order.orderNo }, session.auth)
  assert.equal(payRes.status, 200)
  assert.equal((await payRes.json()).order.status, 'paid')
  let points = await (await fetch(`${base}/api/points`, { headers: session.auth })).json()
  assert.equal(points.pointsBalance, 28)

  await postJson(`${base}/api/dev/pay/mock-success`, { orderNo: created.order.orderNo }, session.auth)
  points = await (await fetch(`${base}/api/points`, { headers: session.auth })).json()
  assert.equal(points.pointsBalance, 28)
})

test('paid users can upgrade plans or buy point packs but cannot repurchase current or lower plans', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'plan-upgrade-user')

  const starterRes = await postJson(`${base}/api/orders/create`, { productCode: 'starter_monthly' }, session.auth)
  assert.equal(starterRes.status, 200)
  const starter = await starterRes.json()
  await postJson(`${base}/api/dev/pay/mock-success`, { orderNo: starter.order.orderNo }, session.auth)

  const repeatStarter = await postJson(`${base}/api/orders/create`, { productCode: 'starter_monthly' }, session.auth)
  assert.equal(repeatStarter.status, 409)

  const upgradePro = await postJson(`${base}/api/orders/create`, { productCode: 'pro_monthly' }, session.auth)
  assert.equal(upgradePro.status, 200)

  const pack = await postJson(`${base}/api/orders/create`, { productCode: 'small_pack' }, session.auth)
  assert.equal(pack.status, 200)
})

test('phase 1 worksheet generation deducts points, persists records and is requestId idempotent', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'phase1-generate-user')
  const payload = {
    requestId: 'generate-once',
    prompt: 'generate five equations',
    grade: 'Grade 7',
    subject: 'Math',
    difficulty: 'medium',
    mode: 'practice',
    questionCount: 5
  }

  const firstRes = await postJson(`${base}/api/worksheets/generate`, payload, session.auth)
  assert.equal(firstRes.status, 200)
  const first = await firstRes.json()
  assert.equal(first.success, true)
  assert.ok(first.worksheetId)
  assert.equal(first.pointsUsed, 1)

  const secondRes = await postJson(`${base}/api/worksheets/generate`, payload, session.auth)
  assert.equal(secondRes.status, 200)
  const second = await secondRes.json()
  assert.equal(second.worksheetId, first.worksheetId)

  const points = await (await fetch(`${base}/api/points`, { headers: session.auth })).json()
  assert.equal(points.pointsBalance, 2)
  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.equal(persisted.worksheet_records.length, 1)
  assert.equal(persisted.file_objects.filter(item => item.recordId === first.worksheetId).length, 2)

  const pdf = await fetch(`${base}${first.pdfUrl}`, { headers: session.auth })
  assert.equal(pdf.status, 200)
  assert.ok((await pdf.arrayBuffer()).byteLength > 1000)
})

test('generation job queue completes 10 real async jobs for different users', async t => {
  process.env.GENERATION_JOB_CONCURRENCY = '3'
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const sessions = await Promise.all(Array.from({ length: 10 }, (_, index) => login(base, `queue-user-${index + 1}`)))

  const created = await Promise.all(sessions.map((session, index) => postJson(`${base}/api/generation-jobs`, {
    requestId: `queue-request-${index + 1}`,
    prompt: `生成 5 道初一数学一元一次方程中等题，第 ${index + 1} 组`,
    grade: '初一',
    subject: '数学',
    difficulty: '中等',
    mode: 'normal',
    questionCount: 5
  }, session.auth).then(async res => {
    assert.equal(res.status, 202)
    const data = await res.json()
    assert.equal(data.success, true)
    assert.ok(data.job.id)
    return { session, jobId: data.job.id }
  })))

  const done = []
  const deadline = Date.now() + 30000
  while (done.length < created.length && Date.now() < deadline) {
    done.length = 0
    for (const item of created) {
      const res = await fetch(`${base}/api/generation-jobs/${item.jobId}`, { headers: item.session.auth })
      assert.equal(res.status, 200)
      const data = await res.json()
      if (data.job.status === 'failed') assert.fail(data.job.errorMessage || data.job.message)
      if (data.job.status === 'succeeded') done.push(data.job)
    }
    if (done.length < created.length) await new Promise(resolve => setTimeout(resolve, 200))
  }

  assert.equal(done.length, 10)
  assert.ok(done.every(job => job.result?.worksheetId && job.worksheetRecordId === job.result.worksheetId))

  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.equal(persisted.generation_jobs.length, 10)
  assert.equal(persisted.generation_jobs.filter(job => job.status === 'succeeded').length, 10)
  assert.equal(persisted.worksheet_records.length, 10)
  assert.equal(persisted.file_objects.length, 20)
})

test('generation job timeout fails persisted job and refunds points', async t => {
  const aiServer = http.createServer(() => {})
  await listen(aiServer)
  t.after(() => {
    aiServer.closeAllConnections?.()
    aiServer.close()
  })

  process.env.AI_MOCK_MODE = 'false'
  process.env.AI_PROVIDER = 'openaiCompatible'
  process.env.AI_API_KEY = 'unit-test-key'
  process.env.AI_BASE_URL = baseUrl(aiServer)
  process.env.AI_REQUEST_TIMEOUT_MS = '60000'
  process.env.GENERATION_JOB_TIMEOUT_MS = '50'

  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'job-timeout-user')
  const requestId = 'job-timeout-refund'

  const createdRes = await postJson(`${base}/api/generation-jobs`, {
    requestId,
    prompt: '生成 5 道初一语文普通练习题',
    grade: '初一',
    subject: '语文',
    difficulty: '中等',
    mode: 'practice',
    questionCount: 5
  }, session.auth)
  assert.equal(createdRes.status, 202)
  const created = await createdRes.json()
  assert.equal(created.success, true)
  assert.ok(created.job.id)

  let failedJob = null
  const deadline = Date.now() + 5000
  while (!failedJob && Date.now() < deadline) {
    const res = await fetch(`${base}/api/generation-jobs/${created.job.id}`, { headers: session.auth })
    assert.equal(res.status, 200)
    const data = await res.json()
    if (data.job.status === 'failed') failedJob = data.job
    else await new Promise(resolve => setTimeout(resolve, 50))
  }

  assert.ok(failedJob, 'job should fail after the backend timeout')
  assert.equal(failedJob.progress, 100)
  assert.equal(failedJob.message, '生成超时，请重新生成。')
  assert.equal(failedJob.errorMessage, '生成超时，请重新生成。')

  const points = await (await fetch(`${base}/api/points`, { headers: session.auth })).json()
  assert.equal(points.pointsBalance, 3)
  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.equal(persisted.generation_jobs.find(job => job.requestId === requestId).status, 'failed')
  assert.ok(persisted.point_ledger.some(item => item.type === 'consume' && item.requestId === requestId))
  assert.ok(persisted.point_ledger.some(item => item.type === 'refund' && item.requestId === requestId))
})

test('phase 1 worksheet generation blocks insufficient points and refunds failed generation', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const session = await login(base, 'phase1-failure-user')

  const insufficient = await postJson(`${base}/api/worksheets/generate`, {
    requestId: 'too-expensive',
    prompt: 'x'.repeat(1601),
    mode: 'upload_material',
    questionCount: 10
  }, session.auth)
  assert.equal(insufficient.status, 402)

  process.env.AI_MOCK_MODE = 'false'
  delete process.env.AI_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  const failed = await postJson(`${base}/api/worksheets/generate`, {
    requestId: 'will-refund',
    prompt: 'real generation without key',
    mode: 'practice',
    questionCount: 5
  }, session.auth)
  assert.equal(failed.status, 500)
  process.env.AI_MOCK_MODE = 'false'

  const points = await (await fetch(`${base}/api/points`, { headers: session.auth })).json()
  assert.equal(points.pointsBalance, 3)
  const persisted = JSON.parse(await fsp.readFile(process.env.LOCAL_DB_PATH, 'utf8'))
  assert.ok(persisted.point_ledger.some(item => item.type === 'consume' && item.requestId === 'will-refund'))
  assert.ok(persisted.point_ledger.some(item => item.type === 'refund' && item.requestId === 'will-refund'))
})

test('phase 1 users cannot access another user worksheet or file', async t => {
  const server = await listen(createApp())
  t.after(() => server.close())
  const base = baseUrl(server)
  const owner = await login(base, 'phase1-owner')
  const other = await login(base, 'phase1-other')

  const createdRes = await postJson(`${base}/api/worksheets/generate`, {
    requestId: 'owner-record',
    prompt: 'generate five equations',
    mode: 'practice',
    questionCount: 5
  }, owner.auth)
  const created = await createdRes.json()

  const detail = await fetch(`${base}/api/worksheets/${created.worksheetId}`, { headers: other.auth })
  assert.equal(detail.status, 404)
  const download = await fetch(`${base}${created.pdfUrl}`, { headers: other.auth })
  assert.equal(download.status, 404)
})

test('AI config endpoint exposes active model without API key', async t => {
  process.env.AI_PROVIDER = 'deepseek'
  process.env.AI_API_KEY = 'unit-test-key'
  process.env.AI_MODEL = 'deepseek-v4-pro'
  const server = await listen(createApp())
  t.after(() => server.close())

  const res = await fetch(`${baseUrl(server)}/api/ai/config`)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.success, true)
  assert.equal(data.active.providerId, 'deepseek')
  assert.equal(data.active.model, 'deepseek-v4-pro')
  assert.equal(data.active.hasApiKey, true)
  assert.equal(JSON.stringify(data).includes('unit-test-key'), false)
})

async function collectFiles(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(full))
    else files.push(full)
  }
  return files
}
