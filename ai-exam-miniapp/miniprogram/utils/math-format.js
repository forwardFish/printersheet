function cleanText(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/：\s*/g, '：')
    .trim()
}

function displayMathSymbols(value = '') {
  return String(value || '')
    .replace(/\$+/g, '')
    .replace(/\^\\circ\b/g, '°')
    .replace(/\\circ\b/g, '°')
    .replace(/\\parallel\b/g, '∥')
    .replace(/\\perp\b/g, '⊥')
    .replace(/\\triangle\b|\\Delta\b/g, '△')
    .replace(/\\angle\b/g, '∠')
    .replace(/\\times\b/g, '×')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√$1')
    .replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\s+/g, ' ')
    .trim()
}

const SUPERSCRIPT_CHARS = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  i: 'ⁱ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  n: 'ⁿ',
  o: 'ᵒ',
  p: 'ᵖ',
  r: 'ʳ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ'
}

function toSuperscript(value = '') {
  const source = String(value || '')
  const chars = source.split('')
  if (!chars.length) return ''
  if (!chars.every(char => SUPERSCRIPT_CHARS[char])) return `^${source}`
  return chars.map(char => SUPERSCRIPT_CHARS[char]).join('')
}

function isMathChar(char) {
  return /[A-Za-z0-9+\-*/×÷=^().{}|｜→<>≤≥≈√\\\s]/.test(char || '')
}

function isMeaningfulMath(value = '') {
  const text = value.trim()
  if (text.length < 2) return false
  if (!/[A-Za-z0-9]/.test(text)) return false
  return /[=+\-*/×÷|｜→<>≤≥≈^]/.test(text)
}

function toDisplayMath(value = '') {
  return String(value || '')
    .replace(/->|=>/g, '→')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√$1')
    .replace(/sqrt\(([^()]+)\)/gi, '√$1')
    .replace(/sqrt\s*([0-9A-Za-z]+)/gi, '√$1')
    .replace(/\^\{([^{}]+)\}/g, (_, exp) => toSuperscript(exp))
    .replace(/\^\(([^()]+)\)/g, (_, exp) => toSuperscript(`(${exp})`))
    .replace(/\^([+\-]?\d+)/g, (_, exp) => toSuperscript(exp))
    .replace(/\^([A-Za-z])/g, (_, exp) => toSuperscript(exp))
    .replace(/\*/g, '×')
    .replace(/\//g, '⁄')
    .replace(/\|/g, '｜')
    .replace(/([A-Za-z])\s*=\s*/g, '$1 = ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*([+\-×÷≈<>≥≤])\s*/g, ' $1 ')
    .replace(/\s*→\s*/g, ' → ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toLatexSource(value = '') {
  return String(value || '')
    .replace(/->|=>/g, '\\Rightarrow ')
    .replace(/\*/g, '\\times ')
    .replace(/\|([^|｜]+)[|｜]/g, '\\left|$1\\right|')
    .replace(/([A-Za-z0-9()+\-]+)\/([A-Za-z0-9()+\-]+)/g, '\\frac{$1}{$2}')
    .trim()
}

function splitMathParts(text = '') {
  const source = cleanText(text)
  if (!source) return []
  const parts = []
  let cursor = 0
  while (cursor < source.length) {
    if (isMathChar(source[cursor])) {
      let end = cursor
      while (end < source.length && isMathChar(source[end])) end += 1
      const raw = source.slice(cursor, end)
      const trimmed = raw.trim()
      if (isMeaningfulMath(trimmed)) {
        parts.push({
          type: 'math',
          text: toDisplayMath(trimmed),
          latex: toLatexSource(trimmed)
        })
      } else if (raw) {
        parts.push({ type: 'text', text: raw })
      }
      cursor = end
      continue
    }
    let end = cursor
    while (end < source.length && !isMathChar(source[end])) end += 1
    const raw = source.slice(cursor, end)
    if (raw) parts.push({ type: 'text', text: raw })
    cursor = end
  }
  const normalized = parts.length ? parts : [{ type: 'text', text: source }]
  return normalized.map((part, index) => ({ ...part, id: `${index}` }))
}

function splitExplanationSteps(text = '') {
  const source = cleanText(text)
  if (!source) return []
  const rough = source
    .replace(/([。；;])\s*/g, '$1\n')
    .replace(/(→)\s*/g, '$1\n')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
  const steps = []
  for (const item of rough) {
    if (item.length > 42 && /，/.test(item)) {
      steps.push(...item.split(/(?<=，)/).map(part => part.trim()).filter(Boolean))
    } else {
      steps.push(item)
    }
  }
  return steps.map((step, index) => ({
    id: `${index + 1}`,
    parts: splitMathParts(step)
  }))
}

function structuredStepText(step) {
  if (typeof step === 'string' || typeof step === 'number') return String(step)
  if (!step || typeof step !== 'object' || Array.isArray(step)) return ''
  return String(step.text || step.content || step.statement || step.reason || step.latex || '').trim()
}

function normalizeStructuredSteps(value) {
  if (!Array.isArray(value)) return []
  return value.map(structuredStepText).map(cleanText).filter(Boolean)
}

function stepsForQuestion(question = {}) {
  const structured = normalizeStructuredSteps(question.explanationSteps)
  const proof = normalizeStructuredSteps(question.proofSteps)
  const steps = structured.length ? structured : (proof.length ? proof : splitExplanationSteps(question.explanationLatex || question.explanation).map(step => step.parts.map(part => part.text).join('')))
  return steps.map((step, index) => ({
    id: `${index + 1}`,
    parts: splitMathParts(step)
  }))
}

function withLatexText(text = '', latex = '') {
  const base = String(text || '').trim()
  const formula = toDisplayMath(latex || '')
  if (!formula) return base
  const compactBase = splitMathParts(base).map(part => part.text).join('').replace(/\s+/g, '')
  const compactFormula = formula.replace(/\s+/g, '')
  return compactBase.includes(compactFormula) ? base : `${base} ${formula}`
}

function buildNumberLineView(spec = {}) {
  const min = Number(spec.axis && spec.axis.min)
  const max = Number(spec.axis && spec.axis.max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null
  const range = max - min
  const ticks = []
  const count = Math.min(9, Math.max(3, Math.round(range) + 1))
  for (let i = 0; i < count; i += 1) {
    const value = min + (range * i) / (count - 1)
    ticks.push({ id: `${i}`, label: `${Math.round(value * 10) / 10}`, left: `${(i / (count - 1)) * 100}%` })
  }
  const labels = Object.entries(spec.points || {}).map(([name, value]) => {
    const position = ((Number(value) - min) / range) * 100
    return { id: name, label: name, left: `${Math.max(0, Math.min(100, position))}%` }
  })
  return { type: 'number_line', ticks, labels }
}

function semanticTypeOf(spec = {}) {
  return String(spec.diagramType || spec.templateType || '').trim().toUpperCase()
}

function pointLabel(value, fallback) {
  const text = String(value || '').trim()
  return /^[A-Za-z][A-Za-z0-9]?$/.test(text) ? text : fallback
}

function safeAngleLabel(value) {
  return displayMathSymbols(String(value || '').replace(/\\circ\b/g, '°').replace(/\^°/g, '°'))
}

function labelOffset(point, text, offset) {
  return { point, label: text || point, offset: Array.isArray(offset) ? offset : [0, 0] }
}

function semanticAngles(params = {}, vertices = []) {
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

function resolveSemanticDiagramSpec(spec = {}) {
  const diagramType = semanticTypeOf(spec)
  const params = spec.params || {}
  if (diagramType === 'TRIANGLE_ANGLE_SUM') {
    const vertices = (Array.isArray(params.vertices) ? params.vertices : ['A', 'B', 'C']).map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
    const [a, b, c] = vertices
    return {
      ...spec,
      type: 'generic_geometry',
      points: { [a]: [160, 24], [b]: [36, 142], [c]: [284, 142] },
      segments: [[a, b], [b, c], [c, a]],
      labels: [labelOffset(a, a, [-12, -10]), labelOffset(b, b, [12, 8]), labelOffset(c, c, [-12, 8])],
      angleLabels: semanticAngles(params, vertices)
    }
  }
  if (diagramType === 'ISOSCELES_TRIANGLE') {
    const a = pointLabel(params.topPoint || params.apex || params.vertices?.[0], 'A')
    const b = pointLabel(params.leftPoint || params.baseLeft || params.vertices?.[1], 'B')
    const c = pointLabel(params.rightPoint || params.baseRight || params.vertices?.[2], 'C')
    return {
      ...spec,
      type: 'generic_geometry',
      points: { [a]: [160, 22], [b]: [52, 146], [c]: [268, 146] },
      segments: [[a, b], [b, c], [c, a]],
      labels: [labelOffset(a, a, [-12, -10]), labelOffset(b, b, [12, 8]), labelOffset(c, c, [-12, 8])],
      equalMarks: params.equalSides || [[a, b], [a, c]],
      angleLabels: semanticAngles(params, [a, b, c])
    }
  }
  if (diagramType === 'RIGHT_TRIANGLE') {
    const vertices = (Array.isArray(params.vertices) ? params.vertices : ['A', 'B', 'C']).map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
    const [a, b, c] = vertices
    return {
      ...spec,
      type: 'generic_geometry',
      points: { [a]: [56, 142], [b]: [272, 142], [c]: [56, 34] },
      segments: [[a, b], [b, c], [c, a]],
      labels: [labelOffset(a, a, [-12, 8]), labelOffset(b, b, [12, 8]), labelOffset(c, c, [-12, -10])],
      rightAngleMarks: [{ vertex: pointLabel(params.rightAngleAt || params.rightAngle || c, c) }],
      angleLabels: semanticAngles(params, vertices)
    }
  }
  if (diagramType === 'CONGRUENT_TRIANGLES') {
    const left = (Array.isArray(params.leftTriangle) ? params.leftTriangle : ['A', 'B', 'C']).map((value, index) => pointLabel(value, ['A', 'B', 'C'][index]))
    const right = (Array.isArray(params.rightTriangle) ? params.rightTriangle : ['D', 'E', 'F']).map((value, index) => pointLabel(value, ['D', 'E', 'F'][index]))
    const [a, b, c] = left
    const [d, e, f] = right
    return {
      ...spec,
      type: 'congruent_triangles',
      points: { [a]: [34, 142], [b]: [132, 142], [c]: [78, 42], [d]: [188, 142], [e]: [286, 142], [f]: [232, 42] },
      segments: [[a, b], [b, c], [c, a], [d, e], [e, f], [f, d]],
      labels: [...left, ...right],
      equalMarks: params.equalSides || [[a, b], [d, e], [b, c], [e, f]],
      angleLabels: semanticAngles(params, [...left, ...right])
    }
  }
  if (diagramType === 'PARALLEL_LINES_ANGLE') {
    const names = Array.isArray(params.points) && params.points.length >= 6
      ? params.points.map((value, index) => pointLabel(value, ['A', 'B', 'C', 'D', 'E', 'F'][index]))
      : ['A', 'B', 'C', 'D', 'E', 'F']
    const [a, b, c, d, e, f] = names
    return {
      ...spec,
      type: 'parallel_lines',
      points: { [a]: [36, 52], [b]: [284, 52], [c]: [36, 132], [d]: [284, 132], [e]: [112, 18], [f]: [210, 166] },
      segments: [[a, b], [c, d], [e, f]],
      labels: names,
      parallelMarks: [[a, b], [c, d]],
      angleLabels: Array.isArray(params.angles)
        ? params.angles.map((item, index) => ({ point: pointLabel(item.point || item.vertex || [e, f][index] || e, [e, f][index] || e), label: safeAngleLabel(item.value || item.label || item.text || `∠${index + 1}`) }))
        : semanticAngles(params, names)
    }
  }
  return spec
}

function buildGeometryView(spec = {}) {
  spec = resolveSemanticDiagramSpec(spec)
  const boxWidth = 360
  const boxHeight = 240
  const paddingX = 28
  const paddingY = 24
  const points = spec.points && typeof spec.points === 'object' ? spec.points : {}
  const entries = Object.entries(points)
    .filter(([, point]) => Array.isArray(point) && point.length >= 2)
    .map(([name, point]) => ({ name, x: Number(point[0]), y: Number(point[1]) }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (!entries.length) return null
  const minX = Math.min(...entries.map(point => point.x))
  const maxX = Math.max(...entries.map(point => point.x))
  const minY = Math.min(...entries.map(point => point.y))
  const maxY = Math.max(...entries.map(point => point.y))
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  const innerWidth = boxWidth - paddingX * 2
  const innerHeight = boxHeight - paddingY * 2
  const scale = Math.min(innerWidth / width, innerHeight / height)
  const drawingWidth = width * scale
  const drawingHeight = height * scale
  const originX = paddingX + (innerWidth - drawingWidth) / 2
  const originY = paddingY + (innerHeight - drawingHeight) / 2
  const normalized = {}
  entries.forEach(point => {
    normalized[point.name] = {
      x: originX + (point.x - minX) * scale,
      y: originY + (point.y - minY) * scale
    }
  })
  const segmentPair = value => {
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
  const segmentStyle = (pair, index) => {
    const a = normalized[pair[0]]
    const b = normalized[pair[1]]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    return {
      id: `${index}`,
      style: `left:${a.x}rpx;top:${a.y}rpx;width:${length}rpx;transform:rotate(${angle}deg);`
    }
  }
  const rawSegments = (Array.isArray(spec.segments) ? spec.segments : [])
    .map(segmentPair)
    .filter(pair => pair && normalized[pair[0]] && normalized[pair[1]])
  const segments = rawSegments.map(segmentStyle)
  const labelItems = Array.isArray(spec.labels) && spec.labels.length
    ? spec.labels.map((item, index) => {
      if (typeof item === 'string') return { id: item, point: item, label: item }
      const point = String(item.point || item.name || item.id || '').trim()
      const label = String(item.text || item.label || item.name || item.point || '').trim()
      return { id: `${point || label}-${index}`, point, label, offset: item.offset }
    }).filter(item => item.point && item.label)
    : entries.map(point => ({ id: point.name, point: point.name, label: point.name }))
  const labels = labelItems.filter(item => normalized[item.point]).map(item => {
    const pos = normalized[item.point]
    const offset = Array.isArray(item.offset) ? item.offset : [0, 0]
    return { id: item.id, label: item.label, style: `left:${pos.x + Number(offset[0] || 0)}rpx;top:${pos.y + Number(offset[1] || 0)}rpx;` }
  })
  const marks = []
  ;(Array.isArray(spec.perpendicularMarks) ? spec.perpendicularMarks : []).forEach((mark, index) => {
    const at = String(mark.at || mark.vertex || mark.intersection || '').trim()
    if (at && normalized[at]) marks.push({ id: `perp-${index}`, style: `left:${normalized[at].x}rpx;top:${normalized[at].y}rpx;` })
  })
  ;(Array.isArray(spec.rightAngleMarks) ? spec.rightAngleMarks : []).forEach((mark, index) => {
    const at = String(mark.vertex || '').trim()
    if (at && normalized[at]) marks.push({ id: `right-${index}`, style: `left:${normalized[at].x}rpx;top:${normalized[at].y}rpx;` })
  })
  const lengthLabels = (Array.isArray(spec.lengthLabels) ? spec.lengthLabels : [])
    .map((item, index) => {
      const pair = segmentPair(item.segment || [item.from, item.to])
      if (!pair || !normalized[pair[0]] || !normalized[pair[1]]) return null
      const a = normalized[pair[0]]
      const b = normalized[pair[1]]
      return {
        id: `${index}`,
        text: displayMathSymbols(item.label || item.value || item.text || ''),
        style: `left:${(a.x + b.x) / 2}rpx;top:${(a.y + b.y) / 2}rpx;`
      }
    })
    .filter(Boolean)
  const angleLabels = (Array.isArray(spec.angleLabels) ? spec.angleLabels : [])
    .map((item, index) => {
      const at = String(item.point || item.vertex || '').trim()
      if (!at || !normalized[at]) return null
      return {
        id: `angle-${index}`,
        text: safeAngleLabel(item.label || item.value || item.text || ''),
        style: `left:${normalized[at].x + 18}rpx;top:${normalized[at].y + 18}rpx;`
      }
    })
    .filter(item => item && item.text)
  return segments.length ? { type: 'geometry', segments, labels, marks, lengthLabels, angleLabels } : null
}

function buildDiagramView(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  spec = resolveSemanticDiagramSpec(spec)
  if (spec.type === 'number_line') return buildNumberLineView(spec)
  return buildGeometryView(spec)
}

function buildTableView(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  const headers = Array.isArray(spec.headers) ? spec.headers.map(item => String(item || '')) : []
  const rows = Array.isArray(spec.rows)
    ? spec.rows.map(row => Array.isArray(row) ? row.map(item => String(item || '')) : Object.values(row || {}).map(item => String(item || ''))).filter(row => row.length)
    : []
  if (!headers.length && !rows.length) return null
  return { headers, rows }
}

function enrichQuestionMath(question = {}) {
  return {
    ...question,
    displayQuestion: displayMathSymbols(question.question),
    displayAnswer: displayMathSymbols(question.answer),
    displayExplanation: displayMathSymbols(question.explanation),
    questionParts: splitMathParts(withLatexText(question.question, question.questionLatex)),
    answerParts: splitMathParts(withLatexText(question.answer, question.answerLatex)),
    explanationSteps: stepsForQuestion(question),
    diagramView: buildDiagramView(question.diagramSpec),
    tableView: buildTableView(question.tableSpec)
  }
}

module.exports = {
  splitMathParts,
  splitExplanationSteps,
  normalizeStructuredSteps,
  displayMathSymbols,
  buildDiagramView,
  buildTableView,
  enrichQuestionMath
}
