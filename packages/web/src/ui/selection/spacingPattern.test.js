const test = require('ava')
const { parseSpacingPattern, predictNewNodeIds } = require('./spacingPattern')

test('parse simple increments', (t) => {
  const r = parseSpacingPattern('3 4 2@5')
  t.true(r.ok)
  t.deepEqual(r.increments, [3, 4, 5, 5])
})

test('parse negative steps', (t) => {
  const r = parseSpacingPattern('-2 -3')
  t.true(r.ok)
  t.deepEqual(r.increments, [-2, -3])
})

test('parse repeat only', (t) => {
  const r = parseSpacingPattern('4@2.5')
  t.true(r.ok)
  t.deepEqual(r.increments, [2.5, 2.5, 2.5, 2.5])
})

test('parse commas', (t) => {
  const r = parseSpacingPattern('1, 2@3')
  t.true(r.ok)
  t.deepEqual(r.increments, [1, 3, 3])
})

test('reject empty', (t) => {
  const r = parseSpacingPattern('  ')
  t.false(r.ok)
})

test('reject bad token', (t) => {
  const r = parseSpacingPattern('3 x')
  t.false(r.ok)
})

test('predictNewNodeIds', (t) => {
  const struct = { nextNodeId: 10, nodes: [{ id: 1, x: 0, y: 0, z: 0 }] }
  t.deepEqual(predictNewNodeIds(struct, [1], [3, 4]), [10, 11])
  t.deepEqual(predictNewNodeIds(struct, [1, 99], [3]), [10])
})
