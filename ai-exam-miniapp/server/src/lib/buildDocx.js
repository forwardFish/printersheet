import fs from 'fs/promises'
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx'
import { explanationStepsForQuestion, splitMathParts, toDisplayMath } from './mathFormat.js'

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    heading: opts.heading,
    spacing: { after: opts.after ?? 160 },
    children: [new TextRun({ text: String(text || ''), bold: !!opts.bold, size: opts.size || 24, font: 'Microsoft YaHei' })]
  })
}

function runsFromMathParts(text, opts = {}) {
  return splitMathParts(text).map(part => new TextRun({
    text: part.type === 'math' ? toDisplayMath(part.text) : part.text,
    bold: part.type === 'math' || !!opts.bold,
    size: opts.size || 24,
    font: part.type === 'math' ? 'Consolas' : 'Microsoft YaHei',
    color: part.type === 'math' ? '25315C' : (opts.color || '222222')
  }))
}

function withLatexText(text = '', latex = '') {
  const base = String(text || '').trim()
  const formula = splitMathParts(latex || '').map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text).join('').trim()
  if (!formula) return base
  const compactBase = splitMathParts(base).map(part => part.type === 'math' ? toDisplayMath(part.text) : part.text).join('').replace(/\s+/g, '')
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
