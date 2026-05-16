const test = require('ava')
const { normalizeReleaseEnd } = require('./releaseGlyphs')

test('normalizeReleaseEnd', (t) => {
  t.is(normalizeReleaseEnd('start'), 'start')
  t.is(normalizeReleaseEnd('both'), 'both')
  t.is(normalizeReleaseEnd('none'), null)
  t.is(normalizeReleaseEnd(undefined), null)
})
