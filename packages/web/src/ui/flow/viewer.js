const most = require('most')

const { withLatestFrom } = require('../../most-utils')

const reducers = {
  initialize: (state) => {
    const viewer = {
      rendering: {
        background: [1, 1, 1, 1],
        meshColor: [0, 0.6, 1, 1],
        autoRotate: false,
        autoZoom: true
      },
      grid: {
        show: true,
        color: [1, 1, 1, 0.1],
        /** World extent along X and Y (grid lines from −size/2 to +size/2 on each axis). */
        size: [200, 200],
        majorStep: 10,
        minorStep: 1
      },
      axes: {
        show: true
      },
      camera: {
        position: '',
        viewMode: '3d'
      },
      drawing: {
        mode: 'none',
        snapEnabled: true,
        showNodeIds: true,
        showElementIds: true,
        showSecId: false,
        showMatId: false,
        showRestraints: true,
        showReleased: true
      },
      selection: {
        mode: 'none',
        selectedNodeIds: [],
        selectedElementIds: []
      }
    }
    const structure = require('../../core/structure/defaultStructure')()
    return { viewer, structure }
  },

  toggleAutoRotate: (state, autoRotate) => {
    const rendering = Object.assign({}, state.viewer.rendering, { autoRotate })
    const viewer = Object.assign({}, state.viewer, { rendering })
    return { viewer }
  },

  toggleAutoZoom: (state, autoZoom) => {
    const rendering = Object.assign({}, state.viewer.rendering, { autoZoom })
    const viewer = Object.assign({}, state.viewer, { rendering })
    return { viewer }
  },

  toggleGrid: (state, show) => {
    const grid = Object.assign({}, state.viewer.grid, { show })
    const viewer = Object.assign({}, state.viewer, { grid })
    return { viewer }
  },

  toggleAxes: (state, show) => {
    const axes = Object.assign({}, state.viewer.axes, { show })
    const viewer = Object.assign({}, state.viewer, { axes })
    return { viewer }
  },

  setGridLayout: (state, patch) => {
    const g0 = (state.viewer && state.viewer.grid) || {}
    const grid = Object.assign(
      {
        show: true,
        color: [1, 1, 1, 0.1],
        size: [200, 200],
        majorStep: 10,
        minorStep: 1
      },
      g0
    )
    const size = Array.isArray(grid.size) ? [...grid.size] : [200, 200]
    if (typeof patch.minorStep === 'number' && isFinite(patch.minorStep) && patch.minorStep > 0) {
      grid.minorStep = patch.minorStep
    }
    if (typeof patch.majorStep === 'number' && isFinite(patch.majorStep) && patch.majorStep > 0) {
      grid.majorStep = patch.majorStep
    }
    if (typeof patch.sizeX === 'number' && isFinite(patch.sizeX) && patch.sizeX > 0) {
      size[0] = patch.sizeX
    }
    if (typeof patch.sizeY === 'number' && isFinite(patch.sizeY) && patch.sizeY > 0) {
      size[1] = patch.sizeY
    }
    grid.size = size
    const viewer = Object.assign({}, state.viewer, { grid })
    return { viewer }
  },

  toPresetView: (state, position) => {
    const camera = Object.assign({}, state.viewer.camera, { position })
    const viewer = Object.assign({}, state.viewer, { camera })
    return { viewer }
  },

  setProjectionType: (state, projectionType) => {
    const viewer = Object.assign({}, state.viewer, { camera: { projectionType } })
    return { viewer }
  },

  setViewMode: (state, viewMode) => {
    const camera = Object.assign({}, state.viewer.camera, { viewMode })
    const viewer = Object.assign({}, state.viewer, { camera })
    return { viewer }
  },

  setDrawingMode: (state, mode) => {
    const m = (mode === 'node' || mode === 'element' || mode === 'none') ? mode : 'none'
    const prev = (state.viewer && state.viewer.drawing) || { snapEnabled: true }
    const drawing = Object.assign({}, prev, { mode: m })
    const selectionDefaults = { mode: 'none', selectedNodeIds: [], selectedElementIds: [] }
    const prevSel = (state.viewer && state.viewer.selection) || selectionDefaults
    const selection =
      m !== 'none'
        ? Object.assign({}, prevSel, selectionDefaults)
        : prevSel
    const viewer = Object.assign({}, state.viewer, { drawing, selection })
    return { viewer }
  },

  toggleDrawSnap: (state, snapEnabled) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { snapEnabled: !!snapEnabled })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  },

  toggleShowNodeIds: (state, show) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { showNodeIds: !!show })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  },

  toggleShowElementIds: (state, show) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { showElementIds: !!show })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  },

  toggleShowSecId: (state, show) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { showSecId: !!show })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  },

  toggleShowMatId: (state, show) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { showMatId: !!show })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  },

  toggleShowRestraints: (state, show) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { showRestraints: !!show })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  },

  toggleShowReleased: (state, show) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none' }
    const drawing = Object.assign({}, prev, { showReleased: !!show })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  }

}

/** Toggle: same mode again -> off; other mode -> switch; explicit none from Escape hook. */
const resolveDrawingModeFromClick = (state, clickMode) => {
  const cur = (state.viewer && state.viewer.drawing && state.viewer.drawing.mode) || 'none'
  if (!clickMode || clickMode === 'none') {
    return reducers.setDrawingMode(state, 'none')
  }
  if (clickMode === 'node' || clickMode === 'element') {
    const next = clickMode === cur ? 'none' : clickMode
    return reducers.setDrawingMode(state, next)
  }
  return reducers.setDrawingMode(state, 'none')
}

const actions = ({ sources }) => {
  const initializeViewer$ = most.just({})
    .thru(withLatestFrom(reducers.initialize, sources.state))
    .map((payload) => Object.assign({}, { type: 'initializeViewer', sink: 'state' }, { state: payload }))

  const toggleGrid$ = most.mergeArray([
    sources.dom.select('#toggleGrid').events('click')
      .map((e) => e.target.checked)
    // sources.store
    // .filter((reply) => reply.target === 'settings' && reply.type === 'read' && reply.data && reply.data.viewer && reply.data.viewer.grid && reply.data.viewer.grid.show !== undefined)
    // .map((reply) => reply.data.viewer.grid.show)
  ])
    .thru(withLatestFrom(reducers.toggleGrid, sources.state))
    .map((data) => ({ type: 'toggleGrid', state: data, sink: 'state' }))

  const toggleAxes$ = most.mergeArray([
    sources.dom.select('#toggleAxes').events('click')
      .map((e) => e.target.checked)
    // sources.store
    // .filter((reply) => reply.target === 'settings' && reply.type === 'read' && reply.data && reply.data.viewer && reply.data.viewer.axes && reply.data.viewer.axes.show !== undefined)
    // .map((reply) => reply.data.viewer.axes.show)
  ])
    .thru(withLatestFrom(reducers.toggleAxes, sources.state))
    .map((data) => ({ type: 'toggleAxes', state: data, sink: 'state' }))

  const toggleAutoRotate$ = most.mergeArray([
    sources.dom.select('#toggleAutoRotate').events('click')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleAutoRotate, sources.state))
    .map((data) => ({ type: 'toggleAutoRotate', state: data, sink: 'state' }))

  const toggleAutoZoom$ = most.mergeArray([
    sources.dom.select('#toggleAutoZoom').events('click')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleAutoZoom, sources.state))
    .map((data) => ({ type: 'toggleAutoZoom', state: data, sink: 'state' }))

  const setViewMode$ = most.mergeArray([
    sources.dom.select('.view-mode-btn').events('click')
      .map((e) => {
        const btn = e.target && e.target.closest && e.target.closest('.view-mode-btn')
        return btn ? btn.getAttribute('data-view-mode') : undefined
      })
      .filter((mode) => mode === '3d' || mode === 'xy' || mode === 'xz' || mode === 'yz')
  ])
    .thru(withLatestFrom(reducers.setViewMode, sources.state))
    .map((data) => ({ type: 'setViewMode', state: data, sink: 'state' }))

  const setDrawingMode$ = most.mergeArray([
    sources.dom.select('.drawing-mode-btn').events('click')
      .map((e) => {
        const btn = e.target && e.target.closest && e.target.closest('.drawing-mode-btn')
        return btn ? btn.getAttribute('data-drawing-mode') : undefined
      })
      .filter((m) => m === 'none' || m === 'node' || m === 'element'),
    sources.dom.select('.example').events('click').map(() => 'none')
  ])
    .thru(withLatestFrom(resolveDrawingModeFromClick, sources.state))
    .map((data) => ({ type: 'setDrawingMode', state: data, sink: 'state' }))

  const toggleDrawSnap$ = most.mergeArray([
    sources.dom.select('#toggleDrawSnap').events('click')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleDrawSnap, sources.state))
    .map((data) => ({ type: 'toggleDrawSnap', state: data, sink: 'state' }))

  const toggleShowNodeIds$ = most.mergeArray([
    sources.dom.select('#displayShowNodeIds').events('change')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleShowNodeIds, sources.state))
    .map((data) => ({ type: 'toggleShowNodeIds', state: data, sink: 'state' }))

  const toggleShowElementIds$ = most.mergeArray([
    sources.dom.select('#displayShowElementIds').events('change')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleShowElementIds, sources.state))
    .map((data) => ({ type: 'toggleShowElementIds', state: data, sink: 'state' }))

  const toggleShowSecId$ = most.mergeArray([
    sources.dom.select('#displayShowSecId').events('change')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleShowSecId, sources.state))
    .map((data) => ({ type: 'toggleShowSecId', state: data, sink: 'state' }))

  const toggleShowMatId$ = most.mergeArray([
    sources.dom.select('#displayShowMatId').events('change')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleShowMatId, sources.state))
    .map((data) => ({ type: 'toggleShowMatId', state: data, sink: 'state' }))

  const toggleShowRestraints$ = most.mergeArray([
    sources.dom.select('#displayShowRestraints').events('change')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleShowRestraints, sources.state))
    .map((data) => ({ type: 'toggleShowRestraints', state: data, sink: 'state' }))

  const toggleShowReleased$ = most.mergeArray([
    sources.dom.select('#displayShowReleased').events('change')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleShowReleased, sources.state))
    .map((data) => ({ type: 'toggleShowReleased', state: data, sink: 'state' }))

  const gridLayoutFromInput = (e) => {
    const id = e.target && e.target.id
    const v = parseFloat(e.target.value)
    if (!id || !isFinite(v)) return null
    if (id === 'gridMinorStep') return { minorStep: v }
    if (id === 'gridMajorStep') return { majorStep: v }
    if (id === 'gridSizeX') return { sizeX: v }
    if (id === 'gridSizeY') return { sizeY: v }
    return null
  }

  const setGridLayout$ = most.mergeArray([
    sources.dom.select('#gridMinorStep').events('input').map(gridLayoutFromInput),
    sources.dom.select('#gridMajorStep').events('input').map(gridLayoutFromInput),
    sources.dom.select('#gridSizeX').events('input').map(gridLayoutFromInput),
    sources.dom.select('#gridSizeY').events('input').map(gridLayoutFromInput)
  ])
    .filter((p) => p !== null)
    .thru(withLatestFrom(reducers.setGridLayout, sources.state))
    .map((data) => ({ type: 'setGridLayout', state: data, sink: 'state' }))

  // all other viewer actions, triggered from elsewhere
  const otherActions = ['toPresetView']
  const otherViewerActions$ = sources.actions
    .filter((action) => otherActions.includes(action.type))
    .thru(withLatestFrom((state, action) => reducers[action.type](state, action.data), sources.state))
    .map((data) => ({ type: 'otherActions', state: data, sink: 'state' }))

  return {
    // 3d viewer
    initializeViewer$,
    toggleGrid$,
    toggleAxes$,
    toggleAutoRotate$,
    toggleAutoZoom$,
    setViewMode$,
    setDrawingMode$,
    toggleDrawSnap$,
    toggleShowNodeIds$,
    toggleShowElementIds$,
    toggleShowSecId$,
    toggleShowMatId$,
    toggleShowRestraints$,
    toggleShowReleased$,
    setGridLayout$,
    otherViewerActions$
  }
}

module.exports = actions
