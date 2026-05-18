const GEOMETRY_FALLBACKS = {
  3: {
    type: 'number_line',
    axis: { min: -4, max: 4 },
    points: { a: -1.5 },
    labels: ['a']
  },
  5: {
    type: 'template',
    templateId: 'triangle_ruler_overlap_angle',
    labels: ['A', 'B', 'C', 'D', 'E', 'F']
  },
  22: {
    type: 'template',
    templateId: 'congruent_triangles_on_line',
    labels: ['A', 'B', 'C', 'D', 'E', 'F']
  },
  24: {
    type: 'template',
    templateId: 'parallel_lines_transversal',
    labels: ['H', 'B', 'A', 'E', 'M', 'N', 'C', 'D', 'G', 'F']
  },
  25: {
    type: 'template',
    templateId: 'grid_triangle_construction',
    labels: ['A', 'B', 'C']
  },
  27: {
    type: 'fence_area',
    points: {},
    segments: [],
    labels: []
  },
  28: {
    type: 'template',
    templateId: 'angle_bisector_rays',
    labels: ['O', 'A', 'B', 'C', 'D', 'E']
  }
}

const LOCKED_TEMPLATE_QUESTIONS = new Set([5, 22, 24, 25, 28])
const KNOWN_TEMPLATES = new Set([
  'triangle_ruler_overlap_angle',
  'congruent_triangles_on_line',
  'parallel_lines_transversal',
  'grid_triangle_construction',
  'angle_bisector_rays',
  'right_triangle_altitude_to_hypotenuse',
  'triangle_parallel_segment',
  'analytic_ellipse_standard',
  'analytic_parabola_focus_chord',
  'analytic_hyperbola_asymptote_focus_circle',
  'cube_midpoint_dihedral_angle',
  'square_pyramid_parallel_plane'
])

function isPoint(value) {
  return Array.isArray(value) && value.length >= 2 && value.every(item => Number.isFinite(Number(item)))
}

function hasPointMap(spec) {
  return spec?.points && typeof spec.points === 'object' && !Array.isArray(spec.points) &&
    Object.values(spec.points).every(isPoint)
}

function hasSegments(spec) {
  return normalizeSegments(spec?.segments).every(pair =>
    Array.isArray(pair) && pair.length === 2 && pair.every(item => typeof item === 'string')
  )
}

function hasLabels(spec) {
  return Array.isArray(spec?.labels) && normalizeLabels(spec).every(item => typeof item === 'string')
}

function hasParallelMarks(spec) {
  return Array.isArray(spec?.parallelMarks) && spec.parallelMarks.every(hasSegmentPair)
}

function hasEqualMarks(spec) {
  return Array.isArray(spec?.equalMarks) && spec.equalMarks.every(hasSegmentPair)
}

function hasSegmentPair(value) {
  return Array.isArray(value) && value.length === 2 && value.every(point => typeof point === 'string')
}

function segmentFromValue(value) {
  if (Array.isArray(value) && value.length === 2) return value.map(String)
  if (typeof value === 'string') {
    const text = value.trim()
    if (/^[A-Za-z][A-Za-z0-9]?$/.test(text)) return null
    if (/^[A-Za-z][A-Za-z0-9]?[A-Za-z][A-Za-z0-9]?$/.test(text)) {
      const match = text.match(/^([A-Za-z][A-Za-z0-9]?)([A-Za-z][A-Za-z0-9]?)$/)
      if (match) return [match[1], match[2]]
    }
  }
  if (value && typeof value === 'object') {
    if (value.start && value.end) return [String(value.start), String(value.end)]
    if (value.from && value.to) return [String(value.from), String(value.to)]
    if (Array.isArray(value.segment)) return value.segment.map(String).slice(0, 2)
    if (typeof value.segment === 'string') return segmentFromValue(value.segment)
  }
  return null
}

function normalizeSegments(segments = []) {
  if (!Array.isArray(segments)) return []
  return segments.map(segmentFromValue).filter(hasSegmentPair)
}

function normalizeLabels(spec = {}) {
  const raw = Array.isArray(spec.labels) && spec.labels.length ? spec.labels : Object.keys(spec.points || {})
  return raw
    .map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') return String(item.point || item.name || item.label || item.text || '').trim()
      return ''
    })
    .filter(Boolean)
}

function normalizeSegmentMarks(marks = []) {
  if (!Array.isArray(marks)) return []
  return marks.map(segmentFromValue).filter(hasSegmentPair)
}

export function normalizeDiagramSpecShape(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec
  const normalized = {
    ...spec,
    points: normalizePointMap(spec.points),
    segments: normalizeSegments(spec.segments),
    labels: normalizeLabels(spec)
  }
  if (Array.isArray(spec.parallelMarks)) normalized.parallelMarks = normalizeSegmentMarks(spec.parallelMarks)
  if (Array.isArray(spec.equalMarks)) normalized.equalMarks = normalizeSegmentMarks(spec.equalMarks)
  return normalized
}

function hasGridSpec(spec) {
  return spec?.gridSpec && Number(spec.gridSpec.cols || 0) > 0 && Number(spec.gridSpec.rows || 0) > 0
}

function isCoordinate(value) {
  if (Array.isArray(value)) return value.length >= 2 && value.every(item => Number.isFinite(Number(item)))
  return value && typeof value === 'object' && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
}

function normalizePointMap(points = {}) {
  if (Array.isArray(points)) {
    return Object.fromEntries(points
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const name = String(item.name || item.label || item.id || `P${index + 1}`)
        if (Array.isArray(item.point)) return [name, item.point]
        return [name, [Number(item.x), Number(item.y), Number(item.z || 0)]]
      })
      .filter(Boolean)
      .filter(([, value]) => isCoordinate(value)))
  }
  if (!points || typeof points !== 'object') return {}
  return Object.fromEntries(Object.entries(points)
    .map(([name, value]) => {
      if (Array.isArray(value)) return [name, value.map(Number)]
      if (value && typeof value === 'object') return [name, [Number(value.x), Number(value.y), Number(value.z || 0)]]
      return null
    })
    .filter(Boolean)
    .filter(([, value]) => isCoordinate(value)))
}

function hasAnalyticCurveSpec(spec) {
  const kind = String(spec.curveKind || spec.kind || '').trim()
  return Boolean(kind || spec.equation || spec.templateId) && (!spec.axes || typeof spec.axes === 'object')
}

function hasSolidDiagramSpec(spec) {
  const vertices = normalizePointMap(spec.vertices || spec.points)
  const edges = Array.isArray(spec.edges) ? spec.edges : []
  return Boolean(spec.templateId || spec.solidKind || Object.keys(vertices).length >= 4) &&
    (KNOWN_TEMPLATES.has(String(spec.templateId || '')) || edges.length > 0 || spec.solidKind || spec.templateId)
}

export function validateGeometryDiagramSpec(spec, questionNumber = 0) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { valid: false, reason: 'diagramSpec must be an object' }
  }
  const type = String(spec.type || '')
  if (type === 'none') return { valid: false, reason: 'diagramSpec type is none' }
  if (type === 'template') {
    const templateId = String(spec.templateId || '')
    if (!KNOWN_TEMPLATES.has(templateId)) return { valid: false, reason: 'template diagram requires a known templateId' }
    if (['right_triangle_altitude_to_hypotenuse', 'triangle_parallel_segment'].includes(templateId)) {
      return hasPointMap(spec) && hasSegments(spec) && normalizeLabels(spec).length >= 3
        ? { valid: true }
        : { valid: false, reason: `${templateId} requires points, segments, labels` }
    }
    return { valid: true }
  }
  if (type === 'number_line') {
    return spec.axis && spec.points ? { valid: true } : { valid: false, reason: 'number_line requires axis and points' }
  }
  if (type === 'grid_triangle') {
    return hasGridSpec(spec) && hasPointMap(spec) && hasSegments(spec) && hasLabels(spec)
      ? { valid: true }
      : { valid: false, reason: 'grid diagram requires gridSpec, points, segments, labels' }
  }
  if (type === 'parallel_lines') {
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && hasParallelMarks(spec)
      ? { valid: true }
      : { valid: false, reason: 'parallel diagram requires points, segments, labels, parallelMarks' }
  }
  if (type === 'congruent_triangles') {
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && hasEqualMarks(spec)
      ? { valid: true }
      : { valid: false, reason: 'congruent diagram requires points, segments, labels, equalMarks' }
  }
  if (['triangle_ruler', 'generic_geometry', 'angle_bisector'].includes(type)) {
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec)
      ? { valid: true }
      : { valid: false, reason: `${type} requires points, segments, labels` }
  }
  if (type === 'analytic_curve') {
    return hasAnalyticCurveSpec(spec)
      ? { valid: true }
      : { valid: false, reason: 'analytic_curve requires curveKind or equation and optional axes/points/lines' }
  }
  if (type === 'solid_diagram') {
    return hasSolidDiagramSpec(spec)
      ? { valid: true }
      : { valid: false, reason: 'solid_diagram requires solidKind/templateId or vertices and edges' }
  }
  if (type === 'fence_area') return { valid: true }
  const fallback = fallbackGeometrySpec(questionNumber)
  return fallback ? { valid: false, reason: `unknown type ${type}` } : { valid: false, reason: `unsupported type ${type}` }
}

export function fallbackGeometrySpec(questionNumber = 0) {
  const spec = GEOMETRY_FALLBACKS[Number(questionNumber)]
  return spec ? JSON.parse(JSON.stringify(spec)) : null
}

export function normalizeGeometryDiagramSpec(spec, questionNumber = 0, options = {}) {
  const allowFallback = options.allowFallback !== false
  const lockTemplates = options.lockTemplates !== false
  if (allowFallback && lockTemplates && LOCKED_TEMPLATE_QUESTIONS.has(Number(questionNumber))) {
    const fallback = fallbackGeometrySpec(questionNumber)
    return {
      spec: fallback,
      source: 'locked-template',
      validation: { valid: true, reason: 'locked to professional template' }
    }
  }
  const shaped = normalizeDiagramSpecShape(spec)
  const result = validateGeometryDiagramSpec(shaped, questionNumber)
  if (result.valid) return { spec: shaped, source: 'ai', validation: result }
  const fallback = allowFallback ? fallbackGeometrySpec(questionNumber) : null
  return {
    spec: fallback,
    source: fallback ? 'fallback' : 'none',
    validation: result
  }
}

function point(spec, name, box) {
  const [px, py] = spec.points[name] || [0, 0]
  const scale = Number(box.scale || 1)
  return [box.x + Number(px) * scale, box.y + Number(py) * scale]
}

function drawLabels(doc, spec, box) {
  for (const label of spec.labels || Object.keys(spec.points || {})) {
    const [x, y] = point(spec, label, box)
    doc.fontSize(8.5).fillColor('#111111').text(label, x - 5, y - 13, { width: 16, align: 'center', lineBreak: false })
  }
}

function drawSegments(doc, spec, box) {
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.15)
  for (const [a, b] of spec.segments || []) {
    const [x1, y1] = point(spec, a, box)
    const [x2, y2] = point(spec, b, box)
    doc.moveTo(x1, y1).lineTo(x2, y2).stroke()
  }
  doc.restore()
}

function midpoint(spec, pair, box) {
  const [x1, y1] = point(spec, pair[0], box)
  const [x2, y2] = point(spec, pair[1], box)
  return [(x1 + x2) / 2, (y1 + y2) / 2, Math.atan2(y2 - y1, x2 - x1)]
}

function drawRelationMarks(doc, spec, box) {
  doc.save().strokeColor('#111111').lineWidth(0.8)
  for (const pair of spec.parallelMarks || []) {
    const [x, y, angle] = midpoint(spec, pair, box)
    doc.save()
    doc.rotate(angle * 180 / Math.PI, { origin: [x, y] })
    doc.moveTo(x - 5, y - 4).lineTo(x + 5, y - 4).stroke()
    doc.moveTo(x - 5, y + 4).lineTo(x + 5, y + 4).stroke()
    doc.restore()
  }
  for (const pair of spec.equalMarks || []) {
    const [x, y, angle] = midpoint(spec, pair, box)
    doc.save()
    doc.rotate(angle * 180 / Math.PI + 90, { origin: [x, y] })
    doc.moveTo(x, y - 4).lineTo(x, y + 4).stroke()
    doc.restore()
  }
  doc.restore()
}

function mapTemplatePoint(point, box) {
  const scale = Number(box.scale || 1)
  return [box.x + point[0] * scale, box.y + point[1] * scale]
}

function drawRightAngleMark(doc, vertex, armA, armB, size = 10) {
  const unit = (from, to) => {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.hypot(dx, dy) || 1
    return [dx / length, dy / length]
  }
  const u = unit(vertex, armA)
  const v = unit(vertex, armB)
  const p1 = [vertex[0] + u[0] * size, vertex[1] + u[1] * size]
  const p2 = [p1[0] + v[0] * size, p1[1] + v[1] * size]
  const p3 = [vertex[0] + v[0] * size, vertex[1] + v[1] * size]
  doc.moveTo(...p1).lineTo(...p2).lineTo(...p3).stroke()
}

function drawParallelPairMark(doc, p1, p2, offset = 0) {
  const mx = (p1[0] + p2[0]) / 2 + offset
  const my = (p1[1] + p2[1]) / 2
  const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI
  doc.save()
  doc.rotate(angle + 70, { origin: [mx, my] })
  doc.moveTo(mx - 5, my).lineTo(mx + 5, my).stroke()
  doc.restore()
}

function renderNumberLine(doc, spec, box) {
  const min = Number(spec.axis?.min ?? -4)
  const max = Number(spec.axis?.max ?? 4)
  const width = Number(box.width || 260)
  const x = box.x
  const y = box.y + 30
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1)
  doc.moveTo(x, y).lineTo(x + width, y).stroke()
  for (let value = min; value <= max; value += 1) {
    const px = x + ((value - min) / (max - min)) * width
    doc.moveTo(px, y - 5).lineTo(px, y + 5).stroke()
    doc.fontSize(8).text(String(value), px - 8, y + 8, { width: 16, align: 'center' })
  }
  for (const [label, rawValue] of Object.entries(spec.points || {})) {
    const px = x + ((Number(rawValue) - min) / (max - min)) * width
    doc.circle(px, y, 3).fill('#111111')
    doc.fontSize(9).text(label, px - 8, y - 22, { width: 16, align: 'center' })
  }
  doc.restore()
  return 78
}

function renderGridTriangle(doc, spec, box) {
  const cols = Number(spec.gridSpec?.cols || 8)
  const rows = Number(spec.gridSpec?.rows || 8)
  const cell = Number(spec.gridSpec?.cell || 13)
  const drawOne = (x, y) => {
    doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(0.6)
    for (let i = 0; i <= cols; i += 1) {
      doc.moveTo(x + i * cell, y).lineTo(x + i * cell, y + rows * cell).stroke()
    }
    for (let i = 0; i <= rows; i += 1) {
      doc.moveTo(x, y + i * cell).lineTo(x + cols * cell, y + i * cell).stroke()
    }
    const gridBox = { x, y, scale: cell }
    drawSegments(doc, spec, gridBox)
    drawLabels(doc, spec, gridBox)
    doc.restore()
  }
  drawOne(box.x, box.y + 20)
  drawOne(box.x + 240, box.y + 20)
  doc.fontSize(9).text('图 1', box.x + 45, box.y + 134, { width: 60, align: 'center' })
  doc.fontSize(9).text('图 2', box.x + 285, box.y + 134, { width: 60, align: 'center' })
  return 154
}

function renderCongruentTrianglesOnLine(doc, box) {
  const spec = {
    points: {
      A: [0, 48],
      E: [45, 48],
      F: [92, 48],
      B: [150, 48],
      D: [72, 3],
      C: [78, 86]
    },
    segments: [['A', 'B'], ['D', 'E'], ['D', 'B'], ['C', 'F'], ['C', 'A']],
    labels: ['A', 'B', 'C', 'D', 'E', 'F'],
    parallelMarks: [['D', 'E'], ['C', 'F']],
    equalMarks: [['D', 'E'], ['C', 'F']]
  }
  renderGenericGeometry(doc, spec, { ...box, height: 96 })
  return Number(box.height || 96)
}

function renderParallelLinesTransversal(doc, box) {
  const spec = {
    points: {
      H: [0, 25],
      B: [75, 25],
      A: [135, 25],
      E: [190, 25],
      M: [8, 85],
      N: [76, 85],
      C: [110, 85],
      D: [178, 85],
      G: [45, 0],
      F: [160, 5]
    },
    segments: [['H', 'E'], ['M', 'D'], ['G', 'C'], ['F', 'N']],
    labels: ['H', 'B', 'A', 'E', 'M', 'N', 'C', 'D', 'G', 'F'],
    parallelMarks: [['H', 'E'], ['M', 'D']]
  }
  renderGenericGeometry(doc, spec, { ...box, height: 122 })
  return Number(box.height || 122)
}

function renderGridTriangleConstruction(doc, box) {
  const spec = {
    gridSpec: { cols: 8, rows: 8, cell: 13 },
    points: {
      A: [3, 5],
      B: [6, 5],
      C: [2, 3]
    },
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A']],
    labels: ['A', 'B', 'C']
  }
  return renderGridTriangle(doc, spec, box)
}

function renderTriangleRulerOverlapAngle(doc, box) {
  const raw = {
    B: [10, 92],
    A: [236, 86],
    C: [158, 12],
    D: [118, 76],
    E: [207, 73],
    F: [160, 31]
  }
  const p = Object.fromEntries(Object.entries(raw).map(([label, value]) => [label, mapTemplatePoint(value, box)]))
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.15)
  ;[
    ['B', 'A'],
    ['A', 'C'],
    ['C', 'B'],
    ['D', 'E'],
    ['D', 'F'],
    ['F', 'E'],
    ['B', 'D'],
    ['A', 'E']
  ].forEach(([a, b]) => doc.moveTo(...p[a]).lineTo(...p[b]).stroke())

  doc.lineWidth(0.8)
  drawRightAngleMark(doc, p.F, p.D, p.E, 9 * Number(box.scale || 1))
  drawParallelPairMark(doc, p.B, p.A, 0)
  drawParallelPairMark(doc, p.D, p.E, 0)

  const arcRadius = 14 * Number(box.scale || 1)
  doc.moveTo(p.E[0] - arcRadius, p.E[1] - 2)
    .quadraticCurveTo(p.E[0] - 8 * Number(box.scale || 1), p.E[1] - 13 * Number(box.scale || 1), p.E[0] + 3, p.E[1] - arcRadius)
    .stroke()

  const labels = {
    A: [7, -1],
    B: [-13, -5],
    C: [-3, -17],
    D: [-15, 2],
    E: [5, -12],
    F: [-17, -1]
  }
  Object.entries(labels).forEach(([label, [dx, dy]]) => {
    doc.fontSize(8.5).text(label, p[label][0] + dx, p[label][1] + dy, { width: 14, align: 'center', lineBreak: false })
  })
  doc.restore()
  return Number(box.height || 112)
}

function renderFenceArea(doc, box) {
  const x = box.x
  const y = box.y + 16
  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(1.1)
  for (let i = 0; i < 12; i += 1) {
    const xx = x + 210 + i * 12
    doc.moveTo(xx, y).lineTo(xx + 18, y - 10).stroke()
  }
  doc.fontSize(10).text('围墙（大于100米）', x + 260, y - 26, { width: 130, align: 'center' })
  doc.moveTo(x + 240, y + 18).lineTo(x + 240, y + 98).lineTo(x + 420, y + 98).lineTo(x + 420, y + 18).stroke()
  doc.moveTo(x + 436, y + 18).lineTo(x + 436, y + 98).stroke()
  doc.moveTo(x + 430, y + 18).lineTo(x + 442, y + 18).stroke()
  doc.moveTo(x + 430, y + 98).lineTo(x + 442, y + 98).stroke()
  doc.fontSize(10).text('x 米', x + 448, y + 52, { width: 36, lineBreak: false })
  doc.restore()
  return 138
}

function renderGenericGeometry(doc, spec, box) {
  const localBox = { ...box, scale: Number(box.scale || 1) }
  drawSegments(doc, spec, localBox)
  drawRelationMarks(doc, spec, localBox)
  drawLabels(doc, spec, localBox)
  return Number(box.height || 105)
}

function renderAngleBisector(doc, spec, box) {
  const localBox = { ...box, scale: Number(box.scale || 1) }
  drawSegments(doc, spec, localBox)
  drawLabels(doc, spec, localBox)
  const [ox, oy] = point(spec, 'O', localBox)
  doc.fontSize(8.5).fillColor('#111111').text('O', ox - 16, oy + 2, { width: 14, align: 'center', lineBreak: false })
  doc.save().strokeColor('#111111').lineWidth(0.8)
  const marks = Array.isArray(spec.angleMarks) ? spec.angleMarks : [[0, 40], [40, 80], [80, 120]]
  marks.forEach(([start, end], index) => {
    const radius = 24 + index * 6
    const steps = 8
    for (let i = 0; i <= steps; i += 1) {
      const degree = Number(start) + (Number(end) - Number(start)) * (i / steps)
      const px = ox + Math.cos(degree * Math.PI / 180) * radius
      const py = oy - Math.sin(degree * Math.PI / 180) * radius
      if (i === 0) doc.moveTo(px, py)
      else doc.lineTo(px, py)
    }
    doc.stroke()
  })
  doc.restore()
  return Number(box.height || 128)
}

function renderAngleBisectorRays(doc, box) {
  const spec = {
    points: {
      O: [70, 112],
      A: [255, 112],
      E: [210, 61],
      C: [190, 10],
      D: [92, 4],
      B: [8, 2]
    },
    segments: [['O', 'A'], ['O', 'B'], ['O', 'C'], ['O', 'D'], ['O', 'E']],
    labels: ['O', 'A', 'B', 'C', 'D', 'E'],
    angleMarks: [[0, 20], [20, 40], [40, 80], [80, 120]]
  }
  return renderAngleBisector(doc, spec, box)
}

function analyticKind(spec = {}) {
  const raw = String(spec.curveKind || spec.kind || spec.templateId || spec.equation || '').toLowerCase()
  if (raw.includes('hyperbola')) return 'hyperbola'
  if (raw.includes('parabola')) return 'parabola'
  if (raw.includes('ellipse')) return 'ellipse'
  if (raw.includes('\u53cc\u66f2\u7ebf')) return 'hyperbola'
  if (raw.includes('\u629b\u7269\u7ebf')) return 'parabola'
  return 'ellipse'
}

function drawArrowLine(doc, x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke()
  doc.moveTo(x2, y2)
    .lineTo(x2 - Math.cos(angle - 0.42) * 7, y2 - Math.sin(angle - 0.42) * 7)
    .lineTo(x2 - Math.cos(angle + 0.42) * 7, y2 - Math.sin(angle + 0.42) * 7)
    .stroke()
}

function renderAnalyticCurve(doc, spec, box) {
  const width = Number(box.width || 260)
  const height = Number(box.height || 128)
  const left = Number(box.x || 0)
  const top = Number(box.y || 0) + 8
  const x0 = left + width / 2
  const y0 = top + height / 2
  const scale = Math.min(width / 10, height / 8)
  const toPx = (x, y) => [x0 + Number(x) * scale, y0 - Number(y) * scale]
  const kind = analyticKind(spec)
  const a = Number(spec.axes?.a || spec.parameters?.a || (kind === 'parabola' ? 1 : 3))
  const b = Number(spec.axes?.b || spec.parameters?.b || 2)
  const p = Number(spec.parameters?.p || spec.focusParameter || 1)

  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(0.9)
  drawArrowLine(doc, left + 8, y0, left + width - 8, y0)
  drawArrowLine(doc, x0, top + height - 8, x0, top + 8)
  doc.fontSize(8).text('x', left + width - 13, y0 + 4, { width: 10, lineBreak: false })
  doc.fontSize(8).text('y', x0 + 5, top + 5, { width: 10, lineBreak: false })

  doc.lineWidth(1.25)
  const trace = points => {
    points.forEach(([x, y], index) => {
      const [px, py] = toPx(x, y)
      if (index === 0) doc.moveTo(px, py)
      else doc.lineTo(px, py)
    })
    doc.stroke()
  }

  if (kind === 'ellipse') {
    const points = []
    for (let i = 0; i <= 96; i += 1) {
      const t = (Math.PI * 2 * i) / 96
      points.push([Math.cos(t) * a, Math.sin(t) * b])
    }
    trace(points)
    ;[[-Math.sqrt(Math.max(a * a - b * b, 0)), 0, 'F1'], [Math.sqrt(Math.max(a * a - b * b, 0)), 0, 'F2']].forEach(([x, y, label]) => {
      const [px, py] = toPx(x, y)
      doc.circle(px, py, 2.3).fill('#111111')
      doc.fontSize(8).text(label, px - 8, py + 5, { width: 18, align: 'center', lineBreak: false })
    })
  } else if (kind === 'hyperbola') {
    doc.save().dash(3, { space: 3 }).lineWidth(0.7)
    ;[[b / a, 0], [-b / a, 0]].forEach(([slope]) => {
      const [x1, y1] = toPx(-4.5, slope * -4.5)
      const [x2, y2] = toPx(4.5, slope * 4.5)
      doc.moveTo(x1, y1).lineTo(x2, y2).stroke()
    })
    doc.undash().restore()
    const right = []
    const leftBranch = []
    for (let i = 0; i <= 64; i += 1) {
      const t = -1.15 + (2.3 * i) / 64
      const x = a * Math.cosh(t)
      const y = b * Math.sinh(t)
      right.push([x, y])
      leftBranch.push([-x, y])
    }
    trace(right)
    trace(leftBranch)
  } else {
    const points = []
    for (let i = -44; i <= 44; i += 1) {
      const x = i / 10
      points.push([x, (x * x) / (4 * p)])
    }
    trace(points)
    const [fx, fy] = toPx(0, p)
    doc.circle(fx, fy, 2.3).fill('#111111')
    doc.fontSize(8).text('F', fx + 4, fy - 6, { width: 12, lineBreak: false })
    const [dx1, dy1] = toPx(-4.5, -p)
    const [dx2, dy2] = toPx(4.5, -p)
    doc.save().dash(3, { space: 3 }).moveTo(dx1, dy1).lineTo(dx2, dy2).stroke().undash().restore()
  }

  const points = normalizePointMap(spec.points)
  Object.entries(points).forEach(([label, value]) => {
    const [px, py] = toPx(value[0], value[1])
    doc.circle(px, py, 2.4).fill('#111111')
    doc.fontSize(8).text(label, px - 7, py - 13, { width: 16, align: 'center', lineBreak: false })
  })
  doc.restore()
  return height + 18
}

function defaultSolidSpec(spec = {}) {
  const id = String(spec.templateId || '')
  const kind = String(spec.solidKind || '').toLowerCase()
  if (id === 'square_pyramid_parallel_plane' || kind.includes('pyramid')) {
    return {
      vertices: { A: [25, 90], B: [150, 90], C: [198, 55], D: [72, 55], S: [112, 8], E: [58, 72], F: [174, 72] },
      edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], ['S', 'A'], ['S', 'B'], ['S', 'C'], ['S', 'D'], ['E', 'F']],
      hiddenEdges: [['D', 'C'], ['S', 'D']],
      labels: ['S', 'A', 'B', 'C', 'D', 'E', 'F']
    }
  }
  return {
    vertices: {
      A: [20, 96], B: [110, 96], C: [150, 68], D: [60, 68],
      A1: [20, 34], B1: [110, 34], C1: [150, 6], D1: [60, 6],
      E: [110, 65]
    },
    edges: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], ['A1', 'B1'], ['B1', 'C1'], ['C1', 'D1'], ['D1', 'A1'], ['A', 'A1'], ['B', 'B1'], ['C', 'C1'], ['D', 'D1'], ['A', 'E']],
    hiddenEdges: [['D', 'A'], ['D', 'D1'], ['C', 'D']],
    labels: ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1', 'E']
  }
}

function projectSolidPoint(value, box) {
  const scale = Number(box.scale || 1)
  const x = Number(value[0] || 0)
  const y = Number(value[1] || 0)
  const z = Number(value[2] || 0)
  return [box.x + (x + z * 0.45) * scale, box.y + (y - z * 0.32) * scale]
}

function renderSolidDiagram(doc, spec, box) {
  const resolved = spec.vertices || spec.points ? spec : defaultSolidSpec(spec)
  const vertices = normalizePointMap(resolved.vertices || resolved.points)
  const edges = Array.isArray(resolved.edges) && resolved.edges.length ? resolved.edges : defaultSolidSpec(spec).edges
  const hiddenEdges = Array.isArray(resolved.hiddenEdges) ? resolved.hiddenEdges : []
  const labels = Array.isArray(resolved.labels) ? resolved.labels : Object.keys(vertices)
  const p = Object.fromEntries(Object.entries(vertices).map(([name, value]) => [name, projectSolidPoint(value, box)]))

  const drawEdges = (items, hidden = false) => {
    if (hidden) doc.save().dash(4, { space: 3 }).strokeColor('#333333').lineWidth(0.85)
    else doc.save().strokeColor('#111111').lineWidth(1.1)
    items.forEach(([a, b]) => {
      if (!p[a] || !p[b]) return
      doc.moveTo(...p[a]).lineTo(...p[b]).stroke()
    })
    if (hidden) doc.undash()
    doc.restore()
  }

  drawEdges(edges.filter(edge => !hiddenEdges.some(hidden => hidden[0] === edge[0] && hidden[1] === edge[1])), false)
  drawEdges(hiddenEdges, true)

  doc.save().fillColor('#111111')
  labels.forEach(label => {
    if (!p[label]) return
    doc.circle(p[label][0], p[label][1], 1.8).fill('#111111')
    doc.fontSize(8).text(label, p[label][0] - 7, p[label][1] - 13, { width: 20, align: 'center', lineBreak: false })
  })
  doc.restore()
  return Number(box.height || 122)
}

function pointNameFromSegment(segment, index) {
  const pair = segmentFromValue(segment)
  return pair ? pair[index] : ''
}

function drawTemplateDecorations(doc, spec, box) {
  const localBox = { ...box, scale: Number(box.scale || 1) }
  const pointAt = name => point({ points: spec.points }, name, localBox)

  doc.save().strokeColor('#111111').fillColor('#111111').lineWidth(0.85)
  for (const mark of spec.rightAngleMarks || []) {
    if (!mark || typeof mark !== 'object') continue
    const vertex = String(mark.vertex || '').trim()
    let armA = ''
    let armB = ''
    if (Array.isArray(mark.points) && mark.points.length >= 3) {
      armA = mark.points[0]
      armB = mark.points[2]
    } else if (Array.isArray(mark.sides) && mark.sides.length >= 2) {
      armA = pointNameFromSegment(mark.sides[0], 0) === vertex ? pointNameFromSegment(mark.sides[0], 1) : pointNameFromSegment(mark.sides[0], 0)
      armB = pointNameFromSegment(mark.sides[1], 0) === vertex ? pointNameFromSegment(mark.sides[1], 1) : pointNameFromSegment(mark.sides[1], 0)
    } else if (Array.isArray(mark.arms) && mark.arms.length >= 2) {
      armA = String(mark.arms[0]).replace(vertex, '')
      armB = String(mark.arms[1]).replace(vertex, '')
    }
    if (vertex && armA && armB && spec.points[vertex] && spec.points[armA] && spec.points[armB]) {
      drawRightAngleMark(doc, pointAt(vertex), pointAt(armA), pointAt(armB), Number(mark.size || 9))
    }
  }

  for (const mark of spec.perpendicularMarks || []) {
    if (!mark || typeof mark !== 'object') continue
    const vertex = String(mark.at || mark.vertex || mark.intersection || '').trim()
    const line1 = Array.isArray(mark.line1) ? mark.line1 : segmentFromValue(mark.segment1)
    const line2 = Array.isArray(mark.line2) ? mark.line2 : segmentFromValue(mark.segment2)
    const armA = line1?.find(name => name !== vertex) || line1?.[0]
    const armB = line2?.find(name => name !== vertex) || line2?.[0]
    if (vertex && armA && armB && spec.points[vertex] && spec.points[armA] && spec.points[armB]) {
      drawRightAngleMark(doc, pointAt(vertex), pointAt(armA), pointAt(armB), Number(mark.size || 8))
    }
  }

  for (const item of spec.lengthLabels || []) {
    if (!item || typeof item !== 'object') continue
    const pair = Array.isArray(item.segment) ? item.segment : segmentFromValue(item.segment || [item.from, item.to])
    const label = String(item.label || item.value || item.text || '').trim()
    if (!pair || !label || !spec.points[pair[0]] || !spec.points[pair[1]]) continue
    const [x, y] = midpoint(spec, pair, localBox)
    doc.fontSize(8.5).text(label, x - 10, y + 4, { width: 20, align: 'center', lineBreak: false })
  }
  doc.restore()
}

function renderTemplateSpec(doc, spec, box) {
  if (!spec.points || !Object.keys(spec.points).length || !spec.segments?.length) return 0
  renderGenericGeometry(doc, spec, box)
  drawTemplateDecorations(doc, spec, box)
  return Number(box.height || 118)
}

function renderTemplateDiagram(doc, spec, box) {
  if (spec.templateId === 'triangle_ruler_overlap_angle') return renderTriangleRulerOverlapAngle(doc, box)
  if (spec.templateId === 'congruent_triangles_on_line') return renderCongruentTrianglesOnLine(doc, box)
  if (spec.templateId === 'parallel_lines_transversal') return renderParallelLinesTransversal(doc, box)
  if (spec.templateId === 'grid_triangle_construction') return renderGridTriangleConstruction(doc, box)
  if (spec.templateId === 'angle_bisector_rays') return renderAngleBisectorRays(doc, box)
  if (spec.templateId === 'right_triangle_altitude_to_hypotenuse') return renderTemplateSpec(doc, spec, box)
  if (spec.templateId === 'triangle_parallel_segment') return renderTemplateSpec(doc, spec, box)
  return 0
}

export function renderGeometryDiagram(doc, diagramSpec, options = {}) {
  const normalized = normalizeGeometryDiagramSpec(diagramSpec, options.questionNumber, options)
  const spec = normalized.spec
  if (!spec) return { height: 0, source: normalized.source, validation: normalized.validation }
  const box = {
    x: Number(options.x || 0),
    y: Number(options.y || 0),
    width: Number(options.width || 260),
    height: Number(options.height || 110),
    scale: Number(options.scale || 1)
  }
  let height = 0
  if (spec.type === 'template') height = renderTemplateDiagram(doc, spec, box)
  else if (spec.type === 'number_line') height = renderNumberLine(doc, spec, box)
  else if (spec.type === 'grid_triangle') height = renderGridTriangle(doc, spec, box)
  else if (spec.type === 'fence_area') height = renderFenceArea(doc, box)
  else if (spec.type === 'angle_bisector') height = renderAngleBisector(doc, spec, box)
  else if (spec.type === 'analytic_curve') height = renderAnalyticCurve(doc, spec, box)
  else if (spec.type === 'solid_diagram') height = renderSolidDiagram(doc, spec, box)
  else height = renderGenericGeometry(doc, spec, box)
  return { height, source: normalized.source, validation: normalized.validation }
}
