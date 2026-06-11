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

const SEMANTIC_DIAGRAM_TYPES = new Set([
  'TRIANGLE_ANGLE_SUM',
  'ISOSCELES_TRIANGLE',
  'RIGHT_TRIANGLE',
  'CONGRUENT_TRIANGLES',
  'PARALLEL_LINES_ANGLE',
  'TRIANGLE_AUXILIARY_LINE',
  'CIRCLE_INSCRIBED_ANGLE'
])

const DEFAULT_DIAGRAM_BOX = { width: 320, height: 180, padding: 24 }

function semanticTypeOf(spec = {}) {
  return String(spec.diagramType || spec.templateType || '').trim().toUpperCase()
}

function pointLabel(value, fallback) {
  const text = String(value || '').trim()
  return /^[A-Za-z][A-Za-z0-9]?$/.test(text) ? text : fallback
}

function labelFromItem(item, fallback = '') {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') return String(item.text || item.label || item.value || item.point || item.name || fallback).trim()
  return fallback
}

function safeAngleLabel(value) {
  const normalized = String(value || '')
    .replace(/\\angle\s*(\d+)/gi, '∠$1')
    .replace(/angle\s*(\d+)/gi, '∠$1')
    .replace(/\s*=\s*/g, '=')
    .replace(/\bdegrees?\b/gi, '°')
    .replace(/\\circ\b/g, '掳')
    .replace(/\^掳/g, '掳')
    .trim()
  return normalized
  return String(value || '').replace(/\\circ\b/g, '°').replace(/\^°/g, '°').trim()
}

function semanticDiagramBox(spec = {}) {
  const box = spec.diagramBox && typeof spec.diagramBox === 'object' ? spec.diagramBox : {}
  return {
    width: Number(box.width || DEFAULT_DIAGRAM_BOX.width),
    height: Number(box.height || DEFAULT_DIAGRAM_BOX.height),
    padding: Number(box.padding || box.margin || DEFAULT_DIAGRAM_BOX.padding),
    marginTop: Number(box.marginTop || 12),
    marginBottom: Number(box.marginBottom || 16)
  }
}

function withSemanticMeta(spec, resolved, diagramType) {
  return {
    ...resolved,
    diagramType,
    diagramBox: semanticDiagramBox(spec),
    renderer: 'template'
  }
}

function triangleLabels(vertices = []) {
  const [a, b, c] = vertices
  return [
    { point: a, text: a, offset: [-12, -10] },
    { point: b, text: b, offset: [12, 8] },
    { point: c, text: c, offset: [-12, 8] }
  ]
}

function angleMarksFromParams(params = {}, vertices = []) {
  const source = params.angles || params.knownAngles || {}
  if (Array.isArray(source)) {
    return source.map(item => ({
      point: pointLabel(item.point || item.vertex, ''),
      label: safeAngleLabel(item.value || item.label || item.text)
    })).filter(item => item.point && item.label)
  }
  return Object.entries(source)
    .map(([point, value]) => ({ point: pointLabel(point, ''), label: safeAngleLabel(value) }))
    .filter(item => item.point && item.label && vertices.includes(item.point))
}

function sideLabelsFromParams(params = {}) {
  const source = params.sideLabels || params.lengthLabels || []
  if (!Array.isArray(source)) return []
  return source.map(item => {
    const segment = segmentFromValue(item.segment || [item.from, item.to])
    const label = safeAngleLabel(labelFromItem(item))
    return segment && label ? { segment, label } : null
  }).filter(Boolean)
}

function buildTriangleAngleSumSpec(spec, diagramType) {
  const params = spec.params || {}
  const vertices = (Array.isArray(params.vertices) ? params.vertices : ['A', 'B', 'C'])
    .map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
  const [a, b, c] = vertices
  return withSemanticMeta(spec, {
    type: 'generic_geometry',
    points: { [a]: [160, 24], [b]: [36, 142], [c]: [284, 142] },
    segments: [[a, b], [b, c], [c, a]],
    labels: triangleLabels(vertices),
    angleLabels: angleMarksFromParams(params, vertices),
    lengthLabels: sideLabelsFromParams(params)
  }, diagramType)
}

function buildIsoscelesTriangleSpec(spec, diagramType) {
  const params = spec.params || {}
  const a = pointLabel(params.topPoint || params.apex || params.vertices?.[0], 'A')
  const b = pointLabel(params.leftPoint || params.baseLeft || params.vertices?.[1], 'B')
  const c = pointLabel(params.rightPoint || params.baseRight || params.vertices?.[2], 'C')
  const vertices = [a, b, c]
  const equalSides = Array.isArray(params.equalSides) && params.equalSides.length
    ? params.equalSides.map(segmentFromValue).filter(hasSegmentPair)
    : [[a, b], [a, c]]
  return withSemanticMeta(spec, {
    type: 'generic_geometry',
    points: { [a]: [160, 22], [b]: [52, 146], [c]: [268, 146] },
    segments: [[a, b], [b, c], [c, a]],
    labels: triangleLabels(vertices),
    equalMarks: equalSides,
    angleLabels: angleMarksFromParams(params, vertices),
    lengthLabels: sideLabelsFromParams(params)
  }, diagramType)
}

function buildRightTriangleSpec(spec, diagramType) {
  const params = spec.params || {}
  const vertices = (Array.isArray(params.vertices) ? params.vertices : ['A', 'B', 'C'])
    .map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
  const [a, b, c] = vertices
  const right = pointLabel(params.rightAngleAt || params.rightAngle || c, c)
  const points = {}
  if (right === a) {
    points[a] = [56, 142]
    points[b] = [272, 142]
    points[c] = [56, 34]
  } else if (right === b) {
    points[a] = [56, 142]
    points[b] = [272, 142]
    points[c] = [272, 34]
  } else {
    points[a] = [56, 34]
    points[b] = [272, 142]
    points[c] = [56, 142]
  }
  const arms = vertices.filter(vertex => vertex !== right)
  return withSemanticMeta(spec, {
    type: 'generic_geometry',
    points,
    segments: [[a, b], [b, c], [c, a]],
    labels: triangleLabels(vertices),
    rightAngleMarks: [{ vertex: right, points: [arms[0], right, arms[1]] }],
    angleLabels: angleMarksFromParams(params, vertices),
    lengthLabels: sideLabelsFromParams(params)
  }, diagramType)
}

function buildCongruentTrianglesSpec(spec, diagramType) {
  const params = spec.params || {}
  const left = (Array.isArray(params.leftTriangle) ? params.leftTriangle : ['A', 'B', 'C'])
    .map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
  const right = (Array.isArray(params.rightTriangle) ? params.rightTriangle : ['D', 'E', 'F'])
    .map((value, index) => pointLabel(value, ['D', 'E', 'F'][index]))
  const [a, b, c] = left
  const [d, e, f] = right
  const equalMarks = Array.isArray(params.equalSides) && params.equalSides.length
    ? params.equalSides.map(segmentFromValue).filter(hasSegmentPair)
    : [[a, b], [d, e], [b, c], [e, f]]
  return withSemanticMeta(spec, {
    type: 'congruent_triangles',
    points: { [a]: [34, 142], [b]: [132, 142], [c]: [78, 42], [d]: [188, 142], [e]: [286, 142], [f]: [232, 42] },
    segments: [[a, b], [b, c], [c, a], [d, e], [e, f], [f, d]],
    labels: [...triangleLabels(left), ...triangleLabels(right)],
    equalMarks,
    angleLabels: angleMarksFromParams(params, [...left, ...right])
  }, diagramType)
}

function buildParallelLinesAngleSpec(spec, diagramType) {
  const params = spec.params || {}
  const labels = Array.isArray(params.points) && params.points.length >= 6
    ? params.points.map((value, index) => pointLabel(value, ['A', 'B', 'C', 'D', 'E', 'F'][index]))
    : ['A', 'B', 'C', 'D', 'E', 'F']
  const [a, b, c, d, e, f] = labels
  const angleLabels = Array.isArray(params.angles)
    ? params.angles.map((item, index) => ({
      point: pointLabel(item.point || item.vertex || [e, f][index] || e, [e, f][index] || e),
      label: safeAngleLabel(item.value || item.label || item.text || `∠${index + 1}`)
    }))
    : angleMarksFromParams(params, labels)
  return withSemanticMeta(spec, {
    type: 'parallel_lines',
    points: { [a]: [36, 52], [b]: [284, 52], [c]: [36, 132], [d]: [284, 132], [e]: [112, 18], [f]: [210, 166] },
    segments: [[a, b], [c, d], [e, f]],
    labels: [
      { point: a, text: a, offset: [-12, -8] },
      { point: b, text: b, offset: [12, -8] },
      { point: c, text: c, offset: [-12, 12] },
      { point: d, text: d, offset: [12, 12] },
      { point: e, text: e, offset: [-10, -12] },
      { point: f, text: f, offset: [10, 14] }
    ],
    parallelMarks: [[a, b], [c, d]],
    angleLabels
  }, diagramType)
}

function buildTriangleAuxiliaryLineSpec(spec, diagramType) {
  const params = spec.params || {}
  const vertices = (Array.isArray(params.vertices) ? params.vertices : ['A', 'B', 'C'])
    .map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
  const [a, b, c] = vertices
  const foot = pointLabel(params.footPoint || params.auxPoint || 'D', 'D')
  const lineKind = String(params.lineKind || params.auxiliaryType || 'altitude').toLowerCase()
  const points = { [a]: [160, 24], [b]: [42, 146], [c]: [278, 146], [foot]: [160, 146] }
  const segments = [[a, b], [b, c], [c, a], [a, foot]]
  const rightAngleMarks = lineKind.includes('height') || lineKind.includes('altitude') || lineKind.includes('perp')
    ? [{ vertex: foot, points: [a, foot, c] }]
    : []
  return withSemanticMeta(spec, {
    type: 'generic_geometry',
    points,
    segments,
    labels: [...triangleLabels(vertices), { point: foot, text: foot, offset: [0, 14] }],
    rightAngleMarks,
    perpendicularMarks: rightAngleMarks.length ? [{ at: foot, line1: [a, foot], line2: [b, c] }] : [],
    equalMarks: lineKind.includes('median') ? [[b, foot], [foot, c]] : [],
    angleLabels: angleMarksFromParams(params, [...vertices, foot])
  }, diagramType)
}

function buildCircleInscribedAngleSpec(spec, diagramType) {
  const params = spec.params || {}
  const center = pointLabel(params.center || params.centerPoint, 'O')
  const points = Array.isArray(params.points) && params.points.length >= 3
    ? params.points.map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
    : ['A', 'B', 'C']
  const [a, b, c] = points
  const diameter = Array.isArray(params.diameter) && params.diameter.length >= 2
    ? params.diameter.map((value, index) => pointLabel(value, [a, b][index]))
    : null
  const segments = Array.isArray(params.segments) && params.segments.length
    ? params.segments.map(segmentFromValue).filter(hasSegmentPair)
    : [[a, b], [a, c], [b, c]]
  if (diameter) {
    const hasDiameter = segments.some(pair =>
      (pair[0] === diameter[0] && pair[1] === diameter[1]) ||
      (pair[0] === diameter[1] && pair[1] === diameter[0])
    )
    if (!hasDiameter) segments.push(diameter)
  }
  const extraPointNames = points.slice(3)
  const extraCoords = [
    [232, 52],
    [88, 52],
    [232, 148],
    [88, 148]
  ]
  const extraPoints = Object.fromEntries(extraPointNames.map((name, index) => [name, extraCoords[index % extraCoords.length]]))
  const extraLabels = extraPointNames.map((name, index) => ({
    point: name,
    text: name,
    offset: index % 2 === 0 ? [10, -10] : [-14, -10]
  }))
  const angleLabels = angleMarksFromParams(params, [center, ...points]).map(item => {
    if (item.point === c) return { ...item, offset: [-18, 34] }
    if (item.point === extraPointNames[0]) return { ...item, offset: [24, 20] }
    if (extraPointNames.includes(item.point)) return { ...item, offset: [18, 24] }
    return item
  })
  return withSemanticMeta(spec, {
    type: 'circle_geometry',
    points: {
      [center]: [160, 100],
      [a]: [70, 100],
      [b]: [250, 100],
      [c]: [160, 10],
      ...extraPoints
    },
    circles: [{ center, through: a }],
    segments,
    labels: [
      { point: center, text: center, offset: [0, 14] },
      { point: a, text: a, offset: [-14, 2] },
      { point: b, text: b, offset: [10, 2] },
      { point: c, text: c, offset: [0, -14] },
      ...extraLabels
    ],
    angleLabels,
    lengthLabels: sideLabelsFromParams(params)
  }, diagramType)
}

export function resolveSemanticDiagramSpec(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec
  const diagramType = semanticTypeOf(spec)
  if (!SEMANTIC_DIAGRAM_TYPES.has(diagramType)) return spec
  if (spec.type && !spec.params) return spec
  if (diagramType === 'TRIANGLE_ANGLE_SUM') return buildTriangleAngleSumSpec(spec, diagramType)
  if (diagramType === 'ISOSCELES_TRIANGLE') return buildIsoscelesTriangleSpec(spec, diagramType)
  if (diagramType === 'RIGHT_TRIANGLE') return buildRightTriangleSpec(spec, diagramType)
  if (diagramType === 'CONGRUENT_TRIANGLES') return buildCongruentTrianglesSpec(spec, diagramType)
  if (diagramType === 'PARALLEL_LINES_ANGLE') return buildParallelLinesAngleSpec(spec, diagramType)
  if (diagramType === 'TRIANGLE_AUXILIARY_LINE') return buildTriangleAuxiliaryLineSpec(spec, diagramType)
  if (diagramType === 'CIRCLE_INSCRIBED_ANGLE') return buildCircleInscribedAngleSpec(spec, diagramType)
  return spec
}

function isPoint(value) {
  return Array.isArray(value) && value.length >= 2 && value.every(item => Number.isFinite(Number(item)))
}

function hasPointMap(spec) {
  if (!spec?.points || typeof spec.points !== 'object' || Array.isArray(spec.points)) return false
  const values = Object.values(spec.points)
  return values.length > 0 && values.every(isPoint)
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

function validatePointReferences(spec = {}) {
  if (!hasPointMap(spec)) return { valid: true }
  const names = new Set(Object.keys(normalizePointMap(spec.points)))
  const bad = new Set()
  const check = value => {
    const name = String(value || '').trim()
    if (name && !names.has(name)) bad.add(name)
  }
  normalizeSegments(spec.segments).forEach(pair => pair.forEach(check))
  normalizeSegmentMarks(spec.parallelMarks).forEach(pair => pair.forEach(check))
  normalizeSegmentMarks(spec.equalMarks).forEach(pair => pair.forEach(check))
  ;(Array.isArray(spec.lengthLabels) ? spec.lengthLabels : []).forEach(item => {
    const pair = segmentFromValue(item.segment || [item.from, item.to])
    if (pair) pair.forEach(check)
  })
  ;(Array.isArray(spec.angleLabels) ? spec.angleLabels : []).forEach(item => check(item?.point || item?.vertex))
  ;(Array.isArray(spec.rightAngleMarks) ? spec.rightAngleMarks : []).forEach(mark => {
    check(mark?.vertex || mark?.at || mark?.intersection)
    ;(Array.isArray(mark?.points) ? mark.points : []).forEach(check)
    ;(Array.isArray(mark?.sides) ? mark.sides : []).forEach(segment => {
      const pair = segmentFromValue(segment)
      if (pair) pair.forEach(check)
    })
  })
  ;(Array.isArray(spec.perpendicularMarks) ? spec.perpendicularMarks : []).forEach(mark => {
    check(mark?.vertex || mark?.at || mark?.intersection)
    ;[mark?.line1, mark?.line2, mark?.segment1, mark?.segment2].forEach(segment => {
      const pair = segmentFromValue(segment)
      if (pair) pair.forEach(check)
    })
  })
  normalizeCircles(spec.circles).forEach(circle => {
    check(circle.center)
    if (circle.through) check(circle.through)
  })
  return bad.size
    ? { valid: false, reason: `diagramSpec references undefined point(s): ${[...bad].join(', ')}` }
    : { valid: true }
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

function normalizeLabelOffsets(spec = {}) {
  const offsets = { ...(spec.labelOffsets || {}) }
  const raw = Array.isArray(spec.labels) ? spec.labels : []
  raw.forEach(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    const pointName = String(item.point || item.name || item.id || '').trim()
    const offset = Array.isArray(item.offset)
      ? item.offset
      : (item.offset && typeof item.offset === 'object' ? [item.offset.x, item.offset.y] : [item.offsetX, item.offsetY])
    if (pointName && offset.length >= 2 && Number.isFinite(Number(offset[0])) && Number.isFinite(Number(offset[1]))) {
      offsets[pointName] = [Number(offset[0]), Number(offset[1])]
    }
  })
  return offsets
}

function normalizeSegmentMarks(marks = []) {
  if (!Array.isArray(marks)) return []
  return marks.map(segmentFromValue).filter(hasSegmentPair)
}

function normalizeCircles(circles = []) {
  if (!Array.isArray(circles)) return []
  return circles
    .map(circle => {
      if (!circle || typeof circle !== 'object' || Array.isArray(circle)) return null
      const center = String(circle.center || circle.centerPoint || '').trim()
      const through = String(circle.through || circle.throughPoint || '').trim()
      const radius = Number(circle.radius || 0)
      return center ? { center, through, radius } : null
    })
    .filter(Boolean)
}

export function normalizeDiagramSpecShape(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec
  const semantic = resolveSemanticDiagramSpec(spec)
  const normalized = {
    ...semantic,
    points: normalizePointMap(semantic.points),
    segments: normalizeSegments(semantic.segments),
    labels: normalizeLabels(semantic)
  }
  const labelOffsets = normalizeLabelOffsets(semantic)
  if (Object.keys(labelOffsets).length) normalized.labelOffsets = labelOffsets
  if (Array.isArray(semantic.parallelMarks)) normalized.parallelMarks = normalizeSegmentMarks(semantic.parallelMarks)
  if (Array.isArray(semantic.equalMarks)) normalized.equalMarks = normalizeSegmentMarks(semantic.equalMarks)
  if (Array.isArray(semantic.circles)) normalized.circles = normalizeCircles(semantic.circles)
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
  return Boolean(kind || spec.equation || spec.templateId) &&
    (!spec.axes || typeof spec.axes === 'object' || typeof spec.axes === 'boolean')
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
  if (SEMANTIC_DIAGRAM_TYPES.has(semanticTypeOf(spec)) && !spec.type) {
    return validateGeometryDiagramSpec(normalizeDiagramSpecShape(spec), questionNumber)
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
    const refs = validatePointReferences(spec)
    return hasGridSpec(spec) && hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && refs.valid
      ? { valid: true }
      : (!refs.valid ? refs : { valid: false, reason: 'grid diagram requires gridSpec, points, segments, labels' })
  }
  if (type === 'parallel_lines') {
    const refs = validatePointReferences(spec)
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && hasParallelMarks(spec) && refs.valid
      ? { valid: true }
      : (!refs.valid ? refs : { valid: false, reason: 'parallel diagram requires points, segments, labels, parallelMarks' })
  }
  if (type === 'congruent_triangles') {
    const refs = validatePointReferences(spec)
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && hasEqualMarks(spec) && refs.valid
      ? { valid: true }
      : (!refs.valid ? refs : { valid: false, reason: 'congruent diagram requires points, segments, labels, equalMarks' })
  }
  if (['triangle_ruler', 'generic_geometry', 'angle_bisector'].includes(type)) {
    const refs = validatePointReferences(spec)
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && refs.valid
      ? { valid: true }
      : (!refs.valid ? refs : { valid: false, reason: `${type} requires points, segments, labels` })
  }
  if (type === 'circle_geometry') {
    const refs = validatePointReferences(spec)
    return hasPointMap(spec) && hasSegments(spec) && hasLabels(spec) && Array.isArray(spec.circles) && spec.circles.length > 0 && refs.valid
      ? { valid: true }
      : (!refs.valid ? refs : { valid: false, reason: 'circle_geometry requires circles, points, segments, labels' })
  }
  if (type === 'analytic_curve') {
    const refs = validatePointReferences(spec)
    return hasAnalyticCurveSpec(spec) && refs.valid
      ? { valid: true }
      : (!refs.valid ? refs : { valid: false, reason: 'analytic_curve requires curveKind or equation and optional axes/points/lines' })
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

function fitDiagramSpecToBox(spec = {}, box = {}) {
  const points = normalizePointMap(spec.points)
  const entries = Object.entries(points)
  if (!entries.length) return spec
  const xs = entries.map(([, value]) => Number(value[0]))
  const ys = entries.map(([, value]) => Number(value[1]))
  for (const circle of normalizeCircles(spec.circles)) {
    const center = points[circle.center]
    if (!center) continue
    let radius = Number(circle.radius || 0)
    if ((!Number.isFinite(radius) || radius <= 0) && circle.through && points[circle.through]) {
      const through = points[circle.through]
      radius = Math.hypot(Number(through[0]) - Number(center[0]), Number(through[1]) - Number(center[1]))
    }
    if (!Number.isFinite(radius) || radius <= 0) continue
    xs.push(Number(center[0]) - radius, Number(center[0]) + radius)
    ys.push(Number(center[1]) - radius, Number(center[1]) + radius)
  }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const sourceWidth = Math.max(1, maxX - minX)
  const sourceHeight = Math.max(1, maxY - minY)
  const padX = Number(box.padX || 14)
  const padY = Number(box.padY || 14)
  const targetWidth = Math.max(1, Number(box.width || 260) - padX * 2)
  const targetHeight = Math.max(1, Number(box.height || 110) - padY * 2)
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight) * Number(box.scale || 1)
  const drawingWidth = sourceWidth * scale
  const drawingHeight = sourceHeight * scale
  const originX = Number(box.x || 0) + padX + (targetWidth - drawingWidth) / 2
  const originY = Number(box.y || 0) + padY + (targetHeight - drawingHeight) / 2
  return {
    ...spec,
    points: Object.fromEntries(entries.map(([name, value]) => [
      name,
      [
        originX + (Number(value[0]) - minX) * scale,
        originY + (Number(value[1]) - minY) * scale
      ]
    ]))
  }
}

function drawLabels(doc, spec, box) {
  const labels = spec.labels || Object.keys(spec.points || {})
  const pointValues = Object.values(spec.points || {})
  const center = pointValues.length
    ? [
        pointValues.reduce((sum, value) => sum + Number(value[0] || 0), 0) / pointValues.length,
        pointValues.reduce((sum, value) => sum + Number(value[1] || 0), 0) / pointValues.length
      ]
    : [0, 0]
  for (const label of labels) {
    const [x, y] = point(spec, label, box)
    const configured = spec.labelOffsets?.[label]
    const raw = spec.points?.[label] || [0, 0]
    const fallback = [
      Number(raw[0] || 0) < center[0] ? -12 : (Number(raw[0] || 0) > center[0] ? 12 : 0),
      Number(raw[1] || 0) < center[1] ? -12 : 14
    ]
    const [dx, dy] = configured || fallback
    doc.fontSize(8.5).fillColor('#111111').text(label, x + dx - 8, y + dy - 5, { width: 16, align: 'center', lineBreak: false })
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

function drawCircles(doc, spec, box) {
  const circles = Array.isArray(spec.circles) ? spec.circles : []
  if (!circles.length) return
  doc.save().strokeColor('#111111').lineWidth(1.05)
  for (const circle of circles) {
    const centerName = String(circle.center || '').trim()
    if (!centerName || !spec.points?.[centerName]) continue
    const [cx, cy] = point(spec, centerName, box)
    let radius = Number(circle.radius || 0) * Number(box.scale || 1)
    const through = String(circle.through || '').trim()
    if ((!Number.isFinite(radius) || radius <= 0) && through && spec.points?.[through]) {
      const [tx, ty] = point(spec, through, box)
      radius = Math.hypot(tx - cx, ty - cy)
    }
    if (!Number.isFinite(radius) || radius <= 0) continue
    doc.circle(cx, cy, radius).stroke()
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

function drawAngleLabels(doc, spec, box) {
  const labels = Array.isArray(spec.angleLabels) ? spec.angleLabels : []
  if (!labels.length) return
  const pointValues = Object.values(spec.points || {})
  const center = pointValues.length
    ? [
        pointValues.reduce((sum, value) => sum + Number(value[0] || 0), 0) / pointValues.length,
        pointValues.reduce((sum, value) => sum + Number(value[1] || 0), 0) / pointValues.length
      ]
    : [0, 0]
  doc.save().fillColor('#111111')
  labels.forEach(item => {
    const name = String(item.point || item.vertex || '').trim()
    const label = safeAngleLabel(item.label || item.value || item.text || '')
    if (!name || !label || !spec.points?.[name]) return
    const [x, y] = point(spec, name, box)
    const raw = spec.points[name]
    const inward = [center[0] - Number(raw[0] || 0), center[1] - Number(raw[1] || 0)]
    const length = Math.hypot(inward[0], inward[1]) || 1
    const offset = Array.isArray(item.offset) && item.offset.length >= 2
      ? [Number(item.offset[0]), Number(item.offset[1])]
      : null
    const tx = offset ? x + offset[0] - 18 : x + (inward[0] / length) * 30 - 18
    const ty = offset ? y + offset[1] - 7 : y + (inward[1] / length) * 30 - 7
    doc.save().fillColor('#FFFFFF').opacity(0.78).roundedRect(tx - 2, ty - 1, 40, 14, 2).fill().restore()
    doc.fillColor('#111111').fontSize(9.5).text(label, tx, ty, {
      width: 36,
      align: 'center',
      lineBreak: false
    })
  })
  doc.restore()
}

function drawLengthLabels(doc, spec, box) {
  const labels = Array.isArray(spec.lengthLabels) ? spec.lengthLabels : []
  if (!labels.length) return
  doc.save().fillColor('#111111')
  labels.forEach(item => {
    const pair = segmentFromValue(item.segment || [item.from, item.to])
    const label = safeAngleLabel(labelFromItem(item))
    if (!pair || !label || !spec.points?.[pair[0]] || !spec.points?.[pair[1]]) return
    const [x, y] = midpoint(spec, pair, box)
    const tx = x - 18
    const ty = y - 15
    doc.save().fillColor('#FFFFFF').opacity(0.78).roundedRect(tx - 2, ty - 1, 40, 14, 2).fill().restore()
    doc.fillColor('#111111').fontSize(9.5).text(label, tx, ty, { width: 36, align: 'center', lineBreak: false })
  })
  doc.restore()
}

function pointOtherThan(segment, vertex) {
  const pair = segmentFromValue(segment)
  if (!pair) return ''
  return pair[0] === vertex ? pair[1] : pair[0]
}

function drawRightAndPerpendicularMarks(doc, spec, box) {
  const marks = [
    ...(Array.isArray(spec.rightAngleMarks) ? spec.rightAngleMarks : []),
    ...(Array.isArray(spec.perpendicularMarks) ? spec.perpendicularMarks : [])
  ]
  if (!marks.length) return
  const localPoint = name => point(spec, name, box)
  doc.save().strokeColor('#111111').lineWidth(0.8)
  marks.forEach(mark => {
    if (!mark || typeof mark !== 'object') return
    const vertex = String(mark.vertex || mark.at || mark.intersection || '').trim()
    let armA = ''
    let armB = ''
    if (Array.isArray(mark.points) && mark.points.length >= 3) {
      armA = String(mark.points[0])
      armB = String(mark.points[2])
    } else if (Array.isArray(mark.sides) && mark.sides.length >= 2) {
      armA = pointOtherThan(mark.sides[0], vertex)
      armB = pointOtherThan(mark.sides[1], vertex)
    } else {
      const line1 = Array.isArray(mark.line1) ? mark.line1 : segmentFromValue(mark.segment1)
      const line2 = Array.isArray(mark.line2) ? mark.line2 : segmentFromValue(mark.segment2)
      armA = line1?.find(name => name !== vertex) || ''
      armB = line2?.find(name => name !== vertex) || ''
    }
    if (vertex && armA && armB && spec.points?.[vertex] && spec.points?.[armA] && spec.points?.[armB]) {
      drawRightAngleMark(doc, localPoint(vertex), localPoint(armA), localPoint(armB), Number(mark.size || 8))
    }
  })
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
  const fitted = fitDiagramSpecToBox(spec, box)
  const localBox = { x: 0, y: 0, scale: 1 }
  drawCircles(doc, fitted, localBox)
  drawSegments(doc, fitted, localBox)
  drawRelationMarks(doc, fitted, localBox)
  drawRightAndPerpendicularMarks(doc, fitted, localBox)
  drawLengthLabels(doc, fitted, localBox)
  drawAngleLabels(doc, fitted, localBox)
  drawLabels(doc, fitted, localBox)
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

function compactEquation(spec = {}) {
  return String(spec.equation || '').replace(/\s+/g, '').toLowerCase()
}

function ellipseAxisFromEquation(equation, axis) {
  const match = equation.match(new RegExp(`${axis}\\\\^2/([0-9.]+)`, 'i'))
  return match ? Math.sqrt(Number(match[1])) : 0
}

function parabolaParameterFromEquation(equation) {
  const right = equation.match(/y\^2=([0-9.]+)\*?x/i)
  if (right) return Number(right[1]) / 4
  const up = equation.match(/x\^2=([0-9.]+)\*?y/i)
  if (up) return Number(up[1]) / 4
  return 0
}

function analyticPointNames(spec = {}) {
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
  normalizeSegments(spec.segments).forEach(pair => pair.forEach(name => names.add(name)))
  ;(Array.isArray(spec.lengthLabels) ? spec.lengthLabels : []).forEach(item => {
    const pair = segmentFromValue(item.segment || [item.from, item.to])
    if (pair) pair.forEach(name => names.add(name))
  })
  ;(Array.isArray(spec.angleLabels) ? spec.angleLabels : []).forEach(item => {
    const pointName = String(item?.point || item?.vertex || '').trim()
    if (pointName) names.add(pointName)
  })
  return [...names].filter(Boolean)
}

function deriveAnalyticPointMap(spec = {}, { kind, a, b, p, opensRight = false } = {}) {
  const explicit = normalizePointMap(spec.points)
  if (Object.keys(explicit).length) return explicit
  const names = analyticPointNames(spec)
  if (!names.length) return explicit
  const c = Math.sqrt(Math.max((a * a) - (b * b), 0))
  const defaults = kind === 'parabola'
    ? (opensRight
        ? {
            O: [0, 0],
            F: [p, 0],
            P: [2 * p, 2 * p],
            A: [2 * p, 2.8 * p],
            B: [2 * p, -2.8 * p]
          }
        : {
            O: [0, 0],
            F: [0, p],
            P: [2 * p, p],
            A: [-2 * p, p],
            B: [2 * p, p]
          })
    : {
        O: [0, 0],
        F1: [-c, 0],
        F2: [c, 0],
        F: [c, 0],
        P: [a * 0.6, b * 0.8],
        A: [-a, 0],
        B: [a, 0],
        C: [0, b],
        D: [a * 0.62, b * 0.78]
      }
  return Object.fromEntries(names
    .filter(name => defaults[name])
    .map(name => [name, defaults[name]]))
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
  const equation = compactEquation(spec)
  const equationA = ellipseAxisFromEquation(equation, 'x')
  const equationB = ellipseAxisFromEquation(equation, 'y')
  const opensRight = kind === 'parabola' && /y\^2=/.test(equation)
  const a = Number(spec.axes?.a || spec.parameters?.a || equationA || (kind === 'parabola' ? 1 : 3))
  const b = Number(spec.axes?.b || spec.parameters?.b || equationB || 2)
  const p = Number(spec.parameters?.p || spec.focusParameter || parabolaParameterFromEquation(equation) || 1)
  const analyticPoints = deriveAnalyticPointMap(spec, { kind, a, b, p, opensRight })

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
      if (analyticPoints[label]) return
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
  } else if (opensRight) {
    const points = []
    for (let i = -44; i <= 44; i += 1) {
      const y = i / 10
      points.push([(y * y) / (4 * p), y])
    }
    trace(points)
    const [fx, fy] = toPx(p, 0)
    doc.circle(fx, fy, 2.3).fill('#111111')
    doc.fontSize(8).text('F', fx + 4, fy - 6, { width: 12, lineBreak: false })
    const [dx1, dy1] = toPx(-p, -4.2)
    const [dx2, dy2] = toPx(-p, 4.2)
    doc.save().dash(3, { space: 3 }).moveTo(dx1, dy1).lineTo(dx2, dy2).stroke().undash().restore()
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

  const overlaySpec = {
    ...spec,
    points: Object.fromEntries(Object.entries(analyticPoints).map(([label, value]) => [label, toPx(value[0], value[1])])),
    segments: normalizeSegments(spec.segments),
    labels: normalizeLabels({ ...spec, points: analyticPoints })
  }
  const overlayBox = { x: 0, y: 0, scale: 1 }
  if (overlaySpec.segments.length) drawSegments(doc, overlaySpec, overlayBox)
  drawLengthLabels(doc, overlaySpec, overlayBox)
  drawAngleLabels(doc, overlaySpec, overlayBox)
  Object.entries(analyticPoints).forEach(([label, value]) => {
    const [px, py] = toPx(value[0], value[1])
    doc.circle(px, py, 2.4).fill('#111111')
  })
  drawLabels(doc, overlaySpec, overlayBox)
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

function solidMarkSegments(spec = {}) {
  const segments = normalizeSegments(spec.segments)
  ;(Array.isArray(spec.marks) ? spec.marks : []).forEach(mark => {
    const points = Array.isArray(mark?.points) ? mark.points.map(String).filter(Boolean) : []
    if (points.length >= 3) {
      segments.push([points[0], points[1]], [points[1], points[2]])
    }
  })
  return segments
}

function augmentSolidVertices(vertices = {}, spec = {}) {
  const next = { ...vertices }
  const labels = Array.isArray(spec.labels) ? spec.labels.map(String) : []
  const markNames = (Array.isArray(spec.marks) ? spec.marks : [])
    .flatMap(mark => Array.isArray(mark?.points) ? mark.points : [mark?.vertex])
    .map(String)
  const wantsO = [...labels, ...markNames].some(name => name === 'O')
  if (wantsO && !next.O && next.B && next.D) {
    next.O = [
      (Number(next.B[0]) + Number(next.D[0])) / 2,
      (Number(next.B[1]) + Number(next.D[1])) / 2,
      (Number(next.B[2] || 0) + Number(next.D[2] || 0)) / 2
    ]
  }
  return next
}

function renderSolidDiagram(doc, spec, box) {
  const explicitVertices = normalizePointMap(spec.vertices || spec.points)
  const fallback = defaultSolidSpec(spec)
  const baseVertices = Object.keys(explicitVertices).length
    ? explicitVertices
    : normalizePointMap(fallback.vertices || fallback.points)
  const vertices = augmentSolidVertices(baseVertices, spec)
  const edges = Array.isArray(spec.edges) && spec.edges.length ? spec.edges : fallback.edges
  const hiddenEdges = Array.isArray(spec.hiddenEdges) ? spec.hiddenEdges : (fallback.hiddenEdges || [])
  const labels = Array.isArray(spec.labels) && spec.labels.length ? spec.labels : (fallback.labels || Object.keys(vertices))
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
  const auxiliary = solidMarkSegments(spec)
  if (auxiliary.length) {
    doc.save().strokeColor('#111111').lineWidth(0.95)
    auxiliary.forEach(([a, b]) => {
      if (!p[a] || !p[b]) return
      doc.moveTo(...p[a]).lineTo(...p[b]).stroke()
    })
    doc.restore()
  }

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
