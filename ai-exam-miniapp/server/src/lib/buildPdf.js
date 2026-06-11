import fs from 'fs'
import PDFDocument from 'pdfkit'
import { renderGeometryDiagram } from './geometryRenderer.js'
import {
  diagramSpecIsMeaningful,
  classifyGeometryQuestion,
  shouldUseQuestionNumberFallback
} from './geometryClassifier.js'
import { validateGeometryDiagramSpec } from './geometryRenderer.js'
import { explanationStepsForQuestion, splitMathParts, toDisplayChemistry, toDisplayMath } from './mathFormat.js'

const PAGE_BOTTOM = 735
const EXAM_LEFT = 76
const EXAM_RIGHT = 520
const EXAM_WIDTH = EXAM_RIGHT - EXAM_LEFT
const PRACTICE_LEFT = 38
const PRACTICE_RIGHT = 560
const PRACTICE_WIDTH = PRACTICE_RIGHT - PRACTICE_LEFT
const PRACTICE_TEXT_LEFT = 58
const PRACTICE_TEXT_WIDTH = PRACTICE_RIGHT - PRACTICE_TEXT_LEFT
const COLORS = {
  ink: '#111827',
  muted: '#667085',
  line: '#1F2937',
  hairline: '#D7DCE5',
  paper: '#F8F9FB',
  accent: '#4F46E5',
  accentDark: '#312E81',
  accentSoft: '#F1F3F8'
}

function findFont() {
  const candidates = [
    process.env.PDF_FONT_PATH,
    'C:/Windows/Fonts/NotoSansSC-VF.ttf',
    'C:/Windows/Fonts/Noto Sans SC (TrueType).otf',
    'C:/Windows/Fonts/STSONG.TTF',
    'C:/Windows/Fonts/simsun.ttc',
    'C:/Windows/Fonts/simsunb.ttf',
    'C:/Windows/Fonts/simkai.ttf',
    'C:/Windows/Fonts/Deng.ttf',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/msyhbd.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
    '/System/Library/Fonts/PingFang.ttc'
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p))
}

function findBoldFont() {
  const candidates = [
    process.env.PDF_BOLD_FONT_PATH,
    'C:/Windows/Fonts/Noto Sans SC Bold (TrueType).otf',
    'C:/Windows/Fonts/NotoSansSC-Bold.otf',
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/simsunb.ttf',
    'C:/Windows/Fonts/STSONG.TTF',
    'C:/Windows/Fonts/Dengb.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.otf',
    '/System/Library/Fonts/PingFang.ttc'
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p) && !/\.ttc$/i.test(p))
}

function setPdfFont(doc, weight = 'normal') {
  if (weight === 'bold' && doc._printerSheetFonts?.bold) {
    doc.font('paper-bold')
    return
  }
  if (doc._printerSheetFonts?.normal) doc.font('paper-normal')
}

function ensureSpace(doc, minHeight = 90) {
  if (doc.y + minHeight > PAGE_BOTTOM) doc.addPage()
}

function hasAny(text = '', words = []) {
  const value = String(text || '')
  return words.some(word => value.includes(word))
}

function isChoiceQuestion(q) {
  return hasAny(`${q.type || ''} ${q.section || ''}`, ['选择', '閫夋嫨'])
}

function isBlankQuestion(q) {
  return hasAny(`${q.type || ''} ${q.section || ''}`, ['填空', '濉┖'])
}

function sectionBreakAfter(number) {
  return [5, 18, 21, 25, 27].includes(Number(number))
}

const PDF_UNICODE_FALLBACKS = {
  '⁰': '^0',
  '¹': '^1',
  '²': '^2',
  '³': '^3',
  '⁴': '^4',
  '⁵': '^5',
  '⁶': '^6',
  '⁷': '^7',
  '⁸': '^8',
  '⁹': '^9',
  '⁺': '^+',
  '⁻': '^-',
  '⁽': '^(',
  '⁾': '^)',
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  'ₐ': 'a',
  'ₑ': 'e',
  'ₕ': 'h',
  'ᵢ': 'i',
  'ⱼ': 'j',
  'ₖ': 'k',
  'ₗ': 'l',
  'ₘ': 'm',
  'ₙ': 'n',
  'ₒ': 'o',
  'ₚ': 'p',
  'ᵣ': 'r',
  'ₛ': 's',
  'ₜ': 't',
  'ᵤ': 'u',
  'ᵥ': 'v',
  'ₓ': 'x',
  '℃': '°C'
}

function pdfSafeText(text = '') {
  return String(text || '')
    .replace(/\\circ\b/g, '°')
    .replace(/\^°/g, '°')
    .replace(/\\parallel\b/g, '∥')
    .replace(/\\perp\b/g, '⊥')
    .replace(/\\triangle\b|\\Delta\b/g, '△')
    .replace(/\\angle\b/g, '∠')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\u00F7/g, '/')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾]+/g, value => `^${Array.from(value).map(char => String(PDF_UNICODE_FALLBACKS[char] || '').replace(/^\^/, '')).join('')}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ℃]/g, char => PDF_UNICODE_FALLBACKS[char] || '')
    .replace(/□/g, '')
    .replace(/\s+/g, ' ')
}

function plainMathText(text = '') {
  const chemistrySafe = toDisplayChemistry(text)
  return pdfSafeText(splitMathParts(chemistrySafe).map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text).join(''))
}

function isRuledAnswerLine(line = '') {
  const compact = String(line || '').replace(/\s+/g, '')
  return compact.length >= 6 && /^[＿_\-－—─━一]+$/.test(compact)
}

function stripAnswerScaffold(text = '') {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const markerIndex = lines.findIndex((line, index) =>
    /^[\s　]*(?:答|解|证明)\s*[:：]?\s*$/.test(line) &&
    lines.slice(index + 1).some(isRuledAnswerLine)
  )
  const value = (markerIndex >= 0 ? lines.slice(0, markerIndex).join('\n') : lines.join('\n'))
    .replace(/[\s　]*(?:答|解|证明)\s*[:：]\s*(?:[＿_\-－—─━一]{6,}\s*)+$/u, '')
  return value.trim()
}

function withLatexText(text = '', latex = '') {
  const base = stripAnswerScaffold(text)
  const formula = plainMathText(latex || '')
  if (!formula) return base
  const compactBase = plainMathText(base).replace(/\s+/g, '')
  const compactFormula = formula.replace(/\s+/g, '')
  const tokenMatches = (formula.match(/[A-Za-z]{1,3}|[0-9]+/g) || []).filter(token => token.length > 1 || /\d/.test(token))
  const repeatedTokens = tokenMatches.filter(token => compactBase.includes(token)).length
  if (tokenMatches.length >= 2 && repeatedTokens >= 2) return base
  if (base.length > 18 && formula.length > 18 && repeatedTokens > 0) return base
  return compactBase.includes(compactFormula) ? base : `${base} ${formula}`
}

function sanitizeText(text = '') {
  return plainMathText(stripAnswerScaffold(text))
    .replace(/÷/g, '/')
    .replace(/（\s*图略\s*）/g, '')
    .replace(/图略/g, '')
    .replace(/需具体图形[^，。；]*/g, '')
    .replace(/按变式给出/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sectionTitle(section = '', q) {
  const value = String(section || '')
  if (hasAny(value, ['选择', '閫夋嫨']) || q?.number <= 10) {
    return '一、选择题（本大题共 10 小题，每小题 3 分，共 30 分. 在每小题给出的四个选项中，只有一项是符合题目要求的）'
  }
  if (hasAny(value, ['填空', '濉┖']) || q?.number <= 18) {
    return '二、填空题（本大题共 8 小题，每小题 3 分，共 24 分）'
  }
  return '三、解答题（本大题共 10 小题，共 76 分）'
}

function writeWatermarks(doc) {
  const range = doc.bufferedPageRange()
  const tiles = [[140, 190], [430, 190], [140, 410], [430, 410], [140, 630], [430, 630]]
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i)
    for (const [x, y] of tiles) {
      doc.save()
      doc.rotate(-24, { origin: [x, y] })
      doc.fontSize(22).fillColor(COLORS.accent).opacity(0.045)
        .text('\u0041\u0049\u51fa\u9898\u5c0f\u52a9\u624b \u514d\u8d39\u7248\u6c34\u5370', x - 185, y - 14, { align: 'center', width: 370, lineBreak: false })
      doc.restore()
    }
    doc.opacity(1)
  }
}

function writeExamHeader(doc, worksheet) {
  const meta = worksheet.examMeta || {}
  const rawTitle = String(meta.title || worksheet.title || '').trim()
  const title = rawTitle.replace(/\s*初一数学\s*$/, '').trim() || '2020~2021 学年第二学期期末教学质量调研试卷'

  doc.save()
  doc.rect(EXAM_LEFT, 26, 15, 15).fill('#2B8FEF')
  doc.fillColor('#2B8FEF').fontSize(9).text('AI 出题小助手', EXAM_LEFT + 22, 27, { width: 120, lineBreak: false })
  doc.fillColor('#777777').fontSize(7.5).text('智能组卷  打印试卷', EXAM_LEFT + 108, 29, { width: 150, lineBreak: false })
  doc.moveTo(EXAM_LEFT, 55).lineTo(EXAM_RIGHT, 55).lineWidth(1).strokeColor('#222222').stroke()
  doc.restore()

  doc.y = 88
  doc.fontSize(13).fillColor('#111111').text(title, EXAM_LEFT, doc.y, { align: 'center', width: EXAM_WIDTH })
  doc.moveDown(0.45)
  doc.fontSize(16).text('初一数学', EXAM_LEFT, doc.y, { align: 'center', width: EXAM_WIDTH })
  doc.fontSize(10.5).text('2021.06', 458, 112, { width: 70, lineBreak: false })
  doc.moveDown(0.9)
  doc.fontSize(10.3).text('注意事项：', EXAM_LEFT, doc.y, { width: EXAM_WIDTH })
  doc.moveDown(0.5)

  const notice = meta.notice?.length
    ? meta.notice
    : [
        '1.本试卷由填空题、选择题和解答题三大题组成，共 28 小题，满分 130 分，考试用时 120 分钟.',
        '2.答题前，考生务必将学校、姓名、考场号、座位号、考试号填写在答题卷相应的位置上.',
        '3.答选择题时必须用 2B 铅笔把答案涂黑；答非选择题必须用黑色墨水笔写在指定位置.',
        '4.考生答题必须在答题卷上，答在试卷和草稿纸上一律无效.'
      ]
  notice.slice(0, 4).forEach((item, index) => {
    const text = String(item || '').replace(/\s+/g, ' ')
    const prefix = /^\d+[.、]/.test(text) ? '' : `${index + 1}.`
    doc.fontSize(10.2).text(`${prefix}${text}`, EXAM_LEFT, doc.y, { width: EXAM_WIDTH, lineGap: 5 })
  })
  doc.moveDown(0.7)
}

function writeExamFooters(doc) {
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i)
    const page = i - range.start + 1
    doc.opacity(1).fontSize(9).fillColor('#111111')
      .text(String(page), 252, 756, { width: 90, align: 'center', lineBreak: false })
  }
}

function writeQuestionText(doc, q, opts = {}) {
  const prefix = opts.prefix === false ? '' : `${q.number}. `
  doc.fontSize(opts.size || 10.4).fillColor(opts.color || '#111111')
    .text(`${prefix}${sanitizeText(withLatexText(q.question, q.questionLatex))}`, EXAM_LEFT, doc.y, {
      width: opts.width || EXAM_WIDTH,
      lineGap: opts.lineGap ?? 4
    })
}

function writeOptionsGrid(doc, options = []) {
  const items = options.slice(0, 4).map((option, index) => {
    const label = String.fromCharCode(65 + index)
    const text = String(option || '').replace(/^[A-D]\s*[.．、]?\s*/, '')
    return `${label}. ${sanitizeText(text)}`
  })
  const longOption = items.some(item => item.length > 16)
  const y = doc.y + 6
  if (longOption) {
    const positions = [
      [EXAM_LEFT + 15, y],
      [EXAM_LEFT + 245, y],
      [EXAM_LEFT + 15, y + 22],
      [EXAM_LEFT + 245, y + 22]
    ]
    items.forEach((item, index) => {
      const [x, yy] = positions[index]
      doc.fontSize(10.2).text(item, x, yy, { width: 205, lineGap: 2 })
    })
    doc.y = y + 48
    return
  }
  const xPositions = [EXAM_LEFT + 15, EXAM_LEFT + 125, EXAM_LEFT + 245, EXAM_LEFT + 370]
  items.forEach((item, index) => {
    doc.fontSize(10.4).text(item, xPositions[index], y, { width: 108, lineBreak: false })
  })
  doc.y = y + 20
}

function drawNumberLine(doc, x, y, width = 260) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1)
  doc.moveTo(x, y).lineTo(x + width, y).stroke()
  for (let i = 0; i <= 8; i += 1) {
    const px = x + i * (width / 8)
    doc.moveTo(px, y - 5).lineTo(px, y + 5).stroke()
    doc.fontSize(8).text(String(i - 4), px - 5, y + 8, { width: 16, align: 'center' })
  }
  doc.circle(x + 2.5 * (width / 8), y, 3).fill('#111111')
  doc.fontSize(9).text('a', x + 2.5 * (width / 8) - 4, y - 22, { width: 18, align: 'center' })
  doc.restore()
}

function drawTriangleRuler(doc, x, y) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.2)
  doc.moveTo(x, y + 58).lineTo(x + 165, y + 45).lineTo(x + 122, y + 6).lineTo(x, y + 58).stroke()
  doc.moveTo(x + 20, y + 10).lineTo(x + 176, y + 62).stroke()
  doc.moveTo(x + 58, y + 62).lineTo(x + 142, y + 2).stroke()
  ;[['A', x + 172, y + 60], ['B', x - 8, y + 60], ['C', x + 120, y - 8], ['D', x + 107, y + 28], ['E', x + 146, y + 39], ['F', x + 61, y + 42]].forEach(([label, lx, ly]) => {
    doc.fontSize(8.5).text(label, lx, ly, { width: 12, lineBreak: false })
  })
  doc.restore()
}

function drawProofTriangle(doc, x, y) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.2)
  doc.moveTo(x, y + 48).lineTo(x + 150, y + 48).stroke()
  doc.moveTo(x + 45, y + 48).lineTo(x + 72, y + 3).lineTo(x + 140, y + 38).stroke()
  doc.moveTo(x + 92, y + 48).lineTo(x + 78, y + 86).lineTo(x + 8, y + 48).stroke()
  ;[['A', x - 10, y + 43], ['B', x + 145, y + 42], ['C', x + 74, y + 84], ['D', x + 70, y - 9], ['E', x + 42, y + 35], ['F', x + 88, y + 35]].forEach(([label, lx, ly]) => {
    doc.fontSize(8.5).text(label, lx, ly, { width: 12, lineBreak: false })
  })
  doc.restore()
}

function drawParallelAngles(doc, x, y) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.2)
  doc.moveTo(x, y + 25).lineTo(x + 190, y + 25).stroke()
  doc.moveTo(x + 8, y + 85).lineTo(x + 178, y + 85).stroke()
  doc.moveTo(x + 45, y).lineTo(x + 125, y + 108).stroke()
  doc.moveTo(x + 160, y + 5).lineTo(x + 65, y + 105).stroke()
  ;[['H', x - 8, y + 19], ['B', x + 72, y + 18], ['A', x + 132, y + 18], ['E', x + 190, y + 19], ['M', x - 7, y + 78], ['N', x + 67, y + 80], ['C', x + 102, y + 78], ['D', x + 178, y + 78], ['G', x + 38, y - 8], ['F', x + 159, y - 8]].forEach(([label, lx, ly]) => {
    doc.fontSize(8).text(label, lx, ly, { width: 12, lineBreak: false })
  })
  doc.restore()
}

function drawGridTriangle(doc, x, y, scale = 13) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(0.6)
  for (let i = 0; i <= 8; i += 1) {
    doc.moveTo(x + i * scale, y).lineTo(x + i * scale, y + 8 * scale).stroke()
    doc.moveTo(x, y + i * scale).lineTo(x + 8 * scale, y + i * scale).stroke()
  }
  doc.lineWidth(1.2)
  const a = [x + 3 * scale, y + 5 * scale]
  const b = [x + 6 * scale, y + 5 * scale]
  const c = [x + 2 * scale, y + 3 * scale]
  doc.moveTo(...a).lineTo(...b).lineTo(...c).lineTo(...a).stroke()
  ;[['A', a[0] - 8, a[1] + 2], ['B', b[0] + 3, b[1] - 2], ['C', c[0] - 8, c[1] - 12]].forEach(([label, lx, ly]) => {
    doc.fontSize(8).text(label, lx, ly, { width: 12, lineBreak: false })
  })
  doc.restore()
}

function drawTransportTable(doc, x, y) {
  const widths = [120, 85, 85]
  const heights = [20, 20, 20]
  const rows = [
    ['车型', 'A', 'B'],
    ['运载量（吨/辆）', '5', '8'],
    ['运费（元/辆）', '1000', '1200']
  ]
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(0.8)
  let yy = y
  for (let r = 0; r < rows.length; r += 1) {
    let xx = x
    for (let c = 0; c < rows[r].length; c += 1) {
      doc.rect(xx, yy, widths[c], heights[r]).stroke()
      doc.fontSize(9).text(rows[r][c], xx, yy + 5, { width: widths[c], align: 'center', lineBreak: false })
      xx += widths[c]
    }
    yy += heights[r]
  }
  doc.restore()
}

function drawFenceDiagram(doc, x, y) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.1)
  for (let i = 0; i < 12; i += 1) {
    const xx = x + i * 12
    doc.moveTo(xx, y).lineTo(xx + 18, y - 10).stroke()
  }
  doc.fontSize(10).text('围墙（大于100米）', x + 50, y - 26, { width: 130, align: 'center' })
  doc.moveTo(x + 30, y + 18).lineTo(x + 30, y + 98).lineTo(x + 210, y + 98).lineTo(x + 210, y + 18).stroke()
  doc.moveTo(x + 226, y + 18).lineTo(x + 226, y + 98).stroke()
  doc.moveTo(x + 220, y + 18).lineTo(x + 232, y + 18).stroke()
  doc.moveTo(x + 220, y + 98).lineTo(x + 232, y + 98).stroke()
  doc.fontSize(10).text('x 米', x + 235, y + 52, { width: 30, lineBreak: false })
  doc.restore()
}

function isMathSubject(subject = '') {
  return /数学|math/i.test(String(subject || ''))
}

function declaredDiagramLooksGeometric(q = {}, spec = null) {
  if (q.needsDiagram !== true && q.diagramSpecRequired !== true) return false
  const text = [q.subject, q.type, q.section, q.skill, q.question, q.questionLatex].join(' ')
  const geometricText = /椭圆|双曲线|抛物线|圆锥曲线|焦点|准线|圆|三角形|△|Rt△|中线|高线|垂线|角平分线|正方体|立方体|长方体|四面体|棱锥|棱柱|线面角|二面角|∠|F1|F2|A₁|B₁|C₁|D₁|A1|B1|C1|D1/.test(text)
  const plainFunction = /函数|二次函数|一次函数/.test(text) && !/椭圆|双曲线|抛物线|圆锥曲线|焦点|准线|正方体|三角形|△|∠/.test(text)
  if (plainFunction) return false
  return geometricText || ['solid_diagram', 'circle_geometry'].includes(String(spec?.type || '')) || Boolean(spec?.diagramType)
}

export function inferQuestionDiagramSpec(q = {}) {
  const existing = q.diagramSpec && typeof q.diagramSpec === 'object' && !Array.isArray(q.diagramSpec)
    ? q.diagramSpec
    : null
  const classification = classifyGeometryQuestion({
    ...q,
    needsDiagram: undefined,
    diagramSpecRequired: undefined
  })
  if (diagramSpecIsMeaningful(existing) && validateGeometryDiagramSpec(existing, q.number).valid) {
    return (classification.needsDiagram || declaredDiagramLooksGeometric(q, existing)) ? existing : null
  }

  const text = `${q.question || ''} ${q.questionLatex || ''}`
  const compact = text.replace(/\s+/g, '')
  const looksLikeSegmentRatio =
    /AB/i.test(compact) &&
    /CD\s*[:：]\s*DB/i.test(compact) &&
    /1\s*[:：]\s*2/.test(compact) &&
    /12/.test(compact)

  if (looksLikeSegmentRatio) {
    return {
      type: 'generic_geometry',
      points: { A: [0, 42], C: [120, 42], D: [160, 42], B: [240, 42] },
      segments: [['A', 'B']],
      labels: ['A', 'C', 'D', 'B'],
      equalMarks: [['A', 'C'], ['C', 'B']]
    }
  }

  if (existing && existing.type && existing.type !== 'none') {
    return classification.needsDiagram ? existing : null
  }
  return classification.needsDiagram ? existing : null
}

function writeExamDiagram(doc, q, opts = {}) {
  const number = Number(q.number)
  if (![3, 5, 22, 24, 25, 26, 27, 28].includes(number)) return
  const allowFallback = opts.allowFallback !== false
  const startY = doc.y + 4
  if (number === 3) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: EXAM_LEFT + 10,
      y: startY,
      width: 260
    })
    doc.fontSize(9).text('\uFF08\u7B2C 3 \u9898\uFF09', EXAM_LEFT + 105, startY + 58, { width: 80, align: 'center' })
    doc.y = startY + Math.max(result.height, 80)
  } else if (number === 5) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: 288,
      y: startY,
      scale: 0.92,
      height: 112
    })
    doc.fontSize(9).text('\uFF08\u7B2C 5 \u9898\uFF09', 360, startY + 96, { width: 80, align: 'center' })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 112))
  } else if (number === 22) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: 335,
      y: startY,
      scale: 1,
      height: 96
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 96))
  } else if (number === 24) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: 330,
      y: startY + 4,
      scale: 1,
      height: 122
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 122))
  } else if (number === 25) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: EXAM_LEFT + 10,
      y: startY,
      height: 154
    })
    doc.y = startY + Math.max(result.height, 154)
  } else if (number === 26) {
    drawTransportTable(doc, EXAM_LEFT + 18, startY + 4)
    doc.y = startY + 78
  } else if (number === 27) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: EXAM_LEFT,
      y: startY,
      height: 138
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 138))
  } else if (number === 28) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      allowFallback,
      x: 115,
      y: startY + 8,
      scale: 1.35,
      height: 174
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 174))
  }
}

function writeTableSpec(doc, tableSpec, opts = {}) {
  if (!tableSpec || typeof tableSpec !== 'object' || Array.isArray(tableSpec)) return false
  const headers = Array.isArray(tableSpec.headers) ? tableSpec.headers.map(item => plainMathText(item)) : []
  const rows = Array.isArray(tableSpec.rows) ? tableSpec.rows : []
  const normalizedRows = rows
    .map(row => (Array.isArray(row) ? row : Object.values(row || {})).map(item => plainMathText(item)))
    .filter(row => row.length)
  if (!headers.length && !normalizedRows.length) return false
  const allRows = headers.length ? [headers, ...normalizedRows] : normalizedRows
  const cols = Math.max(...allRows.map(row => row.length))
  if (!cols) return false
  ensureSpace(doc, 80)
  const x = opts.x || EXAM_LEFT
  const startY = doc.y + 5
  const maxWidth = opts.width || EXAM_WIDTH
  const cellWidth = maxWidth / cols
  const cellHeight = 22
  doc.save().strokeColor('#9AA3B2').lineWidth(0.8)
  allRows.slice(0, 8).forEach((row, rowIndex) => {
    row.slice(0, cols).forEach((cell, colIndex) => {
      const cx = x + colIndex * cellWidth
      const cy = startY + rowIndex * cellHeight
      doc.rect(cx, cy, cellWidth, cellHeight).stroke()
      doc.fontSize(rowIndex === 0 && headers.length ? 9.5 : 9).fillColor('#111111')
        .text(String(cell || ''), cx + 4, cy + 6, { width: cellWidth - 8, align: 'center', lineBreak: false })
    })
  })
  doc.restore()
  doc.y = startY + Math.min(allRows.length, 8) * cellHeight + 8
  return true
}

function writeQuestionDiagram(doc, q, opts = {}) {
  const diagramSpec = inferQuestionDiagramSpec(q)
  if (!diagramSpec) return false
  ensureSpace(doc, opts.height || 130)
  const result = renderGeometryDiagram(doc, diagramSpec, {
    questionNumber: q.number,
    allowFallback: opts.allowFallback === true,
    lockTemplates: opts.lockTemplates === true,
    x: opts.x || EXAM_LEFT + 12,
    y: doc.y + 5,
    width: opts.width || 260,
    height: opts.height || 118,
    scale: opts.scale || 1
  })
  if (!result.height) return false
  doc.y += Math.max(result.height, opts.height || 118) + 8
  return true
}

export function inferSolutionDiagramSpec(q = {}) {
  const explicit = q.solutionDiagramSpec && typeof q.solutionDiagramSpec === 'object' && !Array.isArray(q.solutionDiagramSpec)
    ? q.solutionDiagramSpec
    : null
  if (diagramSpecIsMeaningful(explicit) && validateGeometryDiagramSpec(explicit, q.number).valid) return explicit
  return inferQuestionDiagramSpec(q)
}

function writeSolutionDiagram(doc, q) {
  const diagramSpec = inferSolutionDiagramSpec(q)
  if (!diagramSpec) return false
  ensureSpace(doc, 138)
  setPdfFont(doc, 'bold')
  doc.fontSize(10.6).fillColor(COLORS.ink).text('\u89e3\u7b54\u56fe\uff1a', PRACTICE_LEFT + 22, doc.y, {
    width: 80,
    lineBreak: false
  })
  const startY = doc.y + 16
  const result = renderGeometryDiagram(doc, diagramSpec, {
    questionNumber: q.number,
    allowFallback: false,
    lockTemplates: false,
    x: PRACTICE_LEFT + 42,
    y: startY,
    width: Math.min(320, PRACTICE_WIDTH - 78),
    height: 116,
    scale: 1
  })
  if (!result.height) return false
  setPdfFont(doc)
  doc.y = startY + Math.max(result.height, 116) + 10
  return true
}

function writeExamPdf(doc, worksheet) {
  writeExamHeader(doc, worksheet)
  const allowMathFallbackDiagrams = isMathSubject(worksheet.subject)
  let currentSection = ''
  for (const q of worksheet.questions || []) {
    const section = q.section || q.type || ''
    if (section && section !== currentSection) {
      currentSection = section
      ensureSpace(doc, 70)
      doc.moveDown(0.2)
      doc.fontSize(11).fillColor('#111111').text(sectionTitle(section, q), EXAM_LEFT, doc.y, {
        width: EXAM_WIDTH,
        lineGap: 4
      })
      doc.moveDown(0.55)
    }
    const isChoice = isChoiceQuestion(q)
    const isBlank = isBlankQuestion(q)
    const geometry = classifyGeometryQuestion({ ...q, subject: q.subject || worksheet.subject })
    const hasDiagram = allowMathFallbackDiagrams && shouldUseQuestionNumberFallback(Number(q.number), geometry)
    ensureSpace(doc, hasDiagram ? 150 : (isChoice ? 62 : (isBlank ? 48 : 72)))
    writeQuestionText(doc, q, { size: 10.4, lineGap: 4 })
    if (hasDiagram) writeExamDiagram(doc, q, { allowFallback: allowMathFallbackDiagrams })
    if (!hasDiagram) writeQuestionDiagram(doc, { ...q, subject: q.subject || worksheet.subject }, { height: 98, width: 240 })
    writeTableSpec(doc, q.tableSpec)
    if (isChoice && q.options?.length) {
      writeOptionsGrid(doc, q.options)
    } else {
      doc.moveDown(isBlank ? 0.3 : 0.45)
    }
    doc.moveDown(isChoice ? 0.25 : 0.35)
    if (sectionBreakAfter(q.number) && q.number !== (worksheet.questions || []).length) doc.addPage()
  }
  writeExamFooters(doc)
}

function writeAnswerBlock(doc, q) {
  const hasSolutionDiagram = Boolean(inferSolutionDiagramSpec(q))
  ensureSpace(doc, hasSolutionDiagram ? 220 : 96)
  setPdfFont(doc, 'bold')
  doc.fontSize(11.5).fillColor(COLORS.ink)
    .text(`${q.number}. \u7b54\u6848\uff1a${plainMathText(withLatexText(q.answer || '\u7565', q.answerLatex))}`, PRACTICE_LEFT, doc.y, {
      width: PRACTICE_WIDTH,
      lineGap: 3
    })
  doc.moveDown(0.3)
  writeSolutionDiagram(doc, q)
  const steps = explanationStepsForQuestion(q)
  if (!steps.length) {
    setPdfFont(doc)
    doc.fontSize(10.5).fillColor(COLORS.muted).text('\u89e3\u6790\uff1a\u7565', PRACTICE_LEFT + 22, doc.y, {
      width: PRACTICE_WIDTH - 22,
      lineGap: 4
    })
    doc.moveDown(0.75)
    return
  }

  setPdfFont(doc, 'bold')
  doc.fontSize(10.8).fillColor(COLORS.ink).text('\u89e3\u6790\uff1a', PRACTICE_LEFT + 22, doc.y, {
    width: 60,
    lineBreak: false
  })
  doc.moveDown(0.25)
  setPdfFont(doc)
  steps.forEach((step, index) => {
    ensureSpace(doc, 30)
    const y = doc.y
    doc.fontSize(10.3).fillColor('#202938').text(`${index + 1}. ${plainMathText(step)}`, PRACTICE_LEFT + 34, y, {
      width: PRACTICE_WIDTH - 40,
      lineGap: 4
    })
    doc.y += 3
  })
  doc.moveDown(0.55)
}

function writePracticeHeader(doc, worksheet) {
  const title = sanitizeText(worksheet.title || 'AI 智能练习卷')
  const grade = sanitizeText(worksheet.grade || '')
  const subject = sanitizeText(worksheet.subject || '')
  const meta = [grade, subject, '学生练习版'].filter(Boolean).join(' · ')

  doc.y = 48
  setPdfFont(doc, 'bold')
  doc.fontSize(19).fillColor(COLORS.ink).text(title, PRACTICE_LEFT, doc.y, {
    align: 'center',
    width: PRACTICE_WIDTH,
    lineGap: 2
  })
  setPdfFont(doc)
  if (meta) {
    doc.moveDown(0.25)
    doc.fontSize(10).fillColor(COLORS.muted).text(meta, PRACTICE_LEFT, doc.y, {
      align: 'center',
      width: PRACTICE_WIDTH
    })
  }
  const metaY = Math.max(doc.y + 12, 88)
  doc.save().roundedRect(112, metaY, 370, 32, 6).fill(COLORS.paper).restore()
  doc.fillColor(COLORS.ink).fontSize(10.5)
  doc.text('班级：________', 132, metaY + 9, { width: 100, lineBreak: false })
  doc.text('姓名：________', 252, metaY + 9, { width: 100, lineBreak: false })
  doc.text('得分：________', 372, metaY + 9, { width: 100, lineBreak: false })
  doc.y = metaY + 46
  doc.moveTo(PRACTICE_LEFT, doc.y).lineTo(PRACTICE_RIGHT, doc.y).lineWidth(1).strokeColor(COLORS.hairline).stroke()
  doc.y += 16
}

function sectionHeadingLabel(section, q, index) {
  const raw = sanitizeText(section)
  if (/^[一二三四五六七八九十]+[、.．]/.test(raw)) return raw
  const prefix = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][index] || String(index + 1)
  if (q?.options?.length || /选择/.test(raw)) return `${prefix}、${raw || '选择题'}`
  if (/填空/.test(raw)) return `${prefix}、${raw}`
  if (/计算|解答|应用|证明|综合/.test(raw)) return `${prefix}、${raw}`
  return `${prefix}、${raw || '练习题'}`
}

function writePracticeSectionTitle(doc, section, q, index = 0) {
  ensureSpace(doc, 44)
  if (doc.y > 58) doc.y += 10
  const sectionY = doc.y
  const label = sectionHeadingLabel(section, q, index)
  setPdfFont(doc)
  doc.fontSize(12).fillColor('#111111').text(label, PRACTICE_LEFT, sectionY, {
    width: PRACTICE_WIDTH,
    lineGap: 2
  })
  setPdfFont(doc)
  doc.y = Math.max(doc.y, sectionY + 28)
}

function estimateTextHeight(doc, text, width, fontSize, lineGap = 4) {
  const oldSize = doc._fontSize
  doc.fontSize(fontSize)
  const height = doc.heightOfString(String(text || ''), { width, lineGap })
  doc.fontSize(oldSize)
  return height
}

function practiceOptionLayout(doc, options = []) {
  const items = options.slice(0, 4).map((option, index) => {
    const label = String.fromCharCode(65 + index)
    const text = String(option || '').replace(/^[A-D]\s*[.．、]?\s*/, '')
    return `${label}. ${sanitizeText(text)}`
  })
  if (!items.length) {
    return { items, colCount: 4, gap: 26, colWidth: PRACTICE_TEXT_WIDTH, rowHeights: [], height: 0 }
  }
  const longOption = items.some(item => item.length > 28)
  const colCount = longOption ? 2 : 4
  const gap = colCount === 4 ? 26 : 28
  const colWidth = (PRACTICE_TEXT_WIDTH - gap * (colCount - 1)) / colCount
  const rowHeights = []

  setPdfFont(doc)
  items.forEach((item, index) => {
    const row = Math.floor(index / colCount)
    const height = Math.max(22, estimateTextHeight(doc, item, colWidth, 10.2, 2) + 2)
    rowHeights[row] = Math.max(rowHeights[row] || 0, height)
  })
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height + 2, -2)
  return {
    items,
    colCount,
    gap,
    colWidth,
    rowHeights,
    height: 10 + Math.max(0, rowsHeight) + 10
  }
}

function estimatePracticeOptionsHeight(doc, options = []) {
  return practiceOptionLayout(doc, options).height
}

function writePracticeOptions(doc, options = []) {
  const layout = practiceOptionLayout(doc, options)
  if (!layout.items.length) return
  ensureSpace(doc, layout.height + 6)
  const { items, colCount, gap, colWidth, rowHeights } = layout
  const startY = doc.y + 10

  items.forEach((item, index) => {
    const col = index % colCount
    const row = Math.floor(index / colCount)
    const x = PRACTICE_TEXT_LEFT + col * (colWidth + gap)
    const y = startY + rowHeights.slice(0, row).reduce((sum, height) => sum + height + 5, 0)
    doc.fontSize(10.2).fillColor('#111111').text(item, x, y, {
      width: colWidth,
      lineGap: 2
    })
  })
  doc.y = startY + rowHeights.reduce((sum, height) => sum + height + 2, -2) + 10
}

function practiceAnswerSpaceHeight(q) {
  const text = `${q.type || ''} ${q.section || ''} ${q.question || ''}`
  if (hasAny(text, ['解答', '应用', '证明', '计算', '论证'])) return 104
  if (hasAny(text, ['填空'])) return 26
  return 54
}

function writePracticeBlank(doc, q) {
  setPdfFont(doc)
  doc.y += practiceAnswerSpaceHeight(q)
}

function estimatePracticeQuestionBlockHeight(doc, q, questionHeight) {
  const diagramHeight = inferQuestionDiagramSpec(q) ? 130 : 0
  const tableHeight = q.tableSpec ? 90 : 0
  const responseHeight = q.options?.length
    ? estimatePracticeOptionsHeight(doc, q.options) + 20
    : practiceAnswerSpaceHeight(q) + 14
  return Math.max(
    q.options?.length ? 74 : 82,
    questionHeight + 4 + diagramHeight + tableHeight + responseHeight
  )
}

function writePracticeQuestionLead(doc, q, questionY) {
  const number = `${q.number || ''}.`
  setPdfFont(doc)
  doc.fontSize(11).fillColor('#111111').text(number, PRACTICE_LEFT, questionY, {
    width: 24,
    align: 'left',
    lineBreak: false
  })
}

function writePracticeFooters(doc, worksheet, watermark) {
  const range = doc.bufferedPageRange()
  const grade = sanitizeText(worksheet.grade || '')
  const subject = sanitizeText(worksheet.subject || '')
  const label = `${grade} ${subject}`.trim() || sanitizeText(worksheet.title || '')
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i)
    setPdfFont(doc)
    doc.opacity(1)
    const page = i - range.start + 1
    doc.fontSize(8.8).fillColor('#111111').text(`${label} 第 ${page} 页（共 ${range.count} 页）`, PRACTICE_LEFT, 752, {
      width: PRACTICE_WIDTH,
      align: 'center',
      lineBreak: false
    })
    if (watermark) {
      doc.fontSize(7.5).fillColor('#8A94A6').text('\u0041\u0049\u51fa\u9898\u5c0f\u52a9\u624b', PRACTICE_RIGHT - 90, 752, {
      width: 90,
      align: 'right',
      lineBreak: false
      })
    }
  }
}

function writePracticePdf(doc, worksheet, shouldIncludeAnswers, watermark) {
  writePracticeHeader(doc, worksheet)

  let currentSection = ''
  let sectionIndex = 0
  for (const q of worksheet.questions || []) {
    const renderQuestion = { ...q, subject: q.subject || worksheet.subject }
    const questionText = sanitizeText(withLatexText(q.question, q.questionLatex))
    const questionHeight = estimateTextHeight(doc, questionText, PRACTICE_TEXT_WIDTH, 11, 3)
    const questionMinHeight = estimatePracticeQuestionBlockHeight(doc, renderQuestion, questionHeight)
    if (q.section && q.section !== currentSection) {
      currentSection = q.section
      ensureSpace(doc, 48 + questionMinHeight)
      writePracticeSectionTitle(doc, currentSection, q, sectionIndex)
      sectionIndex += 1
    }
    ensureSpace(doc, questionMinHeight)
    const questionY = doc.y
    writePracticeQuestionLead(doc, q, questionY)
    setPdfFont(doc)
    doc.fontSize(11).fillColor('#111111').text(questionText, PRACTICE_TEXT_LEFT, questionY, {
      width: PRACTICE_TEXT_WIDTH,
      lineGap: 3
    })
    doc.y = Math.max(doc.y, questionY + questionHeight) + 2
    writeQuestionDiagram(doc, renderQuestion, { x: PRACTICE_TEXT_LEFT, height: 120, width: 300 })
    writeTableSpec(doc, q.tableSpec, { x: PRACTICE_TEXT_LEFT, width: PRACTICE_TEXT_WIDTH })
    if (q.options?.length) {
      writePracticeOptions(doc, q.options)
    } else {
      writePracticeBlank(doc, q)
    }
    doc.y += q.options?.length ? 20 : 14
  }

  if (shouldIncludeAnswers && (worksheet.questions || []).length) {
    doc.addPage()
    doc.y = 56
    setPdfFont(doc, 'bold')
    doc.fontSize(19).fillColor(COLORS.ink).text('\u7b54\u6848\u4e0e\u89e3\u6790', PRACTICE_LEFT, doc.y, {
      align: 'center',
      width: PRACTICE_WIDTH
    })
    doc.moveTo(PRACTICE_LEFT, doc.y + 12).lineTo(PRACTICE_RIGHT, doc.y + 12).lineWidth(1).strokeColor(COLORS.line).stroke()
    setPdfFont(doc)
    doc.y += 30
    for (const q of worksheet.questions || []) writeAnswerBlock(doc, q)
  }
  if (watermark) writeWatermarks(doc)
  writePracticeFooters(doc, worksheet, watermark)
}

export function buildPdf({ worksheet, outputPath, watermark = true, includeAnswers }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true })
    const isExam = worksheet.mode === 'exam_simulation'
    doc.info.Title = String(worksheet.examMeta?.title || worksheet.title || 'AI 智能练习卷').trim()
    doc.info.Keywords = watermark && !isExam ? 'printer-sheet-free-watermark' : 'printer-sheet-clean'
    doc.info.Subject = isExam ? 'exam-simulation-student-paper' : (watermark ? 'free-watermark-tiles-per-page=6' : 'clean-pdf')
    const stream = fs.createWriteStream(outputPath)
    stream.on('finish', resolve)
    stream.on('error', reject)
    doc.pipe(stream)
    const fontPath = findFont()
    const boldFontPath = findBoldFont()
    doc._printerSheetFonts = {
      normal: !!fontPath,
      bold: !!(boldFontPath || fontPath)
    }
    if (fontPath) doc.registerFont('paper-normal', fontPath)
    if (boldFontPath || fontPath) doc.registerFont('paper-bold', boldFontPath || fontPath)
    setPdfFont(doc)

    const shouldIncludeAnswers = includeAnswers ?? !isExam
    if (isExam) {
      writeExamPdf(doc, worksheet)
      if (shouldIncludeAnswers && (worksheet.questions || []).length) {
        doc.addPage()
        doc.fontSize(18).text('答案与解析', { align: 'center' })
        doc.moveDown(1)
        for (const q of worksheet.questions || []) writeAnswerBlock(doc, q)
      }
      doc.end()
      return
    }

    writePracticePdf(doc, worksheet, shouldIncludeAnswers, watermark)
    doc.end()
  })
}
