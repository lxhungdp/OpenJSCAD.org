const test = require('ava')
const {
  hasNodalLoad,
  hasDistributedLoad,
  nodalLoadIsEmpty,
  distributedLoadIsEmpty,
  activeDistribAxes
} = require('./loadUtils')

test('hasNodalLoad detects any force or moment', (t) => {
  t.false(hasNodalLoad({ Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 }))
  t.true(hasNodalLoad({ Mz: -2 }))
  t.true(hasNodalLoad({ Fx: 1 }))
})

test('hasDistributedLoad detects q components', (t) => {
  t.false(hasDistributedLoad({ qx: 0, qy: 0, qz: 0 }))
  t.true(hasDistributedLoad({ qz: 0.5 }))
})

test('activeDistribAxes', (t) => {
  t.deepEqual(activeDistribAxes({ qx: 1, qy: 2, qz: 0 }), ['qx', 'qy'])
})

test('empty helpers', (t) => {
  t.true(nodalLoadIsEmpty({ Fx: 0 }))
  t.true(distributedLoadIsEmpty({ qy: 0 }))
})
