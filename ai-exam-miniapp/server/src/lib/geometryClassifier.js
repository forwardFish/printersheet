export const GEOMETRY_TEMPLATE_REGISTRY = [
  { family: 'number_line', domain: 'number_line' },
  { family: 'coordinate_axis', domain: 'coordinate_geometry' },
  { family: 'grid_triangle', domain: 'plane_geometry' },
  { family: 'parallel_lines', domain: 'plane_geometry' },
  { family: 'congruent_triangles', domain: 'plane_geometry' },
  { family: 'similar_triangles', domain: 'plane_geometry' },
  { family: 'triangle_ruler', domain: 'plane_geometry' },
  { family: 'angle_bisector', domain: 'plane_geometry' },
  { family: 'right_triangle_altitude_to_hypotenuse', domain: 'plane_geometry' },
  { family: 'triangle_parallel_segment', domain: 'plane_geometry' },
  { family: 'circle_chord_tangent', domain: 'plane_geometry' },
  { family: 'circle_inscribed_angle', domain: 'plane_geometry' },
  { family: 'polygon_angle_sum', domain: 'plane_geometry' },
  { family: 'rectangle_area_split', domain: 'plane_geometry' },
  { family: 'fence_area', domain: 'plane_geometry' },
  { family: 'solid_cube', domain: 'solid_geometry' },
  { family: 'rectangular_prism', domain: 'solid_geometry' },
  { family: 'square_pyramid', domain: 'solid_geometry' },
  { family: 'triangular_pyramid', domain: 'solid_geometry' },
  { family: 'cylinder_cone_section', domain: 'solid_geometry' },
  { family: 'analytic_ellipse', domain: 'analytic_geometry' },
  { family: 'analytic_parabola', domain: 'analytic_geometry' },
  { family: 'analytic_curve', domain: 'analytic_geometry' }
]

const GEOMETRY_KEYWORD_GROUPS = [
  {
    domain: 'number_line',
    family: 'number_line',
    terms: ['数轴', 'number line']
  },
  {
    domain: 'coordinate_geometry',
    family: 'coordinate_axis',
    terms: ['平面直角坐标系', '坐标系', '坐标平面', '坐标轴', '点坐标', '轨迹']
  },
  {
    domain: 'solid_geometry',
    family: 'solid_cube',
    terms: ['正方体', '立方体', '空间几何', '立体几何']
  },
  {
    domain: 'solid_geometry',
    family: 'rectangular_prism',
    terms: ['长方体', '直棱柱', '棱柱']
  },
  {
    domain: 'solid_geometry',
    family: 'square_pyramid',
    terms: ['四棱锥', '正四棱锥']
  },
  {
    domain: 'solid_geometry',
    family: 'triangular_pyramid',
    terms: ['三棱锥', '四面体']
  },
  {
    domain: 'solid_geometry',
    family: 'cylinder_cone_section',
    terms: ['圆柱', '圆锥', '球', '截面']
  },
  {
    domain: 'solid_geometry',
    family: 'solid_cube',
    terms: ['平面', '二面角', '线面角', '线线角', '异面直线', '棱', '顶点']
  },
  {
    domain: 'plane_geometry',
    family: 'parallel_lines',
    terms: ['平行线', '同位角', '内错角', '同旁内角', '截线']
  },
  {
    domain: 'plane_geometry',
    family: 'congruent_triangles',
    terms: ['全等三角形', '全等', 'SAS', 'ASA', 'AAS', 'SSS']
  },
  {
    domain: 'plane_geometry',
    family: 'similar_triangles',
    terms: ['相似三角形', '相似', '比例线段']
  },
  {
    domain: 'plane_geometry',
    family: 'angle_bisector',
    terms: ['角平分线', '角的平分线']
  },
  {
    domain: 'plane_geometry',
    family: 'triangle_ruler',
    terms: ['三角尺', '直尺', '三角板']
  },
  {
    domain: 'plane_geometry',
    family: 'circle_chord_tangent',
    terms: ['圆', '切线', '弦', '直径', '半径', '圆心']
  },
  {
    domain: 'plane_geometry',
    family: 'polygon_angle_sum',
    terms: ['多边形', '内角和', '外角和']
  },
  {
    domain: 'plane_geometry',
    family: 'rectangle_area_split',
    terms: ['长方形', '矩形', '面积分割']
  },
  {
    domain: 'plane_geometry',
    family: 'grid_triangle',
    terms: ['网格', '格点', '方格']
  },
  {
    domain: 'plane_geometry',
    family: 'fence_area',
    terms: ['围墙', '篱笆', '围栏']
  },
  {
    domain: 'plane_geometry',
    family: 'congruent_triangles',
    terms: ['三角形', '边长', '三边', '中线', '高线', '垂心']
  },
  {
    domain: 'plane_geometry',
    family: 'generic_geometry',
    terms: ['直线', '线段', '射线', '垂线', '垂足', '角度', '角']
  },
  {
    domain: 'analytic_geometry',
    family: 'analytic_ellipse',
    terms: ['椭圆', '焦点', '离心率', '长轴', '短轴']
  },
  {
    domain: 'analytic_geometry',
    family: 'analytic_parabola',
    terms: ['抛物线', '双曲线', '准线', '圆锥曲线']
  },
  {
    domain: 'function_graph',
    family: 'coordinate_axis',
    terms: ['函数图像', '函数图象', '图像', '图象', '交点', '切点']
  }
]

const EXPLICIT_DIAGRAM_TERMS = ['如图', '图中', '下图', '上图', '题图', '所示', '示意图', '画出', '作图']
const RELATION_TERMS = ['中点', '交于', '垂直', '平行', '相交', '延长', '连接', '连结', '过点', '作', '证明', '求证']
const ANALYTIC_DIAGRAM_TERMS = ['焦点', '弦', '切线', '交点', '准线', '轨迹']

const MATH_SUBJECT_TERMS = ['math', '\u6570\u5b66']
const NON_MATH_SUBJECT_TERMS = [
  'chemistry',
  'physics',
  'chinese',
  'english',
  'biology',
  'history',
  'geography',
  'politics',
  '\u5316\u5b66',
  '\u7269\u7406',
  '\u8bed\u6587',
  '\u82f1\u8bed',
  '\u751f\u7269',
  '\u5386\u53f2',
  '\u5730\u7406',
  '\u653f\u6cbb'
]
const DOMAIN_PRIORITY = ['analytic_geometry', 'solid_geometry', 'plane_geometry', 'number_line', 'coordinate_geometry', 'function_graph']
const ANALYTIC_CURVE_GROUPS = [
  {
    family: 'analytic_curve',
    terms: ['\u692d\u5706', '\u53cc\u66f2\u7ebf', '\u629b\u7269\u7ebf', '\u7126\u70b9', '\u79bb\u5fc3\u7387', '\u6e10\u8fd1\u7ebf', '\u51c6\u7ebf', '\u5207\u7ebf', '\u4ea4\u70b9', '\u5f26', '\u5706\u9525\u66f2\u7ebf']
  }
]
const SOLID_GEOMETRY_GROUPS = [
  { family: 'solid_cube', terms: ['\u6b63\u65b9\u4f53', '\u7acb\u65b9\u4f53'] },
  { family: 'rectangular_prism', terms: ['\u957f\u65b9\u4f53', '\u76f4\u68f1\u67f1', '\u68f1\u67f1'] },
  { family: 'square_pyramid', terms: ['\u56db\u68f1\u9525', '\u6b63\u56db\u68f1\u9525'] },
  { family: 'triangular_pyramid', terms: ['\u4e09\u68f1\u9525', '\u56db\u9762\u4f53'] },
  { family: 'solid_cube', terms: ['\u4e8c\u9762\u89d2', '\u7ebf\u9762\u89d2', '\u7a7a\u95f4\u51e0\u4f55', '\u7acb\u4f53\u51e0\u4f55', '\u5e73\u9762', '\u68f1', '\u9876\u70b9'] }
]
const PLANE_GEOMETRY_GROUPS = [
  { family: 'right_triangle_altitude_to_hypotenuse', terms: ['Rt\u25b3', 'Rt\u0394', '\u76f4\u89d2\u4e09\u89d2\u5f62', '\u659c\u8fb9', '\u659c\u8fb9\u4e0a\u7684\u9ad8', '\u9ad8\u4e3a', '\u9ad8CD', 'CD\u22a5AB'] },
  { family: 'triangle_parallel_segment', terms: ['DE // BC', 'DE//BC', 'DE \\\\parallel BC', '\u5e73\u884c\u4e8eBC', '\u5e73\u884c\u4e8e BC', '\u5e73\u884c\u7ebf\u5206\u7ebf\u6bb5\u6210\u6bd4\u4f8b'] },
  { family: 'circle_inscribed_angle', terms: ['\u2299', '\u5706\u4e0a', '\u5706\u5468\u89d2', '\u5706\u5fc3\u89d2'] },
  { family: 'circle_chord_tangent', terms: ['\u5706', '\u76f4\u5f84', '\u534a\u5f84', '\u5f26', '\u5706\u5fc3', '\u5207\u7ebf'] },
  { family: 'parallel_lines', terms: ['\u5e73\u884c\u7ebf', '\u540c\u4f4d\u89d2', '\u5185\u9519\u89d2', '\u540c\u65c1\u5185\u89d2', '\u622a\u7ebf'] },
  { family: 'congruent_triangles', terms: ['\u5168\u7b49\u4e09\u89d2\u5f62', '\u5168\u7b49', 'SAS', 'ASA', 'AAS', 'SSS'] },
  { family: 'similar_triangles', terms: ['\u76f8\u4f3c\u4e09\u89d2\u5f62', '\u76f8\u4f3c'] },
  { family: 'angle_bisector', terms: ['\u89d2\u5e73\u5206\u7ebf', '\u89d2\u7684\u5e73\u5206\u7ebf'] },
  { family: 'grid_triangle', terms: ['\u7f51\u683c', '\u683c\u70b9', '\u65b9\u683c'] },
  { family: 'fence_area', terms: ['\u56f4\u5899', '\u7bf1\u7b06', '\u56f4\u680f'] },
  { family: 'congruent_triangles', terms: ['\u4e09\u89d2\u5f62', '\u8fb9\u957f', '\u4e09\u8fb9', '\u4e2d\u7ebf', '\u9ad8\u7ebf', '\u5782\u5fc3'] },
  { family: 'generic_geometry', terms: ['\u76f4\u7ebf', '\u7ebf\u6bb5', '\u5c04\u7ebf', '\u5782\u7ebf', '\u5782\u8db3', '\u89d2\u5ea6', '\u89d2'] }
]
const NUMBER_LINE_GROUPS = [
  { family: 'number_line', terms: ['\u6570\u8f74', 'number line'] },
  { family: 'coordinate_axis', terms: ['\u5e73\u9762\u76f4\u89d2\u5750\u6807\u7cfb', '\u5750\u6807\u7cfb', '\u5750\u6807\u5e73\u9762', '\u5750\u6807\u8f74', '\u8f74'] }
]
const EXPLICIT_DIAGRAM_TERMS_UTF8 = ['\u5982\u56fe', '\u56fe\u4e2d', '\u4e0b\u56fe', '\u4e0a\u56fe', '\u9898\u56fe', '\u6240\u793a', '\u793a\u610f\u56fe', '\u753b\u51fa', '\u4f5c\u56fe']
const RELATION_TERMS_UTF8 = ['\u4e2d\u70b9', '\u4ea4\u4e8e', '\u5782\u76f4', '\u5e73\u884c', '\u76f8\u4ea4', '\u5ef6\u957f', '\u8fde\u63a5', '\u8fde\u7ed3', '\u8fc7\u70b9', '\u4f5c', '\u8bc1\u660e', '\u6c42\u8bc1', '\u5782\u8db3', '\u5206\u522b\u4e3a', '\u70b9']
const ANALYTIC_DIAGRAM_TERMS_UTF8 = ['\u692d\u5706', '\u53cc\u66f2\u7ebf', '\u629b\u7269\u7ebf', '\u7126\u70b9', '\u79bb\u5fc3\u7387', '\u6e10\u8fd1\u7ebf', '\u51c6\u7ebf', '\u5207\u7ebf', '\u4ea4\u70b9']
const SOLID_DIAGRAM_TERMS_UTF8 = ['\u6b63\u65b9\u4f53', '\u957f\u65b9\u4f53', '\u56db\u68f1\u9525', '\u4e09\u68f1\u9525', '\u4e8c\u9762\u89d2', '\u7ebf\u9762\u89d2', '\u5e73\u9762', '\u68f1']

const FALLBACK_FAMILIES_BY_NUMBER = {
  3: 'number_line',
  5: 'triangle_ruler',
  22: 'congruent_triangles',
  24: 'parallel_lines',
  25: 'grid_triangle',
  27: 'fence_area',
  28: 'angle_bisector'
}

const FALLBACK_COMPATIBLE_FAMILIES = {
  number_line: ['number_line', 'coordinate_axis'],
  triangle_ruler: ['triangle_ruler', 'parallel_lines', 'generic_geometry'],
  congruent_triangles: ['congruent_triangles', 'similar_triangles'],
  parallel_lines: ['parallel_lines', 'triangle_ruler', 'generic_geometry'],
  grid_triangle: ['grid_triangle', 'congruent_triangles', 'similar_triangles'],
  fence_area: ['fence_area', 'rectangle_area_split'],
  angle_bisector: ['angle_bisector', 'parallel_lines']
}

function toTextList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || ''))
  if (value === undefined || value === null) return []
  return [String(value)]
}

function boolLike(value) {
  if (value === true || value === false) return value
  const text = String(value || '').trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'need', 'needs', 'required', '是', '需要', '必须'].includes(text)) return true
  if (['false', '0', 'no', 'n', 'none', 'not_required', '否', '不需要'].includes(text)) return false
  return null
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function collectMatches(text, terms) {
  const lower = text.toLowerCase()
  return terms.filter(term => lower.includes(String(term).toLowerCase()))
}

function subjectForQuestion(input = {}) {
  return [
    input.subject,
    input.sourceBlueprint?.subject,
    input.paperSubject,
    input.defaults?.subject
  ].filter(Boolean).join(' ')
}

function isExplicitNonMathSubject(input = {}) {
  const subject = subjectForQuestion(input).toLowerCase()
  if (!subject) return false
  if (MATH_SUBJECT_TERMS.some(term => subject.includes(String(term).toLowerCase()))) return false
  return NON_MATH_SUBJECT_TERMS.some(term => subject.includes(String(term).toLowerCase()))
}

function recordKeywordGroups(groups, domain, text, evidence, domainScores, familyScores) {
  for (const group of groups) {
    const matches = collectMatches(text, group.terms)
    if (!matches.length) continue
    evidence.push(...matches)
    domainScores.set(domain, (domainScores.get(domain) || 0) + matches.length)
    familyScores.set(group.family, (familyScores.get(group.family) || 0) + matches.length)
  }
}

function priorityDomain(domainScores) {
  return DOMAIN_PRIORITY.find(domain => (domainScores.get(domain) || 0) > 0) || 'none'
}

function normalizeDomain(domain) {
  if (domain === 'coordinate_geometry' || domain === 'function_graph') return 'number_line'
  return domain || 'none'
}

function priorityFamilyForDomain(domain, familyScores) {
  const entries = [...familyScores.entries()]
  if (domain === 'analytic_geometry' && entries.some(([family]) => family === 'analytic_curve')) return 'analytic_curve'
  if (domain === 'solid_geometry') {
    const solidOrder = ['square_pyramid', 'triangular_pyramid', 'solid_cube', 'rectangular_prism', 'cylinder_cone_section']
    const explicit = solidOrder.find(family => (familyScores.get(family) || 0) > 0)
    if (explicit) return explicit
  }
  if (domain === 'plane_geometry') {
    const planeOrder = ['right_triangle_altitude_to_hypotenuse', 'triangle_parallel_segment', 'circle_inscribed_angle', 'circle_chord_tangent', 'angle_bisector', 'parallel_lines', 'congruent_triangles', 'similar_triangles', 'grid_triangle', 'fence_area', 'generic_geometry']
    const explicit = planeOrder.find(family => (familyScores.get(family) || 0) > 0)
    if (explicit) return explicit
  }
  const knownForDomain = GEOMETRY_TEMPLATE_REGISTRY
    .filter(item => normalizeDomain(item.domain) === normalizeDomain(domain))
    .map(item => item.family)
  const candidates = entries
    .filter(([family]) => knownForDomain.includes(family) || (domain === 'analytic_geometry' && family === 'analytic_curve'))
    .sort((a, b) => b[1] - a[1])
  return candidates[0]?.[0] || entries.sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

function emptyClassification(reason = 'not_geometry') {
  return {
    isGeometry: false,
    needsDiagram: false,
    diagramSpecRequired: false,
    geometryDomain: 'none',
    templateFamily: '',
    confidence: 0.08,
    evidence: [],
    reason
  }
}

function textForQuestion(input = {}) {
  if (typeof input === 'string') return input
  const source = input.sourceBlueprint || {}
  return [
    input.question,
    input.questionLatex,
    input.skill,
    input.subject,
    input.section,
    input.type,
    input.originalStem,
    input.diagramRequiredReason,
    ...toTextList(input.knowledgePoints),
    ...toTextList(source.subject),
    ...toTextList(source.originalStem),
    ...toTextList(source.knowledgePoints),
    source.variationPlan,
    source.expectedAnswerShape
  ].filter(Boolean).join(' ')
}

export function diagramSpecIsMeaningful(spec) {
  return Boolean(spec && typeof spec === 'object' && !Array.isArray(spec) && String(spec.type || 'none') !== 'none')
}

export function fallbackFamilyForQuestionNumber(questionNumber = 0) {
  return FALLBACK_FAMILIES_BY_NUMBER[Number(questionNumber)] || ''
}

export function shouldUseQuestionNumberFallback(questionNumber = 0, classification = {}) {
  if (!classification?.needsDiagram) return false
  const fallbackFamily = fallbackFamilyForQuestionNumber(questionNumber)
  if (!fallbackFamily) return false
  const compatible = FALLBACK_COMPATIBLE_FAMILIES[fallbackFamily] || []
  return compatible.includes(classification.templateFamily)
}

export function classifyGeometryQuestion(input = {}) {
  if (isExplicitNonMathSubject(input)) return emptyClassification('non_math_subject')
  const text = textForQuestion(input)
  const declared = boolLike(input.needsDiagram ?? input.diagramSpecRequired ?? input.sourceBlueprint?.needsDiagram)
  const evidence = []
  const domainScores = new Map()
  const familyScores = new Map()

  for (const group of GEOMETRY_KEYWORD_GROUPS) {
    const matches = collectMatches(text, group.terms)
    if (!matches.length) continue
    evidence.push(...matches)
    domainScores.set(group.domain, (domainScores.get(group.domain) || 0) + matches.length)
    familyScores.set(group.family, (familyScores.get(group.family) || 0) + matches.length)
  }

  recordKeywordGroups(ANALYTIC_CURVE_GROUPS, 'analytic_geometry', text, evidence, domainScores, familyScores)
  recordKeywordGroups(SOLID_GEOMETRY_GROUPS, 'solid_geometry', text, evidence, domainScores, familyScores)
  recordKeywordGroups(PLANE_GEOMETRY_GROUPS, 'plane_geometry', text, evidence, domainScores, familyScores)
  recordKeywordGroups(NUMBER_LINE_GROUPS, 'number_line', text, evidence, domainScores, familyScores)

  const explicitDiagramEvidence = [
    ...collectMatches(text, EXPLICIT_DIAGRAM_TERMS),
    ...collectMatches(text, EXPLICIT_DIAGRAM_TERMS_UTF8)
  ]
  const relationEvidence = [
    ...collectMatches(text, RELATION_TERMS),
    ...collectMatches(text, RELATION_TERMS_UTF8)
  ]
  const analyticDiagramEvidence = [
    ...collectMatches(text, ANALYTIC_DIAGRAM_TERMS),
    ...collectMatches(text, ANALYTIC_DIAGRAM_TERMS_UTF8)
  ]
  const solidDiagramEvidence = collectMatches(text, SOLID_DIAGRAM_TERMS_UTF8)
  evidence.push(...explicitDiagramEvidence)

  const geometryDomain = normalizeDomain(priorityDomain(domainScores))
  const templateFamily = priorityFamilyForDomain(geometryDomain, familyScores)
  const geometryScore = [...domainScores.values()].reduce((sum, score) => sum + score, 0)
  const isGeometry = declared === true || geometryScore > 0
  const relationHeavy = relationEvidence.length >= 2
  const explicitDiagram = explicitDiagramEvidence.length > 0
  const solid = geometryDomain === 'solid_geometry'
  const numberLine = geometryDomain === 'number_line'
  const analyticNeedsDiagram = geometryDomain === 'analytic_geometry' && analyticDiagramEvidence.length > 0
  const solidNeedsDiagram = solid && (solidDiagramEvidence.length > 0 || geometryScore > 0)
  const templateRequiresDiagram = ['right_triangle_altitude_to_hypotenuse', 'triangle_parallel_segment'].includes(templateFamily)
  const planeNeedsDiagram = geometryDomain === 'plane_geometry' && (explicitDiagram || relationHeavy || templateRequiresDiagram)
  const functionNeedsDiagram = geometryDomain === 'function_graph' && (explicitDiagram || collectMatches(text, ['图像', '图象']).length > 0)
  const inferredNeedsDiagram = solidNeedsDiagram || numberLine || analyticNeedsDiagram || planeNeedsDiagram || functionNeedsDiagram
  const needsDiagram = declared === true || (declared === false ? inferredNeedsDiagram : inferredNeedsDiagram)
  const confidenceBase = geometryScore + explicitDiagramEvidence.length + relationEvidence.length * 0.5
  const confidence = Math.max(0, Math.min(0.98, Number((confidenceBase ? 0.45 + confidenceBase * 0.08 : 0.08).toFixed(2))))

  return {
    isGeometry,
    needsDiagram,
    diagramSpecRequired: needsDiagram,
    geometryDomain,
    templateFamily,
    confidence,
    evidence: unique(evidence).slice(0, 8),
    reason: needsDiagram
      ? 'geometry_or_graph_relation_requires_diagram'
      : (isGeometry ? 'geometry_can_be_solved_without_required_diagram' : 'not_geometry')
  }
}
