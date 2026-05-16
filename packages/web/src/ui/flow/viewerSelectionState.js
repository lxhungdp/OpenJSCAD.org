const defaultSelection = () => ({
  mode: 'none',
  selectedNodeIds: [],
  selectedElementIds: []
})

const ensure = (state) => {
  const v = state.viewer || {}
  const s = v.selection || {}
  return Object.assign(defaultSelection(), s)
}

const setSelectionMode = (state, mode) => {
  const m = mode === 'select' ? 'select' : 'none'
  const prevDrawing = state.viewer.drawing || { mode: 'none', snapEnabled: true }
  const drawing =
    m === 'select'
      ? Object.assign({}, prevDrawing, { mode: 'none' })
      : prevDrawing
  const sel =
    m === 'select'
      ? { mode: 'select', selectedNodeIds: [], selectedElementIds: [] }
      : defaultSelection()
  const viewer = Object.assign({}, state.viewer, { drawing, selection: sel })
  return { viewer }
}

const setSelection = (state, { selectedNodeIds, selectedElementIds }) => {
  const uniq = (arr) =>
    [...new Set((arr || []).map((x) => Number(x)).filter((n) => isFinite(n)))]
  const sel = Object.assign(ensure(state), {
    selectedNodeIds: uniq(selectedNodeIds),
    selectedElementIds: uniq(selectedElementIds)
  })
  const viewer = Object.assign({}, state.viewer, { selection: sel })
  return { viewer }
}

const clearSelection = (state) => {
  const sel = Object.assign(ensure(state), { selectedNodeIds: [], selectedElementIds: [] })
  const viewer = Object.assign({}, state.viewer, { selection: sel })
  return { viewer }
}

module.exports = {
  defaultSelection,
  ensure,
  setSelectionMode,
  setSelection,
  clearSelection
}
