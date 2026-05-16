const test = require('ava')
const { canonicalLineAxis, memberRotationPaToPb } = require('./structureMembersToSolids')

const col = (m, c) => [m[c * 4], m[c * 4 + 1], m[c * 4 + 2]]

const near = (a, b) => Math.abs(a - b) < 1e-9

test('canonicalLineAxis matches for opposite element directions on same line', (t) => {
  const a = canonicalLineAxis([1, 0, 0])
  const b = canonicalLineAxis([-1, 0, 0])
  t.true(near(a[0], b[0]) && near(a[1], b[1]) && near(a[2], b[2]))
})

test('memberRotationPaToPb keeps section frame at collinear joints', (t) => {
  const r1 = memberRotationPaToPb([1, 0, 0])
  const r2 = memberRotationPaToPb([-1, 0, 0])
  const up1 = col(r1, 0)
  const up2 = col(r2, 0)
  const side1 = col(r1, 1)
  const side2 = col(r2, 1)
  t.true(up1.every((v, i) => near(v, up2[i])))
  t.true(side1.every((v, i) => near(v, side2[i])))
  t.true(near(col(r1, 2)[0], 1) && near(col(r2, 2)[0], -1))
})
