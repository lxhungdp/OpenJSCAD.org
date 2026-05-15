const test = require('ava')
const { defaultStructure } = require('@jscad/structure')
const analyzeStructure = require('../src/analyzeStructure')

test('cantilever column — 6 DOF frame', (t) => {
  const s = defaultStructure()
  s.nodes = [
    { id: 1, x: 0, y: 0, z: 0 },
    { id: 2, x: 0, y: 3, z: 0 }
  ]
  s.elements = [{ id: 1, iNode: 1, jNode: 2, matId: 'mat1', secId: 'sec1' }]
  s.materials = [{ matId: 'mat1', w: 0, E: 32836000, G: 12628000 }]
  s.sections = [{
    secId: 'sec1',
    type: 'rec',
    b: 0.25,
    H: 0.25,
    tw: 0.2,
    tf: 0.25,
    r: 1
  }]
  s.restraints = [{ id: 1, nodeId: 1, preset: 'fixed', dofs: [true, true, true, true, true, true] }]
  s.loads = {
    nodal: [{ id: 1, nodeId: 2, Fx: 10, Fy: -2000, Fz: 0, Mx: 0, My: 0, Mz: 0 }],
    distributed: []
  }

  const r = analyzeStructure(s)
  t.true(r.ok, r.error || 'analysis failed')
  t.is(r.positions.length, 6)
  t.true(Math.abs(r.positions[0]) < 1e-9)
  t.true(Math.abs(r.positions[3]) > 0.001)
})
