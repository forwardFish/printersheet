function cleanText(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/：\s*/g, '：')
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

function buildGeometryView(spec = {}) {
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
  const normalized = {}
  entries.forEach(point => {
    normalized[point.name] = {
      x: 8 + ((point.x - minX) / width) * 84,
      y: 10 + ((point.y - minY) / height) * 78
    }
  })
  const segments = (Array.isArray(spec.segments) ? spec.segments : [])
    .filter(pair => Array.isArray(pair) && pair.length === 2 && normalized[pair[0]] && normalized[pair[1]])
    .map((pair, index) => {
      const a = normalized[pair[0]]
      const b = normalized[pair[1]]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      return {
        id: `${index}`,
        style: `left:${a.x}%;top:${a.y}%;width:${length}%;transform:rotate(${angle}deg);`
      }
    })
  const labels = entries.map(point => {
    const pos = normalized[point.name]
    return {
      id: point.name,
      label: point.name,
      style: `left:${pos.x}%;top:${pos.y}%;`
    }
  })
  return segments.length ? { type: 'geometry', segments, labels } : null
}

function buildDiagramView(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
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
  buildDiagramView,
  buildTableView,
  enrichQuestionMath
}
