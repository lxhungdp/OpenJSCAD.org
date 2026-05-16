const test = require('ava')
const { buildMemberChains, nodeByIdFromNodes } = require('./structureMemberChains')

const nodes = [
  { id: 1, x: 0, y: 0, z: 0 },
  { id: 2, x: 5, y: 0, z: 0 },
  { id: 3, x: 10, y: 0, z: 0 }
]

test('collinear 1-2 and 2-3 merge to one chain', (t) => {
  const nodeById = nodeByIdFromNodes(nodes)
  const chains = buildMemberChains(nodeById, [
    { id: 1, iNode: 1, jNode: 2 },
    { id: 2, iNode: 2, jNode: 3 }
  ])
  t.is(chains.length, 1)
  t.deepEqual(chains[0].nodeIds, [1, 2, 3])
})

test('corner does not merge', (t) => {
  const cornerNodes = [
    { id: 1, x: 0, y: 0, z: 0 },
    { id: 2, x: 5, y: 0, z: 0 },
    { id: 3, x: 5, y: 5, z: 0 }
  ]
  const nodeById = nodeByIdFromNodes(cornerNodes)
  const chains = buildMemberChains(nodeById, [
    { id: 1, iNode: 1, jNode: 2 },
    { id: 2, iNode: 2, jNode: 3 }
  ])
  t.is(chains.length, 2)
})
