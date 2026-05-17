import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackGeometrySpec, normalizeGeometryDiagramSpec, validateGeometryDiagramSpec } from '../src/lib/geometryRenderer.js'

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
