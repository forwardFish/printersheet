import fs from 'fs'
import PDFDocument from 'pdfkit'
import { renderGeometryDiagram } from './geometryRenderer.js'
import { explanationStepsForQuestion, splitMathParts, toDisplayMath } from './mathFormat.js'

const PAGE_BOTTOM = 735
const EXAM_LEFT = 76
const EXAM_RIGHT = 520
const EXAM_WIDTH = EXAM_RIGHT - EXAM_LEFT

function findFont() {
  const candidates = [
    process.env.PDF_FONT_PATH,
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/NotoSansSC-VF.ttf',
    'C:/Windows/Fonts/Noto Sans SC (TrueType).otf',
    'C:/Windows/Fonts/Deng.ttf',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/msyhbd.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
    '/System/Library/Fonts/PingFang.ttc'
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p))
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
    .replace(/\u00F7/g, '/')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾]+/g, value => `^${Array.from(value).map(char => String(PDF_UNICODE_FALLBACKS[char] || '').replace(/^\^/, '')).join('')}`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ℃]/g, char => PDF_UNICODE_FALLBACKS[char] || '')
    .replace(/□/g, '')
    .replace(/\s+/g, ' ')
}

function plainMathText(text = '') {
  return pdfSafeText(splitMathParts(text).map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text).join(''))
}

function withLatexText(text = '', latex = '') {
  const base = String(text || '').trim()
  const formula = plainMathText(latex || '')
  if (!formula) return base
  const compactBase = plainMathText(base).replace(/\s+/g, '')
  const compactFormula = formula.replace(/\s+/g, '')
  return compactBase.includes(compactFormula) ? base : `${base} ${formula}`
}

function sanitizeText(text = '') {
  return plainMathText(text)
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
      doc.fontSize(28).fillColor('#766DFF').opacity(0.22)
        .text('AI出题小助手 免费版水印', x - 190, y - 18, { align: 'center', width: 380, lineBreak: false })
      doc.restore()
    }
    doc.opacity(1).fontSize(10).fillColor('#5F6068')
      .text('由 AI出题小助手 生成 · 免费版 PDF 带水印', 52, 744, { align: 'center', width: 490, lineBreak: false })
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

function writeExamDiagram(doc, q) {
  const number = Number(q.number)
  if (![3, 5, 22, 24, 25, 26, 27, 28].includes(number)) return
  const startY = doc.y + 4
  if (number === 3) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      x: EXAM_LEFT + 10,
      y: startY,
      width: 260
    })
    doc.fontSize(9).text('\uFF08\u7B2C 3 \u9898\uFF09', EXAM_LEFT + 105, startY + 58, { width: 80, align: 'center' })
    doc.y = startY + Math.max(result.height, 80)
  } else if (number === 5) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
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
      x: 335,
      y: startY,
      scale: 1,
      height: 96
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 96))
  } else if (number === 24) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
      x: 330,
      y: startY + 4,
      scale: 1,
      height: 122
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 122))
  } else if (number === 25) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
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
      x: EXAM_LEFT,
      y: startY,
      height: 138
    })
    doc.y = Math.max(doc.y, startY + Math.max(result.height, 138))
  } else if (number === 28) {
    const result = renderGeometryDiagram(doc, q.diagramSpec, {
      questionNumber: number,
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
  if (!q.diagramSpec) return false
  ensureSpace(doc, opts.height || 130)
  const result = renderGeometryDiagram(doc, q.diagramSpec, {
    questionNumber: q.number,
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

function writeExamPdf(doc, worksheet) {
  writeExamHeader(doc, worksheet)
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
    const hasDiagram = [3, 5, 22, 24, 25, 26, 27, 28].includes(Number(q.number))
    ensureSpace(doc, hasDiagram ? 150 : (isChoice ? 62 : (isBlank ? 48 : 72)))
    writeQuestionText(doc, q, { size: 10.4, lineGap: 4 })
    writeExamDiagram(doc, q)
    if (!hasDiagram) writeQuestionDiagram(doc, q, { height: 98, width: 240 })
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
  ensureSpace(doc, 110)
  doc.fontSize(13).fillColor('#111111')
    .text(`${q.number}. 答案：${plainMathText(withLatexText(q.answer || '略', q.answerLatex))}`, { lineGap: 4 })
  const steps = explanationStepsForQuestion(q)
  if (!steps.length) {
    doc.fontSize(11.2).fillColor('#222222').text('解析：略', { lineGap: 4 })
    doc.moveDown(0.55)
    return
  }
  doc.moveDown(0.15)
  doc.fontSize(11.5).fillColor('#111111').text('解析：', { lineGap: 3 })
  for (const step of steps) {
    ensureSpace(doc, 34)
    doc.fontSize(11.2).fillColor('#222222').text(plainMathText(step), { indent: 12, width: 470, lineGap: 5 })
  }
  doc.moveDown(0.45)
}

function writePracticePdf(doc, worksheet, shouldIncludeAnswers, watermark) {
  const title = worksheet.title || 'AI 智能练习卷'
  doc.fontSize(21).fillColor('#111111').text(title, { align: 'center' })
  doc.moveDown(1)
  doc.fontSize(11).fillColor('#333333').text('班级：________    姓名：________    得分：________', { align: 'center' })
  doc.moveDown(1.2)

  let currentSection = ''
  for (const q of worksheet.questions || []) {
    ensureSpace(doc, q.options?.length ? 126 : 108)
    if (q.section && q.section !== currentSection) {
      currentSection = q.section
      ensureSpace(doc, 120)
      doc.moveDown(0.4).fontSize(13).fillColor('#111111').text(currentSection)
      doc.moveDown(0.3)
    }
    writeQuestionText(doc, q, { size: 12, lineGap: 4, width: 470 })
    writeQuestionDiagram(doc, q, { x: 72, height: 120, width: 300 })
    writeTableSpec(doc, q.tableSpec, { x: 72, width: 430 })
    if (q.options?.length) {
      doc.moveDown(0.25).fontSize(11).text(q.options.join('        '), { lineGap: 4 })
    } else {
      doc.moveDown(0.2).text('答：__________________________________________________')
    }
    doc.moveDown(0.7)
  }

  if (shouldIncludeAnswers && (worksheet.questions || []).length) {
    doc.addPage()
    doc.fontSize(18).text('答案与解析', { align: 'center' })
    doc.moveDown(1)
    for (const q of worksheet.questions || []) writeAnswerBlock(doc, q)
  }
  if (watermark) writeWatermarks(doc)
}

export function buildPdf({ worksheet, outputPath, watermark = true, includeAnswers }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true })
    const isExam = worksheet.mode === 'exam_simulation'
    doc.info.Keywords = watermark && !isExam ? 'printer-sheet-free-watermark' : 'printer-sheet-clean'
    doc.info.Subject = isExam ? 'exam-simulation-student-paper' : (watermark ? 'free-watermark-tiles-per-page=6' : 'clean-pdf')
    const stream = fs.createWriteStream(outputPath)
    stream.on('finish', resolve)
    stream.on('error', reject)
    doc.pipe(stream)
    const fontPath = findFont()
    if (fontPath) doc.font(fontPath)

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
