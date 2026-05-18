import test from 'node:test'
import assert from 'node:assert/strict'
import PDFDocument from 'pdfkit'
import { fallbackGeometrySpec, normalizeGeometryDiagramSpec, renderGeometryDiagram, validateGeometryDiagramSpec } from '../src/lib/geometryRenderer.js'
import { classifyGeometryQuestion, shouldUseQuestionNumberFallback } from '../src/lib/geometryClassifier.js'

test('geometry diagram specs validate required professional fields', () => {
  assert.equal(validateGeometryDiagramSpec({
    type: 'template',
    templateId: 'triangle_ruler_overlap_angle',
    labels: ['A', 'B', 'C', 'D', 'E', 'F']
  }).valid, true)

  assert.equal(validateGeometryDiagramSpec({
    type: 'parallel_lines',
    points: { A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1] },
    segments: [['A', 'B'], ['C', 'D']],
    labels: ['A', 'B', 'C', 'D'],
    parallelMarks: [['A', 'B'], ['C', 'D']]
  }).valid, true)

  assert.equal(validateGeometryDiagramSpec({
    type: 'parallel_lines',
    points: { A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1] },
    segments: [['A', 'B'], ['C', 'D']],
    labels: ['A', 'B', 'C', 'D']
  }).valid, false)

  assert.equal(validateGeometryDiagramSpec({
    type: 'congruent_triangles',
    points: { A: [0, 0], B: [1, 0], C: [0, 1] },
    segments: [['A', 'B'], ['B', 'C']],
    labels: ['A', 'B', 'C']
  }).valid, false)

  assert.equal(validateGeometryDiagramSpec({
    type: 'grid_triangle',
    points: { A: [1, 1], B: [3, 1], C: [2, 3] },
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A']],
    labels: ['A', 'B', 'C'],
    gridSpec: { cols: 8, rows: 8, cell: 13 }
  }).valid, true)

  assert.equal(validateGeometryDiagramSpec({
    type: 'angle_bisector',
    points: { O: [0, 0], A: [4, 0], B: [2, -2], C: [3, -1] },
    segments: [['O', 'A'], ['O', 'B'], ['O', 'C']],
    labels: ['O', 'A', 'B', 'C']
  }).valid, true)

  assert.equal(validateGeometryDiagramSpec({
    type: 'analytic_curve',
    curveKind: 'ellipse',
    equation: 'x^2/9+y^2/4=1',
    axes: { a: 3, b: 2 },
    points: { F1: [-2.2, 0], F2: [2.2, 0] },
    labels: ['F1', 'F2']
  }).valid, true)

  assert.equal(validateGeometryDiagramSpec({
    type: 'solid_diagram',
    solidKind: 'cube',
    templateId: 'cube_midpoint_dihedral_angle'
  }).valid, true)
})

test('invalid or missing geometry specs fall back to original-paper templates', () => {
  const normalized = normalizeGeometryDiagramSpec(null, 22)
  assert.equal(normalized.source, 'locked-template')
  assert.equal(normalized.spec.type, 'template')
  assert.equal(normalized.spec.templateId, 'congruent_triangles_on_line')

  const grid = fallbackGeometrySpec(25)
  assert.equal(grid.type, 'template')
  assert.equal(grid.templateId, 'grid_triangle_construction')

  const angle = fallbackGeometrySpec(28)
  assert.equal(angle.type, 'template')
  assert.equal(angle.templateId, 'angle_bisector_rays')

  const parallel = normalizeGeometryDiagramSpec({ type: 'none' }, 24)
  assert.equal(parallel.source, 'locked-template')
  assert.equal(parallel.spec.templateId, 'parallel_lines_transversal')

  const locked = normalizeGeometryDiagramSpec({
    type: 'triangle_ruler',
    points: { A: [1, 1], B: [2, 2], C: [3, 3] },
    segments: [['A', 'B']],
    labels: ['A', 'B', 'C']
  }, 5)
  assert.equal(locked.source, 'locked-template')
  assert.equal(locked.spec.templateId, 'triangle_ruler_overlap_angle')
})

test('math paper geometry fallbacks can be disabled for other subjects', () => {
  const normalized = normalizeGeometryDiagramSpec({ type: 'none' }, 5, { allowFallback: false })
  assert.equal(normalized.source, 'none')
  assert.equal(normalized.spec, null)

  const invalid = normalizeGeometryDiagramSpec(null, 22, { allowFallback: false })
  assert.equal(invalid.source, 'none')
  assert.equal(invalid.spec, null)

  const validAiDiagram = normalizeGeometryDiagramSpec({
    type: 'triangle_ruler',
    points: { A: [0, 0], B: [2, 0], C: [1, 1] },
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A']],
    labels: ['A', 'B', 'C']
  }, 5, { allowFallback: false })
  assert.equal(validAiDiagram.source, 'ai')
  assert.equal(validAiDiagram.spec.type, 'triangle_ruler')
})

test('geometry classifier separates diagram-required geometry from algebra', () => {
  const algebra = classifyGeometryQuestion({
    number: 1,
    question: 'Solve 3x + 4 = 19.',
    skill: 'linear equation'
  })
  assert.equal(algebra.isGeometry, false)
  assert.equal(algebra.needsDiagram, false)

  const triangleInequality = classifyGeometryQuestion({
    number: 2,
    question: '一个三角形两边长分别为 3 和 6，判断第三边可能取值。',
    skill: '三角形三边关系'
  })
  assert.equal(triangleInequality.isGeometry, true)
  assert.equal(triangleInequality.needsDiagram, false)

  const cube = classifyGeometryQuestion({
    number: 8,
    question: '如图，在正方体 ABCD-A1B1C1D1 中，点 E 为棱 BB1 的中点，求直线 AE 与平面 A1B1C1D1 所成角。',
    skill: '立体几何'
  })
  assert.equal(cube.isGeometry, true)
  assert.equal(cube.needsDiagram, true)
  assert.equal(cube.geometryDomain, 'solid_geometry')
  assert.equal(cube.templateFamily, 'solid_cube')
  assert.equal(shouldUseQuestionNumberFallback(5, cube), false)

  const parallel = classifyGeometryQuestion({
    number: 24,
    question: '如图，两条直线被一条截线所截，证明两条直线平行。',
    skill: '平行线证明'
  })
  assert.equal(parallel.needsDiagram, true)
  assert.equal(shouldUseQuestionNumberFallback(24, parallel), true)
})

test('circle questions with existing diagrams are classified as diagram-required geometry', () => {
  const circle = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    number: 1,
    question: '\u5982\u56fe\uff0c\u5728\u2299O\u4e2d\uff0cAB\u662f\u76f4\u5f84\uff0cC\u3001D\u662f\u5706\u4e0a\u4e24\u70b9\uff0c\u8fde\u63a5AC\u3001AD\u3001BC\u3001BD\u3002'
  })

  assert.equal(circle.isGeometry, true)
  assert.equal(circle.needsDiagram, true)
  assert.equal(circle.geometryDomain, 'plane_geometry')
  assert.match(circle.templateFamily, /^circle_/)
})

test('high-school analytic and solid geometry require renderable diagrams', () => {
  const ellipse = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    question: '\u5df2\u77e5\u692d\u5706 C: x^2/9 + y^2/4 = 1\uff0c\u6c42\u7126\u70b9\u5750\u6807\u548c\u79bb\u5fc3\u7387\u3002'
  })
  assert.equal(ellipse.needsDiagram, true)
  assert.equal(ellipse.geometryDomain, 'analytic_geometry')
  assert.equal(ellipse.templateFamily, 'analytic_curve')

  const parabola = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    question: '\u629b\u7269\u7ebf y^2=4x \u7684\u7126\u70b9\u5f26 AB \u8fc7\u7126\u70b9 F\uff0c\u6c42 AB \u7684\u8303\u56f4\u3002'
  })
  assert.equal(parabola.needsDiagram, true)
  assert.equal(parabola.geometryDomain, 'analytic_geometry')

  const hyperbola = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    question: '\u5df2\u77e5\u53cc\u66f2\u7ebf\u7684\u6e10\u8fd1\u7ebf\u65b9\u7a0b\u548c\u7126\u70b9\uff0c\u6c42\u6807\u51c6\u65b9\u7a0b\u3002'
  })
  assert.equal(hyperbola.needsDiagram, true)
  assert.equal(hyperbola.geometryDomain, 'analytic_geometry')

  const pyramid = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    question: '\u5982\u56fe\uff0c\u56db\u68f1\u9525 S-ABCD \u4e2d\uff0c\u8bc1\u660e\u5e73\u9762 SEF \u5e73\u884c\u4e8e\u5e73\u9762 ABCD\u3002'
  })
  assert.equal(pyramid.needsDiagram, true)
  assert.equal(pyramid.geometryDomain, 'solid_geometry')
  assert.equal(pyramid.templateFamily, 'square_pyramid')
})

test('math geometry gate ignores non-math subjects and keeps simple triangle inequality diagram-free', () => {
  const chemistry = classifyGeometryQuestion({
    subject: '\u5316\u5b66',
    question: '\u5982\u56fe\u6240\u793a\u5b9e\u9a8c\u88c5\u7f6e\u4e2d\u7684\u5e73\u9762\u4f4d\u7f6e\u4e0e\u5bfc\u7ba1\u8fde\u63a5\u65b9\u5f0f\u3002'
  })
  assert.equal(chemistry.isGeometry, false)
  assert.equal(chemistry.needsDiagram, false)
  assert.equal(chemistry.geometryDomain, 'none')

  const physics = classifyGeometryQuestion({
    subject: '\u7269\u7406',
    question: '\u51f8\u900f\u955c\u7126\u70b9\u4e0e\u6210\u50cf\u89c4\u5f8b\u7684\u666e\u901a\u6587\u5b57\u9898\u3002'
  })
  assert.equal(physics.needsDiagram, false)

  const triangleInequality = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    question: '\u4e09\u89d2\u5f62\u4e24\u8fb9\u957f\u5206\u522b\u4e3a 3 \u548c 6\uff0c\u5224\u65ad\u7b2c\u4e09\u8fb9\u7684\u53d6\u503c\u8303\u56f4\u3002'
  })
  assert.equal(triangleInequality.isGeometry, true)
  assert.equal(triangleInequality.needsDiagram, false)
})

test('analytic_curve and solid_diagram render nonzero PDF height', () => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const ellipse = renderGeometryDiagram(doc, {
    type: 'analytic_curve',
    curveKind: 'ellipse',
    equation: 'x^2/9+y^2/4=1',
    axes: { a: 3, b: 2 },
    points: { F1: [-2.2, 0], F2: [2.2, 0] },
    labels: ['F1', 'F2']
  }, { x: 60, y: 60, width: 260, height: 128, allowFallback: false })
  assert.ok(ellipse.height > 0)

  const solid = renderGeometryDiagram(doc, {
    type: 'solid_diagram',
    solidKind: 'cube',
    templateId: 'cube_midpoint_dihedral_angle'
  }, { x: 60, y: 220, height: 122, allowFallback: false })
  assert.ok(solid.height > 0)
  doc.end()
})

test('DeepSeek right-triangle altitude spec is accepted and rendered', () => {
  const classification = classifyGeometryQuestion({
    subject: '\u6570\u5b66',
    question: '\u5728Rt\u25b3ABC\u4e2d\uff0c\u2220C=90\u00b0\uff0cAC=6\uff0cBC=8\uff0c\u659c\u8fb9AB\u4e0a\u7684\u9ad8CD=____\u3002',
    questionLatex: 'AC=6, BC=8, \\angle C=90^\\circ'
  })
  assert.equal(classification.isGeometry, true)
  assert.equal(classification.needsDiagram, true)
  assert.equal(classification.templateFamily, 'right_triangle_altitude_to_hypotenuse')

  const spec = {
    type: 'template',
    templateId: 'right_triangle_altitude_to_hypotenuse',
    points: { A: [6, 0], B: [0, 8], C: [0, 0], D: [3.84, 2.88] },
    segments: [
      { start: 'A', end: 'B' },
      { start: 'A', end: 'C' },
      { start: 'B', end: 'C' },
      { start: 'C', end: 'D' }
    ],
    labels: [
      { point: 'A', offset: [0.3, -0.3] },
      { point: 'B', offset: [-0.3, 0.3] },
      { point: 'C', offset: [-0.3, -0.3] },
      { point: 'D', offset: [0.3, 0.3] }
    ],
    rightAngleMarks: [{ vertex: 'C', points: ['A', 'C', 'B'] }],
    perpendicularMarks: [{ at: 'D', line1: ['C', 'D'], line2: ['A', 'B'] }],
    lengthLabels: [{ segment: ['A', 'C'], label: '6' }, { segment: ['B', 'C'], label: '8' }]
  }
  assert.equal(validateGeometryDiagramSpec(spec).valid, true)
  const normalized = normalizeGeometryDiagramSpec(spec, 0, { allowFallback: false })
  assert.deepEqual(normalized.spec.segments[0], ['A', 'B'])
  assert.deepEqual(normalized.spec.labels, ['A', 'B', 'C', 'D'])

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const result = renderGeometryDiagram(doc, spec, { x: 60, y: 60, width: 220, height: 120, scale: 24, allowFallback: false })
  assert.ok(result.height > 0)
  doc.end()
})
