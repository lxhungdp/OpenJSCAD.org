const test = require('ava')
const { momentArcStartAngle, worldLenForScreenPx } = require('./loadGlyphs')

const identityProj = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]

const orthoProject = (x, y, z, viewProj, cssW, cssH) => {
  const ndcx = x
  const ndcy = y
  const ndcz = z
  if (ndcz < -1.02 || ndcz > 1.02) return null
  const px = (ndcx * 0.5 + 0.5) * cssW
  const py = (1 - (ndcy * 0.5 + 0.5)) * cssH
  return [px, py, ndcz]
}

test('momentArcStartAngle differs by sign', (t) => {
  t.not(momentArcStartAngle('xy', 1), momentArcStartAngle('xy', -1))
})

test('worldLenForScreenPx scales with target', (t) => {
  const w1 = worldLenForScreenPx(orthoProject, 0, 0, 0, 1, 0, 0, 20, identityProj, 400, 300)
  const w2 = worldLenForScreenPx(orthoProject, 0, 0, 0, 1, 0, 0, 40, identityProj, 400, 300)
  t.true(w2 > w1)
})
