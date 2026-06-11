import fs from 'fs/promises'
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType
} from 'docx'
import { explanationStepsForQuestion, splitMathParts, toDisplayChemistry, toDisplayMath } from './mathFormat.js'
import { inferQuestionDiagramSpec, inferSolutionDiagramSpec } from './buildPdf.js'
import { normalizeGeometryDiagramSpec } from './geometryRenderer.js'

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

const COLORS = {
  ink: '111827',
  muted: '4B5563',
  line: 'D0D5DD',
  section: '1F2937',
  answer: '166534',
  tableFill: 'F3F4F6'
}

const FONT_BODY = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' }
const FONT_HEADING = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'SimHei' }
const FONT_MATH = { ascii: 'Cambria Math', hAnsi: 'Cambria Math', eastAsia: 'SimSun' }

const PAGE = {
  width: 11906,
  height: 16838,
  marginTop: 1134,
  marginRight: 1440,
  marginBottom: 1134,
  marginLeft: 1440,
  contentWidth: 9026
}

const BODY_INDENT = 720
const BODY_RIGHT_INDENT = 720
const OPTION_TABLE_WIDTH = 7200
const DATA_TABLE_WIDTH = 7200

function textRun(text, opts = {}) {
  return new TextRun({
    text: String(text || ''),
    bold: !!opts.bold,
    size: opts.size || 22,
    font: opts.font || (opts.math ? FONT_MATH : FONT_BODY),
    color: opts.color || COLORS.ink,
    noProof: true
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    heading: opts.heading,
    style: opts.style,
    pageBreakBefore: !!opts.pageBreakBefore,
    keepNext: opts.keepNext,
    border: opts.border,
    indent: opts.indent,
    spacing: { after: opts.after ?? 160 },
    children: [textRun(text, {
      bold: !!opts.bold,
      size: opts.size || 24,
      font: opts.font || FONT_BODY,
      color: opts.color || COLORS.ink
    })]
  })
}

function displayMathText(text = '') {
  return splitMathParts(toDisplayChemistry(text))
    .map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text)
    .join('')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*([≤≥≠<>])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function runsFromMathParts(text, opts = {}) {
  return splitMathParts(toDisplayChemistry(text)).map(part => textRun(
    part.type === 'math' ? toDisplayMath(part.text) : part.text,
    {
      bold: !!opts.bold || (part.type === 'math' && !!opts.mathBold),
      size: opts.size || 22,
      math: part.type === 'math',
      color: opts.color || COLORS.ink
    }
  ))
}

function coverageTokens(text = '') {
  return String(text || '').match(/[A-Za-zα-ωΑ-Ω]+|[0-9]+|[₀-₉]+|[⁰¹²³⁴⁵⁶⁷⁸⁹]+|[+\-*/=<>≤≥≠∠△∥⊥∞∪∩]/g) || []
}

function formulaAlreadyInBase(base, formula) {
  const compactBase = displayMathText(base).replace(/\s+/g, '')
  const compactFormula = formula.replace(/\s+/g, '')
  if (!compactFormula || compactBase.includes(compactFormula)) return true
  const tokens = coverageTokens(compactFormula).filter(token => token.length > 1 || /[0-9+\-*/=<>≤≥≠]/.test(token))
  if (tokens.length < 3) return false
  const hits = tokens.filter(token => compactBase.includes(token)).length
  return hits / tokens.length >= 0.7
}

function noBorder() {
  return {
    style: BorderStyle.NIL,
    size: 0,
    color: 'FFFFFF'
  }
}

function tableBorders(color = 'CBD5E1') {
  const line = { style: BorderStyle.SINGLE, size: 4, color }
  return {
    top: line,
    bottom: line,
    left: line,
    right: line,
    insideHorizontal: line,
    insideVertical: line
  }
}

function paragraphStyles() {
  return {
    default: {
      document: {
        run: { font: FONT_BODY, size: 22, color: COLORS.ink, noProof: true },
        paragraph: { spacing: { after: 80, line: 330 } }
      },
      heading1: {
        run: { font: FONT_HEADING, size: 30, bold: true, color: COLORS.ink, noProof: true },
        paragraph: { spacing: { before: 120, after: 160 } }
      }
    },
    paragraphStyles: [
      {
        id: 'PaperTitle',
        name: 'Paper Title',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: FONT_HEADING, size: 36, bold: true, color: COLORS.ink, noProof: true },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 220, line: 360 } }
      },
      {
        id: 'MetaLine',
        name: 'Paper Metadata Line',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { font: FONT_BODY, size: 22, color: COLORS.ink, noProof: true },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 320, line: 300 } }
      },
      {
        id: 'SectionHeading',
        name: 'Question Section Heading',
        basedOn: 'Normal',
        next: 'QuestionText',
        quickFormat: true,
        run: { font: FONT_HEADING, size: 26, bold: true, color: COLORS.section, noProof: true },
        paragraph: {
          spacing: { before: 120, after: 100, line: 320 },
          indent: { left: BODY_INDENT, right: BODY_RIGHT_INDENT }
        }
      },
      {
        id: 'QuestionText',
        name: 'Question Text',
        basedOn: 'Normal',
        next: 'OptionText',
        quickFormat: true,
        run: { font: FONT_BODY, size: 23, color: COLORS.ink, noProof: true },
        paragraph: { spacing: { after: 80, line: 330 }, indent: { left: BODY_INDENT, right: BODY_RIGHT_INDENT, hanging: 360 } }
      },
      {
        id: 'OptionText',
        name: 'Option Text',
        basedOn: 'Normal',
        next: 'QuestionText',
        quickFormat: true,
        run: { font: FONT_BODY, size: 22, color: COLORS.ink, noProof: true },
        paragraph: { spacing: { after: 0, line: 300 } }
      },
      {
        id: 'AnswerLine',
        name: 'Answer Line',
        basedOn: 'Normal',
        next: 'AnswerLine',
        quickFormat: true,
        run: { font: FONT_BODY, size: 20, color: COLORS.ink, noProof: true },
        paragraph: {
          spacing: { before: 0, after: 140, line: 260 },
          indent: { left: BODY_INDENT, right: BODY_RIGHT_INDENT },
          border: { bottom: { style: BorderStyle.SINGLE, color: COLORS.line, size: 4, space: 1 } }
        }
      }
    ]
  }
}

function sectionProperties() {
  return {
    page: {
      size: { width: PAGE.width, height: PAGE.height, orientation: PageOrientation.PORTRAIT },
      margin: {
        top: PAGE.marginTop,
        right: PAGE.marginRight,
        bottom: PAGE.marginBottom,
        left: PAGE.marginLeft,
        header: 720,
        footer: 720
      }
    }
  }
}

function optionCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: {
      top: noBorder(),
      bottom: noBorder(),
      left: noBorder(),
      right: noBorder()
    },
    children: [new Paragraph({
      style: 'OptionText',
      children: runsFromMathParts(text, { size: 22 })
    })]
  })
}

function optionLabel(index) {
  return String.fromCharCode(65 + index)
}

function normalizeOptionText(text, index) {
  const value = String(text || '').trim()
  if (!value) return ''
  return /^[A-D][.．、\s]/i.test(value) ? value : `${optionLabel(index)}. ${value}`
}

function optionTable(options = []) {
  const values = options.map((item, index) => normalizeOptionText(item, index)).filter(Boolean)
  if (!values.length) return null
  const longest = Math.max(...values.map(item => item.length))
  const columns = values.length >= 4 && longest <= 18 ? 4 : 2
  const width = Math.min(OPTION_TABLE_WIDTH, PAGE.contentWidth - BODY_INDENT - BODY_RIGHT_INDENT)
  const columnWidth = Math.floor(width / columns)
  const rows = []
  for (let index = 0; index < values.length; index += columns) {
    const chunk = values.slice(index, index + columns)
    while (chunk.length < columns) chunk.push('')
    rows.push(new TableRow({
      cantSplit: true,
      children: chunk.map(item => optionCell(item, columnWidth))
    }))
  }
  return new Table({
    rows,
    width: { size: width, type: WidthType.DXA },
    columnWidths: Array.from({ length: columns }, () => columnWidth),
    indent: { size: BODY_INDENT, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: {
      top: noBorder(),
      bottom: noBorder(),
      left: noBorder(),
      right: noBorder(),
      insideHorizontal: noBorder(),
      insideVertical: noBorder()
    }
  })
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
  const formula = displayMathText(latex || '')
  if (!formula) return base
  return formulaAlreadyInBase(base, formula) ? base : `${base} ${formula}`
}

function mathParagraph(prefix, text, opts = {}) {
  return new Paragraph({
    style: opts.style || 'QuestionText',
    spacing: { after: opts.after ?? 80, line: opts.line ?? 330 },
    indent: opts.indent,
    keepNext: opts.keepNext,
    children: [
      textRun(prefix, {
        bold: !!opts.prefixBold,
        size: opts.size || 23,
        font: opts.prefixFont || FONT_BODY,
        color: opts.color || COLORS.ink
      }),
      ...runsFromMathParts(text, opts)
    ]
  })
}

function mathTextParagraph(text, opts = {}) {
  return new Paragraph({
    style: opts.style,
    spacing: { after: opts.after ?? 120, line: opts.line ?? 320 },
    indent: opts.indent,
    children: runsFromMathParts(text, opts)
  })
}

function answerParagraph(q) {
  return new Paragraph({
    spacing: { after: 80, line: 320 },
    indent: { left: 120, hanging: 120 },
    children: [
      textRun(`${q.number}. 答案：`, { bold: true, size: 22, font: FONT_HEADING, color: COLORS.answer }),
      ...runsFromMathParts(withLatexText(q.answer || '略', q.answerLatex), { size: 22, color: COLORS.ink })
    ]
  })
}

function explanationParagraphs(q) {
  const steps = explanationStepsForQuestion(q)
  const paragraphs = [
    p('解析：', { bold: true, size: 22, after: 60, font: FONT_HEADING })
  ]
  for (const step of steps.length ? steps : ['略']) {
    paragraphs.push(new Paragraph({
      spacing: { after: 70, line: 300 },
      indent: { left: 360 },
      children: runsFromMathParts(step, { size: 21, color: COLORS.muted })
    }))
  }
  return paragraphs
}

function tableCell(text, width, isHeader = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: isHeader ? { fill: COLORS.tableFill } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { after: 0, line: 300 },
      alignment: isHeader ? AlignmentType.CENTER : undefined,
      children: runsFromMathParts(text, { size: 20, bold: isHeader })
    })]
  })
}

function tableParagraphs(tableSpec) {
  if (!tableSpec || typeof tableSpec !== 'object' || Array.isArray(tableSpec)) return []
  const headers = Array.isArray(tableSpec.headers) ? tableSpec.headers : []
  const rows = Array.isArray(tableSpec.rows) ? tableSpec.rows : []
  const normalizedRows = rows
    .map(row => Array.isArray(row) ? row : Object.values(row || {}))
    .filter(row => row.length)
  const colCount = Math.max(headers.length, ...normalizedRows.map(row => row.length), 0)
  if (!colCount) return []
  const width = Math.min(DATA_TABLE_WIDTH, PAGE.contentWidth - BODY_INDENT - BODY_RIGHT_INDENT)
  const colWidth = Math.floor(width / colCount)
  const tableRows = []
  if (headers.length) {
    tableRows.push(new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: Array.from({ length: colCount }, (_, index) => tableCell(headers[index] || '', colWidth, true))
    }))
  }
  for (const row of normalizedRows) {
    tableRows.push(new TableRow({
      cantSplit: true,
      children: Array.from({ length: colCount }, (_, index) => tableCell(row[index] || '', colWidth))
    }))
  }
  return [new Table({
    rows: tableRows,
    width: { size: width, type: WidthType.DXA },
    columnWidths: Array.from({ length: colCount }, () => colWidth),
    indent: { size: BODY_INDENT, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: tableBorders()
  }), p('', { after: 80 })]
}

function practiceAnswerSpaceParagraphs(q) {
  const text = `${q.type || ''} ${q.section || ''} ${q.question || ''}`
  const count = /解答|应用|证明|计算|论证/.test(text) ? 4 : (/填空/.test(text) ? 1 : 2)
  return Array.from({ length: count }, () => new Paragraph({
    style: 'AnswerLine',
    children: [textRun(' ', { size: 20 })]
  }))
}

function xmlEscape(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function segmentPair(value) {
  if (Array.isArray(value) && value.length === 2) return value.map(String)
  if (typeof value === 'string') {
    const match = value.trim().match(/^([A-Za-z][A-Za-z0-9]?)([A-Za-z][A-Za-z0-9]?)$/)
    return match ? [match[1], match[2]] : null
  }
  if (value && typeof value === 'object') {
    if (value.start && value.end) return [String(value.start), String(value.end)]
    if (value.from && value.to) return [String(value.from), String(value.to)]
    if (Array.isArray(value.segment)) return value.segment.map(String).slice(0, 2)
    if (typeof value.segment === 'string') return segmentPair(value.segment)
  }
  return null
}

function templateSpecForSvg(spec = {}) {
  const templates = {
    triangle_ruler_overlap_angle: {
      points: { B: [10, 92], A: [236, 86], C: [158, 12], D: [118, 76], E: [207, 73], F: [160, 31] },
      segments: [['B', 'A'], ['A', 'C'], ['C', 'B'], ['D', 'E'], ['D', 'F'], ['F', 'E'], ['B', 'D'], ['A', 'E']],
      labels: ['A', 'B', 'C', 'D', 'E', 'F']
    },
    congruent_triangles_on_line: {
      points: { A: [0, 48], E: [45, 48], F: [92, 48], B: [150, 48], D: [72, 3], C: [78, 86] },
      segments: [['A', 'B'], ['D', 'E'], ['D', 'B'], ['C', 'F'], ['C', 'A']],
      labels: ['A', 'B', 'C', 'D', 'E', 'F']
    },
    parallel_lines_transversal: {
      points: { H: [0, 25], B: [75, 25], A: [135, 25], E: [190, 25], M: [8, 85], N: [76, 85], C: [110, 85], D: [178, 85], G: [45, 0], F: [160, 5] },
      segments: [['H', 'E'], ['M', 'D'], ['G', 'C'], ['F', 'N']],
      labels: ['H', 'B', 'A', 'E', 'M', 'N', 'C', 'D', 'G', 'F']
    },
    grid_triangle_construction: {
      points: { A: [3, 5], B: [6, 5], C: [2, 3] },
      segments: [['A', 'B'], ['B', 'C'], ['C', 'A']],
      labels: ['A', 'B', 'C']
    },
    angle_bisector_rays: {
      points: { O: [70, 112], A: [255, 112], E: [210, 61], C: [190, 10], D: [92, 4], B: [8, 2] },
      segments: [['O', 'A'], ['O', 'B'], ['O', 'C'], ['O', 'D'], ['O', 'E']],
      labels: ['O', 'A', 'B', 'C', 'D', 'E']
    }
  }
  const resolved = templates[String(spec.templateId || '')]
  return resolved ? { ...spec, ...resolved, type: 'generic_geometry' } : spec
}

function renderNumberLineSvg(spec = {}, width = 340, height = 82) {
  const min = Number(spec.axis?.min ?? -4)
  const max = Number(spec.axis?.max ?? 4)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null
  const left = 26
  const right = width - 26
  const y = 38
  const toX = value => left + ((Number(value) - min) / (max - min)) * (right - left)
  const parts = [`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#111" stroke-width="1.4"/>`]
  for (let value = Math.ceil(min); value <= Math.floor(max); value += 1) {
    const x = toX(value)
    parts.push(`<line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}" stroke="#111" stroke-width="1"/>`)
    parts.push(`<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="11">${value}</text>`)
  }
  for (const [label, rawValue] of Object.entries(spec.points || {})) {
    const x = toX(rawValue)
    parts.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="#111"/>`)
    parts.push(`<text x="${x}" y="${y - 14}" text-anchor="middle" font-size="12" font-weight="700">${xmlEscape(label)}</text>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

function normalizedPointMap(points = {}, width = 340, height = 150) {
  const entries = Object.entries(points || {})
    .map(([name, value]) => {
      const coords = Array.isArray(value)
        ? value
        : (value && typeof value === 'object' ? [value.x, value.y] : [])
      return { name, x: Number(coords[0]), y: Number(coords[1]) }
    })
    .filter(item => Number.isFinite(item.x) && Number.isFinite(item.y))
  if (!entries.length) return {}
  const minX = Math.min(...entries.map(item => item.x))
  const maxX = Math.max(...entries.map(item => item.x))
  const minY = Math.min(...entries.map(item => item.y))
  const maxY = Math.max(...entries.map(item => item.y))
  const rangeX = Math.max(1, maxX - minX)
  const rangeY = Math.max(1, maxY - minY)
  const pad = 22
  return Object.fromEntries(entries.map(item => [
    item.name,
    {
      x: pad + ((item.x - minX) / rangeX) * (width - pad * 2),
      y: pad + ((item.y - minY) / rangeY) * (height - pad * 2)
    }
  ]))
}

function compactEquation(spec = {}) {
  return String(spec.equation || '').replace(/\s+/g, '').toLowerCase()
}

function equationAxis(equation, axis) {
  const match = equation.match(new RegExp(`${axis}\\\\^2/([0-9.]+)`, 'i'))
  return match ? Math.sqrt(Number(match[1])) : 0
}

function equationParabolaP(equation) {
  const match = equation.match(/y\^2=([0-9.]+)\*?x/i) || equation.match(/x\^2=([0-9.]+)\*?y/i)
  return match ? Number(match[1]) / 4 : 1
}

function pointNamesFromSpec(spec = {}) {
  const names = new Set()
  if (Array.isArray(spec.points)) {
    spec.points.forEach(item => {
      if (typeof item === 'string') names.add(item)
      else if (item && typeof item === 'object') names.add(String(item.name || item.label || item.id || item.point || '').trim())
    })
  }
  if (Array.isArray(spec.labels)) {
    spec.labels.forEach(item => {
      if (typeof item === 'string') names.add(item)
      else if (item && typeof item === 'object') names.add(String(item.point || item.name || item.id || item.label || '').trim())
    })
  }
  ;(Array.isArray(spec.segments) ? spec.segments : []).map(segmentPair).filter(Boolean).forEach(pair => pair.forEach(name => names.add(name)))
  ;(Array.isArray(spec.angleLabels) ? spec.angleLabels : []).forEach(item => {
    const point = String(item?.point || item?.vertex || '').trim()
    if (point) names.add(point)
  })
  ;(Array.isArray(spec.lengthLabels) ? spec.lengthLabels : []).forEach(item => {
    const pair = segmentPair(item.segment || [item.from, item.to])
    if (pair) pair.forEach(name => names.add(name))
  })
  return [...names].filter(Boolean)
}

function analyticPointsForSvg(spec = {}) {
  const explicit = normalizedPointMap(spec.points, 340, 150)
  if (Object.keys(explicit).length) return explicit
  const equation = compactEquation(spec)
  const kind = String(spec.curveKind || spec.kind || '').toLowerCase()
  const a = Number(spec.axes?.a || spec.parameters?.a || equationAxis(equation, 'x') || (kind.includes('parabola') ? 1 : 3))
  const b = Number(spec.axes?.b || spec.parameters?.b || equationAxis(equation, 'y') || 2)
  const p = Number(spec.parameters?.p || spec.focusParameter || equationParabolaP(equation) || 1)
  const c = Math.sqrt(Math.max(a * a - b * b, 0))
  const defaults = kind.includes('parabola') || equation.includes('y^2=')
    ? { O: [0, 0], F: [p, 0], A: [2 * p, 2.8 * p], B: [2 * p, -2.8 * p], P: [2 * p, 2 * p] }
    : { O: [0, 0], F1: [-c, 0], F2: [c, 0], P: [a * 0.6, b * 0.8], F: [c, 0], A: [-a, 0], B: [a, 0] }
  const raw = Object.fromEntries(pointNamesFromSpec(spec).filter(name => defaults[name]).map(name => [name, defaults[name]]))
  return normalizedPointMap(raw, 340, 150)
}

function renderAnalyticSvg(spec = {}, width = 340, height = 150) {
  const equation = compactEquation(spec)
  const kind = String(spec.curveKind || spec.kind || '').toLowerCase()
  const isParabola = kind.includes('parabola') || equation.includes('y^2=') || equation.includes('x^2=')
  const points = analyticPointsForSvg(spec)
  const parts = [
    `<rect width="100%" height="100%" fill="#fff"/>`,
    `<line x1="24" y1="${height / 2}" x2="${width - 18}" y2="${height / 2}" stroke="#111" stroke-width="1.4"/>`,
    `<line x1="${width / 2}" y1="${height - 16}" x2="${width / 2}" y2="18" stroke="#111" stroke-width="1.2"/>`,
    `<text x="${width - 20}" y="${height / 2 + 18}" font-size="12">x</text>`,
    `<text x="${width / 2 + 8}" y="22" font-size="12">y</text>`
  ]
  if (isParabola) {
    const d = `M ${width / 2 - 18} ${height - 20} Q ${width / 2 + 10} ${height / 2} ${width / 2 - 18} 20`
    parts.push(`<path d="${d}" fill="none" stroke="#111" stroke-width="1.8"/>`)
    parts.push(`<line x1="${width / 2 - 34}" y1="20" x2="${width / 2 - 34}" y2="${height - 20}" stroke="#111" stroke-width="1.1" stroke-dasharray="5 4"/>`)
  } else {
    parts.push(`<ellipse cx="${width / 2}" cy="${height / 2}" rx="58" ry="36" fill="none" stroke="#111" stroke-width="1.8"/>`)
  }
  ;(Array.isArray(spec.segments) ? spec.segments : []).map(segmentPair).filter(Boolean).forEach(([a, b]) => {
    if (!points[a] || !points[b]) return
    parts.push(`<line x1="${points[a].x}" y1="${points[a].y}" x2="${points[b].x}" y2="${points[b].y}" stroke="#111" stroke-width="1.5"/>`)
  })
  ;(Array.isArray(spec.lengthLabels) ? spec.lengthLabels : []).forEach(item => {
    const pair = segmentPair(item.segment || [item.from, item.to])
    const label = String(item.label || item.value || item.text || '').trim()
    if (!pair || !label || !points[pair[0]] || !points[pair[1]]) return
    const x = (points[pair[0]].x + points[pair[1]].x) / 2
    const y = (points[pair[0]].y + points[pair[1]].y) / 2
    parts.push(`<text x="${x}" y="${y + 14}" text-anchor="middle" font-size="12">${xmlEscape(toDisplayMath(label))}</text>`)
  })
  ;(Array.isArray(spec.angleLabels) ? spec.angleLabels : []).forEach(item => {
    const point = points[String(item.point || item.vertex || '').trim()]
    const label = String(item.label || item.value || item.text || '').trim()
    if (!point || !label) return
    parts.push(`<text x="${point.x - 18}" y="${point.y + 30}" font-size="12" font-weight="700">${xmlEscape(toDisplayMath(label))}</text>`)
  })
  const labels = pointNamesFromSpec(spec)
  labels.forEach(label => {
    const point = points[label]
    if (!point) return
    parts.push(`<circle cx="${point.x}" cy="${point.y}" r="3" fill="#111"/>`)
    parts.push(`<text x="${point.x + 7}" y="${point.y - 6}" font-size="12" font-weight="700">${xmlEscape(label)}</text>`)
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

function renderSolidSvg(spec = {}, width = 340, height = 150) {
  const vertices = {
    A: [40, 118], B: [150, 118], C: [205, 82], D: [94, 82],
    A1: [40, 46], B1: [150, 46], C1: [205, 10], D1: [94, 10]
  }
  if (Array.isArray(spec.labels) && spec.labels.map(String).includes('O')) {
    vertices.O = [(vertices.B[0] + vertices.D[0]) / 2, (vertices.B[1] + vertices.D[1]) / 2]
  }
  const edges = Array.isArray(spec.edges) && spec.edges.length ? spec.edges : [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], ['A1', 'B1'], ['B1', 'C1'], ['C1', 'D1'], ['D1', 'A1'],
    ['A', 'A1'], ['B', 'B1'], ['C', 'C1'], ['D', 'D1']
  ]
  const hidden = Array.isArray(spec.hiddenEdges) ? spec.hiddenEdges : [['D', 'A'], ['D', 'D1'], ['D1', 'A1']]
  const parts = [`<rect width="100%" height="100%" fill="#fff"/>`]
  const draw = (pair, dashed = false) => {
    const [a, b] = pair
    if (!vertices[a] || !vertices[b]) return
    parts.push(`<line x1="${vertices[a][0]}" y1="${vertices[a][1]}" x2="${vertices[b][0]}" y2="${vertices[b][1]}" stroke="#111" stroke-width="1.6"${dashed ? ' stroke-dasharray="6 4"' : ''}/>`)
  }
  edges.forEach(edge => draw(edge, hidden.some(item => item[0] === edge[0] && item[1] === edge[1])))
  ;(Array.isArray(spec.marks) ? spec.marks : []).forEach(mark => {
    const pts = Array.isArray(mark?.points) ? mark.points.map(String) : []
    if (pts.length >= 3) {
      draw([pts[0], pts[1]])
      draw([pts[1], pts[2]])
    }
  })
  const labels = Array.isArray(spec.labels) && spec.labels.length ? spec.labels.map(String) : Object.keys(vertices)
  labels.forEach(label => {
    const point = vertices[label]
    if (!point) return
    parts.push(`<circle cx="${point[0]}" cy="${point[1]}" r="2.6" fill="#111"/>`)
    parts.push(`<text x="${point[0] - 8}" y="${point[1] - 8}" font-size="12" font-weight="700">${xmlEscape(label)}</text>`)
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`
}

function renderGeometrySvg(spec = {}, width = 340, height = 150) {
  const resolved = spec.type === 'template' ? templateSpecForSvg(spec) : spec
  if (resolved.type === 'analytic_curve') return renderAnalyticSvg(resolved, width, height)
  if (resolved.type === 'solid_diagram') return renderSolidSvg(resolved, width, height)
  const points = normalizedPointMap(resolved.points, width, height)
  const segments = (Array.isArray(resolved.segments) ? resolved.segments : [])
    .map(segmentPair)
    .filter(pair => pair && points[pair[0]] && points[pair[1]])
  if (!segments.length) return null
  const parts = []
  for (const [a, b] of segments) {
    parts.push(`<line x1="${points[a].x}" y1="${points[a].y}" x2="${points[b].x}" y2="${points[b].y}" stroke="#111" stroke-width="1.7" stroke-linecap="round"/>`)
  }
  const labels = Array.isArray(resolved.labels) && resolved.labels.length
    ? resolved.labels.map(item => typeof item === 'string' ? item : String(item.point || item.name || item.label || '').trim()).filter(Boolean)
    : Object.keys(points)
  for (const label of labels) {
    const point = points[label]
    if (!point) continue
    parts.push(`<circle cx="${point.x}" cy="${point.y}" r="2.2" fill="#111"/>`)
    parts.push(`<text x="${point.x + 5}" y="${point.y - 5}" font-size="12" font-weight="700">${xmlEscape(label)}</text>`)
  }
  for (const item of Array.isArray(resolved.lengthLabels) ? resolved.lengthLabels : []) {
    const pair = segmentPair(item.segment || [item.from, item.to])
    const label = String(item.label || item.value || item.text || '').trim()
    if (!pair || !label || !points[pair[0]] || !points[pair[1]]) continue
    const x = (points[pair[0]].x + points[pair[1]].x) / 2
    const y = (points[pair[0]].y + points[pair[1]].y) / 2
    parts.push(`<text x="${x}" y="${y + 15}" text-anchor="middle" font-size="11">${xmlEscape(toDisplayMath(label))}</text>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>`
}

function diagramSvgForQuestion(q) {
  const diagramSpec = inferQuestionDiagramSpec(q)
  if (!diagramSpec) return null
  const normalized = normalizeGeometryDiagramSpec(diagramSpec, q.number, { allowFallback: false, lockTemplates: false })
  const spec = normalized.spec
  if (!spec) return null
  if (spec.type === 'number_line') return { svg: renderNumberLineSvg(spec), width: 340, height: 82 }
  const svg = renderGeometrySvg(spec, 340, 150)
  return svg ? { svg, width: 340, height: 150 } : null
}

function diagramSvgForSolution(q) {
  const diagramSpec = inferSolutionDiagramSpec(q)
  if (!diagramSpec) return null
  const normalized = normalizeGeometryDiagramSpec(diagramSpec, q.number, { allowFallback: false, lockTemplates: false })
  const spec = normalized.spec
  if (!spec) return null
  if (spec.type === 'number_line') return { svg: renderNumberLineSvg(spec), width: 340, height: 82 }
  const svg = renderGeometrySvg(spec, 340, 150)
  return svg ? { svg, width: 340, height: 150 } : null
}

function imageParagraph(rendered, opts = {}) {
  if (!rendered?.svg) return []
  return [
    new Paragraph({
      indent: { left: BODY_INDENT, right: BODY_RIGHT_INDENT },
      spacing: { after: opts.after ?? 160 },
      children: [new ImageRun({
        type: 'svg',
        data: Buffer.from(rendered.svg),
        transformation: { width: rendered.width, height: rendered.height },
        fallback: { type: 'png', data: TRANSPARENT_PNG }
      })]
    })
  ]
}

function diagramParagraphs(q) {
  return imageParagraph(diagramSvgForQuestion(q))
}

function solutionDiagramParagraphs(q) {
  const rendered = diagramSvgForSolution(q)
  if (!rendered?.svg) return []
  return [
    p('解答图：', { bold: true, size: 22, after: 60, font: FONT_HEADING }),
    ...imageParagraph(rendered, { after: 140 })
  ]
}

export async function buildDocx({ worksheet, outputPath }) {
  const children = []
  children.push(p(worksheet.title || 'AI 智能练习卷', {
    style: 'PaperTitle',
    align: AlignmentType.CENTER,
    bold: true,
    size: 36,
    font: FONT_HEADING,
    after: 220
  }))
  children.push(p('班级：________    姓名：________    得分：________', {
    style: 'MetaLine',
    align: AlignmentType.CENTER,
    size: 22,
    after: 320
  }))
  let currentSection = ''
  for (const q of worksheet.questions || []) {
    if (q.section && q.section !== currentSection) {
      currentSection = q.section
      children.push(p(currentSection, {
        style: 'SectionHeading',
        bold: true,
        size: 26,
        font: FONT_HEADING,
        after: 100
      }))
    }
    children.push(mathParagraph(`${q.number}. `, withLatexText(q.question, q.questionLatex), {
      style: 'QuestionText',
      size: 23,
      prefixBold: true,
      after: 80
    }))
    children.push(...diagramParagraphs(q))
    children.push(...tableParagraphs(q.tableSpec))
    const choices = optionTable(q.options)
    if (choices) children.push(choices)
    else children.push(...practiceAnswerSpaceParagraphs(q))
  }
  children.push(p('答案与解析', {
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    align: AlignmentType.CENTER,
    bold: true,
    size: 30,
    font: FONT_HEADING,
    after: 260
  }))
  for (const q of worksheet.questions || []) {
    children.push(answerParagraph(q))
    children.push(...solutionDiagramParagraphs(q))
    children.push(...explanationParagraphs(q))
  }
  const doc = new Document({
    styles: paragraphStyles(),
    sections: [{ properties: sectionProperties(), children }]
  })
  const buffer = await Packer.toBuffer(doc)
  await fs.writeFile(outputPath, buffer)
}
