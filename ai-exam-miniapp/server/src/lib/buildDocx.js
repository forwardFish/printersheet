import fs from 'fs/promises'
import { Document, ImageRun, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx'
import { explanationStepsForQuestion, splitMathParts, toDisplayChemistry, toDisplayMath } from './mathFormat.js'
import { inferQuestionDiagramSpec } from './buildPdf.js'
import { normalizeGeometryDiagramSpec } from './geometryRenderer.js'

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    heading: opts.heading,
    spacing: { after: opts.after ?? 160 },
    children: [new TextRun({ text: String(text || ''), bold: !!opts.bold, size: opts.size || 24, font: 'Microsoft YaHei' })]
  })
}

function runsFromMathParts(text, opts = {}) {
  return splitMathParts(toDisplayChemistry(text)).map(part => new TextRun({
    text: part.type === 'math' ? toDisplayMath(part.text) : part.text,
    bold: part.type === 'math' || !!opts.bold,
    size: opts.size || 24,
    font: part.type === 'math' ? 'Consolas' : 'Microsoft YaHei',
    color: part.type === 'math' ? '25315C' : (opts.color || '222222')
  }))
}

function withLatexText(text = '', latex = '') {
  const base = String(text || '').trim()
  const formula = splitMathParts(toDisplayChemistry(latex || '')).map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text).join('').trim()
  if (!formula) return base
  const compactBase = splitMathParts(toDisplayChemistry(base)).map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text).join('').replace(/\s+/g, '')
  const compactFormula = formula.replace(/\s+/g, '')
  return compactBase.includes(compactFormula) ? base : `${base} ${formula}`
}

function mathParagraph(prefix, text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    children: [
      new TextRun({ text: prefix, bold: !!opts.prefixBold, size: opts.size || 24, font: 'Microsoft YaHei', color: opts.color || '222222' }),
      ...runsFromMathParts(text, opts)
    ]
  })
}

function answerParagraph(q) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${q.number}. 答案：`, bold: true, size: 24, font: 'Microsoft YaHei', color: '178451' }),
      ...runsFromMathParts(withLatexText(q.answer || '略', q.answerLatex), { size: 24 })
    ]
  })
}

function explanationParagraphs(q) {
  const steps = explanationStepsForQuestion(q)
  const paragraphs = [
    p('解析：', { bold: true, size: 23, after: 80 })
  ]
  for (const step of steps.length ? steps : ['略']) {
    paragraphs.push(new Paragraph({
      spacing: { after: 90 },
      indent: { left: 240 },
      children: runsFromMathParts(step, { size: 22, color: '555555' })
    }))
  }
  return paragraphs
}

function tableParagraphs(tableSpec) {
  if (!tableSpec || typeof tableSpec !== 'object' || Array.isArray(tableSpec)) return []
  const headers = Array.isArray(tableSpec.headers) ? tableSpec.headers : []
  const rows = Array.isArray(tableSpec.rows) ? tableSpec.rows : []
  const normalizedRows = rows
    .map(row => Array.isArray(row) ? row : Object.values(row || {}))
    .filter(row => row.length)
  const lines = [
    headers.length ? headers.join(' | ') : '',
    ...normalizedRows.map(row => row.join(' | '))
  ].filter(Boolean)
  return lines.length
    ? [p(lines.join('\n'), { size: 21, after: 180 })]
    : []
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

function renderGeometrySvg(spec = {}, width = 340, height = 150) {
  const resolved = spec.type === 'template' ? templateSpecForSvg(spec) : spec
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

function diagramParagraphs(q) {
  const rendered = diagramSvgForQuestion(q)
  if (!rendered?.svg) return []
  return [
    new Paragraph({
      spacing: { after: 160 },
      children: [new ImageRun({
        type: 'svg',
        data: Buffer.from(rendered.svg),
        transformation: { width: rendered.width, height: rendered.height },
        fallback: { type: 'png', data: TRANSPARENT_PNG }
      })]
    })
  ]
}

export async function buildDocx({ worksheet, outputPath }) {
  const children = []
  children.push(p(worksheet.title || 'AI 智能练习卷', { align: AlignmentType.CENTER, bold: true, size: 34, after: 260 }))
  children.push(p('班级：________    姓名：________    得分：________', { align: AlignmentType.CENTER, size: 22, after: 300 }))
  let currentSection = ''
  for (const q of worksheet.questions || []) {
    if (q.section && q.section !== currentSection) {
      currentSection = q.section
      children.push(p(currentSection, { bold: true, size: 26, after: 180 }))
    }
    children.push(mathParagraph(`${q.number}. `, withLatexText(q.question, q.questionLatex), { size: 24, prefixBold: true, after: 100 }))
    children.push(...diagramParagraphs(q))
    children.push(...tableParagraphs(q.tableSpec))
    if (q.options?.length) children.push(p(q.options.join('        '), { size: 23, after: 180 }))
    else children.push(p('答：__________________________________________________', { size: 23, after: 220 }))
  }
  children.push(p('答案与解析', { heading: HeadingLevel.HEADING_1, align: AlignmentType.CENTER, bold: true, size: 30, after: 260 }))
  for (const q of worksheet.questions || []) {
    children.push(answerParagraph(q))
    children.push(...explanationParagraphs(q))
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const buffer = await Packer.toBuffer(doc)
  await fs.writeFile(outputPath, buffer)
}
