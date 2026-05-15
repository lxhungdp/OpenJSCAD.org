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
        color: [1, 1, 1, 0.1]
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
        gridMinorStep: 0.01
      }
    }
    const truss = {
      nodes: [],
      elements: [],
      nextNodeId: 1,
      nextElementId: 1,
      show3dMembers: false,
      sectionType: 'rect',
      sectionB: 2,
      sectionH: 2,
      sectionRadius: 1,
      sectionTf: 0.25,
      sectionTw: 0.2
    }
    return { viewer, truss }
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
    const prev = (state.viewer && state.viewer.drawing) || { snapEnabled: true, gridMinorStep: 0.01 }
    const drawing = Object.assign({}, prev, { mode: m })
    const viewer = Object.assign({}, state.viewer, { drawing })
    const out = { viewer }
    if (m === 'node' || m === 'element') {
      out.activeTool = 'truss'
    }
    return out
  },

  toggleDrawSnap: (state, snapEnabled) => {
    const prev = (state.viewer && state.viewer.drawing) || { mode: 'none', gridMinorStep: 0.01 }
    const drawing = Object.assign({}, prev, { snapEnabled: !!snapEnabled })
    const viewer = Object.assign({}, state.viewer, { drawing })
    return { viewer }
  }

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
    .tap(() => {
      if (typeof document === 'undefined') return
      const det = document.querySelector('details.toolbar-drawing-wrap')
      if (det) det.open = false
    })
    .thru(withLatestFrom(reducers.setDrawingMode, sources.state))
    .map((data) => ({ type: 'setDrawingMode', state: data, sink: 'state' }))

  const toggleDrawSnap$ = most.mergeArray([
    sources.dom.select('#toggleDrawSnap').events('click')
      .map((e) => e.target.checked)
  ])
    .thru(withLatestFrom(reducers.toggleDrawSnap, sources.state))
    .map((data) => ({ type: 'toggleDrawSnap', state: data, sink: 'state' }))

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
    otherViewerActions$
  }
}

module.exports = actions
