const test = require('ava')
const { sectionToFemProps } = require('./sectionToFemProps')

test('rect section properties', (t) => {
  const p = sectionToFemProps({ type: 'rec', b: 2, H: 4 })
  t.truthy(p)
  t.is(p.area, 8)
  t.true(p.momentInertiaZ > p.momentInertiaY)
})

test('circle section properties', (t) => {
  const p = sectionToFemProps({ type: 'circle', r: 1 })
  t.truthy(p)
  t.true(Math.abs(p.area - Math.PI) < 1e-9)
})

test('I_Shape section properties', (t) => {
  const p = sectionToFemProps({ type: 'I_Shape', b: 10, H: 20, tw: 0.5, tf: 1, r: 0 })
  t.truthy(p)
  t.true(p.area > 0)
  t.true(p.momentInertiaZ > 0)
})
