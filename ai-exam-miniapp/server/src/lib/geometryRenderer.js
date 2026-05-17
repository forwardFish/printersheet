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
  'angle_bisector_rays'
])

function isPoint(value) {
  return Array.isArray(value) && value.length >= 2 && value.every(item => Number.isFinite(Number(item)))
}

function hasPointMap(spec) {
  return spec?.points && typeof spec.points === 'object' && !Array.isArray(spec.points) &&
    Object.values(spec.points).every(isPoint)
}

function hasSegments(spec) {
  return Array.isArray(spec?.segments) && spec.segments.every(pair =>
    Array.isArray(pair) && pair.length === 2 && pair.every(item => typeof item === 'string')
  )
}

function hasLabels(spec) {
  return Array.isArray(spec?.labels) && spec.labels.every(item => typeof item === 'string')
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

function hasGridSpec(spec) {
  return spec?.gridSpec && Number(spec.gridSpec.cols || 0) > 0 && Number(spec.gridSpec.rows || 0) > 0
}

export function validateGeometryDiagramSpec(spec, questionNumber = 0) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { valid: false, reason: 'diagramSpec must be an object' }
  }
  const type = String(spec.type || '')
  if (type === 'none') return { valid: false, reason: 'diagramSpec type is none' }
  if (type === 'template') {
    return KNOWN_TEMPLATES.has(String(spec.templateId || ''))
      ? { valid: true }
      : { valid: false, reason: 'template diagram requires a known templateId' }
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
  if (type === 'fence_area') return { valid: true }
  const fallback = fallbackGeometrySpec(questionNumber)
  return fallback ? { valid: false, reason: `unknown type ${type}` } : { valid: false, reason: `unsupported type ${type}` }
}

export function fallbackGeometrySpec(questionNumber = 0) {
  const spec = GEOMETRY_FALLBACKS[Number(questionNumber)]
  return spec ? JSON.parse(JSON.stringify(spec)) : null
}

export function normalizeGeometryDiagramSpec(spec, questionNumber = 0) {
  if (LOCKED_TEMPLATE_QUESTIONS.has(Number(questionNumber))) {
    const fallback = fallbackGeometrySpec(questionNumber)
    return {
      spec: fallback,
      source: 'locked-template',
      validation: { valid: true, reason: 'locked to professional template' }
    }
  }
  const result = validateGeometryDiagramSpec(spec, questionNumber)
  if (result.valid) return { spec, source: 'ai', validation: result }
  const fallback = fallbackGeometrySpec(questionNumber)
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

function renderTemplateDiagram(doc, spec, box) {
  if (spec.templateId === 'triangle_ruler_overlap_angle') return renderTriangleRulerOverlapAngle(doc, box)
  if (spec.templateId === 'congruent_triangles_on_line') return renderCongruentTrianglesOnLine(doc, box)
  if (spec.templateId === 'parallel_lines_transversal') return renderParallelLinesTransversal(doc, box)
  if (spec.templateId === 'grid_triangle_construction') return renderGridTriangleConstruction(doc, box)
  if (spec.templateId === 'angle_bisector_rays') return renderAngleBisectorRays(doc, box)
  return 0
}

export function renderGeometryDiagram(doc, diagramSpec, options = {}) {
  const normalized = normalizeGeometryDiagramSpec(diagramSpec, options.questionNumber)
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
  else height = renderGenericGeometry(doc, spec, box)
  return { height, source: normalized.source, validation: normalized.validation }
}
