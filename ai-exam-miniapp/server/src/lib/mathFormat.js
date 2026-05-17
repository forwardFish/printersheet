const SUPER = {
  0: '\u2070',
  1: '\u00B9',
  2: '\u00B2',
  3: '\u00B3',
  4: '\u2074',
  5: '\u2075',
  6: '\u2076',
  7: '\u2077',
  8: '\u2078',
  9: '\u2079',
  '+': '\u207A',
  '-': '\u207B',
  '=': '\u207C',
  '(': '\u207D',
  ')': '\u207E',
  a: '\u1D43',
  b: '\u1D47',
  c: '\u1D9C',
  d: '\u1D48',
  e: '\u1D49',
  f: '\u1DA0',
  g: '\u1D4D',
  h: '\u02B0',
  i: '\u2071',
  j: '\u02B2',
  k: '\u1D4F',
  l: '\u02E1',
  m: '\u1D50',
  n: '\u207F',
  o: '\u1D52',
  p: '\u1D56',
  r: '\u02B3',
  s: '\u02E2',
  t: '\u1D57',
  u: '\u1D58',
  v: '\u1D5B',
  w: '\u02B7',
  x: '\u02E3',
  y: '\u02B8',
  z: '\u1DBB'
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function superscript(value = '') {
  const raw = String(value)
  const chars = raw.split('')
  if (!chars.length) return ''
  if (!chars.every(char => SUPER[char])) return `^${raw}`
  return chars.map(char => SUPER[char]).join('')
}

function normalizeCases(value = '') {
  return String(value || '')
    .replace(/\$+/g, '')
    .replace(/\\begin\{cases\}/g, '{ ')
    .replace(/\\end\{cases\}/g, ' }')
    .replace(/\\\\/g, '; ')
}

function normalizeLatex(value = '') {
  return normalizeCases(value)
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '\u00D7')
    .replace(/\\div/g, '/')
    .replace(/\\leq?/g, '\u2264')
    .replace(/\\geq?/g, '\u2265')
    .replace(/\\neq/g, '\u2260')
    .replace(/\\angle/g, '\u2220')
    .replace(/\\triangle/g, '\u25B3')
    .replace(/\\pi/g, '\u03C0')
    .replace(/\\sqrt\{([^{}]+)\}/g, '\u221A$1')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
}

export function toDisplayMath(value = '') {
  return normalizeLatex(value)
    .replace(/<=/g, '\u2264')
    .replace(/>=/g, '\u2265')
    .replace(/!=/g, '\u2260')
    .replace(/\*/g, '\u00D7')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/sqrt\(([^()]+)\)/gi, '\u221A$1')
    .replace(/sqrt\s*([0-9A-Za-z]+)/gi, '\u221A$1')
    .replace(/\^\(([^()]+)\)/g, (_, exp) => superscript(`(${exp})`))
    .replace(/\^\{([^{}]+)\}/g, (_, exp) => superscript(exp))
    .replace(/\^([+\-]?\d+)/g, (_, exp) => superscript(exp))
    .replace(/\^([A-Za-z])/g, (_, exp) => superscript(exp))
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*([+\-\u00D7\u2264\u2265\u2260<>])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitDollarMath(text = '') {
  const parts = []
  const pattern = /\$([^$]+)\$/g
  let last = 0
  let match
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ type: 'text', text: text.slice(last, match.index) })
    parts.push({ type: 'math', text: toDisplayMath(match[1]) })
    last = pattern.lastIndex
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}

function isMathChar(char) {
  return /[A-Za-z0-9+\-*/=^().|<>{}\\]/.test(char || '')
}

function isMeaningfulMath(value = '') {
  const text = value.trim()
  if (text.length < 2) return false
  if (!/[A-Za-z0-9\\]/.test(text)) return false
  return /[=+\-*/^|<>\\]/.test(text)
}

export function splitMathParts(text = '') {
  const source = cleanText(text)
  if (!source) return []
  const dollarParts = splitDollarMath(source)
  const parts = []
  for (const part of dollarParts) {
    if (part.type === 'math') {
      parts.push(part)
      continue
    }
    let cursor = 0
    while (cursor < part.text.length) {
      if (isMathChar(part.text[cursor])) {
        let end = cursor
        while (end < part.text.length && isMathChar(part.text[end])) end += 1
        const raw = part.text.slice(cursor, end)
        const trimmed = raw.trim()
        parts.push(isMeaningfulMath(trimmed)
          ? { type: 'math', text: toDisplayMath(trimmed) }
          : { type: 'text', text: raw })
        cursor = end
        continue
      }
      let end = cursor
      while (end < part.text.length && !isMathChar(part.text[end])) end += 1
      const raw = part.text.slice(cursor, end)
      if (raw) parts.push({ type: 'text', text: raw })
      cursor = end
    }
  }
  return parts.length ? parts : [{ type: 'text', text: source }]
}

function stepText(step) {
  if (typeof step === 'string' || typeof step === 'number') return String(step)
  if (!step || typeof step !== 'object' || Array.isArray(step)) return ''
  return String(step.text || step.content || step.statement || step.reason || step.latex || '').trim()
}

export function normalizeStructuredSteps(value = []) {
  if (!Array.isArray(value)) return []
  return value
    .map(stepText)
    .map(cleanText)
    .filter(Boolean)
}

export function splitExplanationSteps(text = '') {
  const source = cleanText(text)
  if (!source) return []
  return source
    .replace(/([.;\u3002\uff1b])\s*/g, '$1\n')
    .replace(/(=>|->|\u56e0\u6b64|\u6240\u4ee5)\s*/g, '$1\n')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

export function explanationStepsForQuestion(question = {}) {
  const structured = normalizeStructuredSteps(question.explanationSteps)
  if (structured.length) return structured
  const proof = normalizeStructuredSteps(question.proofSteps)
  if (proof.length) return proof
  if (question.explanationLatex) {
    const latex = cleanText(question.explanationLatex)
    if (latex) return splitExplanationSteps(latex)
  }
  return splitExplanationSteps(question.explanation || '略')
}
