/** DOF order: ux, uy, uz, rx, ry, rz — true = restrained (FEM). */
const RESTRAINT_PRESETS = {
  fixed: [true, true, true, true, true, true],
  pinned: [true, true, true, false, false, false],
  'horizontal-roller': [false, true, true, false, false, false],
  'vertical-roller': [true, false, true, false, false, false]
}

/** UI quick-select (FEM names). */
const RESTRAINT_PRESET_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'horizontal-roller', label: 'Hor. Roller' },
  { value: 'vertical-roller', label: 'Ver. Roller' },
  { value: 'custom', label: 'Others' },
  { value: 'free', label: 'Free' }
]

const matchesTuple = (dofs, tuple) =>
  dofs.length === 6 && tuple.length === 6 && dofs.every((v, i) => !!v === !!tuple[i])

const isFreeDofs = (dofs) => dofs && dofs.length === 6 && dofs.every((v) => !v)

/**
 * @param {boolean[]} dofs
 * @returns {'fixed'|'pinned'|'horizontal-roller'|'vertical-roller'|'custom'|'free'}
 */
const inferPresetFromDofs = (dofs) => {
  if (!dofs || dofs.length !== 6) return 'custom'
  if (isFreeDofs(dofs)) return 'free'
  if (matchesTuple(dofs, RESTRAINT_PRESETS.fixed)) return 'fixed'
  if (matchesTuple(dofs, RESTRAINT_PRESETS.pinned)) return 'pinned'
  if (matchesTuple(dofs, RESTRAINT_PRESETS['horizontal-roller'])) return 'horizontal-roller'
  if (matchesTuple(dofs, RESTRAINT_PRESETS['vertical-roller'])) return 'vertical-roller'
  return 'custom'
}

const dofsForPreset = (preset) => {
  if (preset === 'free') return [false, false, false, false, false, false]
  if (preset === 'custom') return null
  if (RESTRAINT_PRESETS[preset]) return RESTRAINT_PRESETS[preset].slice()
  return null
}

/**
 * @param {{ preset?: string, dofs?: boolean[] }} restraint
 * @returns {boolean[]|null}
 */
const restraintDofs = (restraint) => {
  if (!restraint) return null
  if (restraint.preset === 'free') return [false, false, false, false, false, false]
  if (restraint.preset && restraint.preset !== 'custom' && RESTRAINT_PRESETS[restraint.preset]) {
    return RESTRAINT_PRESETS[restraint.preset].slice()
  }
  if (Array.isArray(restraint.dofs) && restraint.dofs.length === 6) {
    return restraint.dofs.map((x) => !!x)
  }
  return null
}

/**
 * @param {boolean[]} dofs
 * @returns {'fixed'|'pyramid'|'hor-roller'|'ver-roller'|'others'|null}
 */
const glyphKindFromDofs = (dofs) => {
  if (!dofs || dofs.length !== 6 || isFreeDofs(dofs)) return null
  if (matchesTuple(dofs, RESTRAINT_PRESETS.fixed)) return 'fixed'
  if (matchesTuple(dofs, RESTRAINT_PRESETS.pinned)) return 'pyramid'
  if (matchesTuple(dofs, RESTRAINT_PRESETS['horizontal-roller'])) return 'hor-roller'
  if (matchesTuple(dofs, RESTRAINT_PRESETS['vertical-roller'])) return 'ver-roller'
  return 'others'
}

const glyphKindForRestraint = (restraint) => {
  const dofs = restraintDofs(restraint)
  if (!dofs) return null
  if (restraint.preset === 'custom') return 'others'
  return glyphKindFromDofs(dofs)
}

const effectivePresetForRestraint = (restraint) => {
  if (!restraint) return 'free'
  if (restraint.preset && restraint.preset !== 'custom') return restraint.preset
  const dofs = restraintDofs(restraint)
  return dofs ? inferPresetFromDofs(dofs) : 'custom'
}

module.exports = {
  RESTRAINT_PRESETS,
  RESTRAINT_PRESET_OPTIONS,
  restraintDofs,
  inferPresetFromDofs,
  dofsForPreset,
  isFreeDofs,
  glyphKindFromDofs,
  glyphKindForRestraint,
  effectivePresetForRestraint,
  matchesTuple
}
