const test = require('ava')
const {
  inferPresetFromDofs,
  glyphKindFromDofs,
  glyphKindForRestraint,
  RESTRAINT_PRESETS,
  isFreeDofs
} = require('./restraintDofs')

test('FEM presets infer and glyph', (t) => {
  t.is(inferPresetFromDofs(RESTRAINT_PRESETS.fixed), 'fixed')
  t.is(glyphKindFromDofs(RESTRAINT_PRESETS.fixed), 'fixed')
  t.is(inferPresetFromDofs(RESTRAINT_PRESETS.pinned), 'pinned')
  t.is(glyphKindFromDofs(RESTRAINT_PRESETS.pinned), 'pyramid')
  t.is(inferPresetFromDofs(RESTRAINT_PRESETS['horizontal-roller']), 'horizontal-roller')
  t.is(glyphKindFromDofs(RESTRAINT_PRESETS['horizontal-roller']), 'hor-roller')
  t.is(inferPresetFromDofs(RESTRAINT_PRESETS['vertical-roller']), 'vertical-roller')
  t.is(glyphKindFromDofs(RESTRAINT_PRESETS['vertical-roller']), 'ver-roller')
})

test('custom dofs → Others', (t) => {
  const custom = [true, false, false, true, false, false]
  t.is(inferPresetFromDofs(custom), 'custom')
  t.is(glyphKindFromDofs(custom), 'others')
  t.is(glyphKindForRestraint({ preset: 'custom', dofs: custom }), 'others')
})

test('free has no glyph', (t) => {
  t.true(isFreeDofs([false, false, false, false, false, false]))
  t.is(glyphKindFromDofs([false, false, false, false, false, false]), null)
})
