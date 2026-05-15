const html = require('nanohtml')
const vec3 = require('gl-vec3')
const mat4 = require('gl-mat4')

// viewer data
const rendererStuff = require('@jscad/regl-renderer')

const { pointerGestures } = require('../../most-gestures')
const { prepareRender, drawCommands, cameras, entitiesFromSolids } = rendererStuff
const perspectiveCamera = cameras.perspective
const orthographicCamera = cameras.orthographic
const orbitControls = rendererStuff.controls.orbit
const syncTrussOverlay = require('./trussOverlaySync')
const trussMembersToSolids = require('../../core/trussMembersToSolids')
const { worldPointOnPlaneFromClient, resolvePlacement } = require('../draw/planePointer')

// params
const rotateSpeed = 0.002
const panSpeed = 1
const zoomSpeed = 0.08

/** Skip zoom-to-fit when bounds are tiny (empty-design placeholder); else camera hugs micro-geometry and grid vanishes. */
const ZOOM_TO_FIT_MIN_EXTENT = 1e-3

const shouldZoomToFitForSolids = (autoZoom, solids) => {
  if (!autoZoom || !solids || solids.length === 0) return false
  try {
    const measureAggregateBoundingBox = require('@jscad/modeling').measurements.measureAggregateBoundingBox
    const bbox = measureAggregateBoundingBox(...solids)
    const dx = Math.abs(bbox[1][0] - bbox[0][0])
    const dy = Math.abs(bbox[1][1] - bbox[0][1])
    const dz = Math.abs(bbox[1][2] - bbox[0][2])
    const maxDim = Math.max(dx, dy, dz)
    if (!isFinite(maxDim) || maxDim < ZOOM_TO_FIT_MIN_EXTENT) return false
  } catch (e) {
    return false
  }
  return true
}

// internal state
let render
let viewerOptions
let camera = perspectiveCamera.defaults
let controls = orbitControls.defaults
let rotateDelta = [0, 0]
let panDelta = [0, 0]
let zoomDelta = 0
let zoomToFit = false
let updateView = true
let prevViewMode

const cloneControlsDefaults = (rotateAllowed) => {
  const c = Object.assign({}, orbitControls.defaults)
  c.userControl = Object.assign({}, orbitControls.defaults.userControl, { rotate: rotateAllowed })
  return c
}

const applyViewMode = (mode, canvasEl) => {
  if (mode === '3d') {
    controls = cloneControlsDefaults(true)
    camera.projectionType = 'perspective'
    camera.target = [0, 0, 0]
    camera.up = [0, 0, 1]
    camera.position = [150, -180, 233]
    resize(canvasEl)
    return
  }

  const presetByMode = { xy: 'top', xz: 'front', yz: 'right' }
  const preset = presetByMode[mode]
  if (!preset) return

  controls = cloneControlsDefaults(false)
  camera.projectionType = 'perspective'
  camera.target = [0, 0, 0]
  camera.up = [0, 0, 1]
  const adjustment = cameras.camera.toPresetView(preset, { camera })
  camera.position = adjustment.position
  resize(canvasEl)
  Object.assign(camera, cameras.camera.fromPerspectiveToOrthographic(camera))
}

const grid = { // command to draw the grid
  visuals: {
    drawCmd: 'drawGrid',
    show: true,
    color: [0, 0, 0, 1],
    subColor: [0, 0, 1, 0.5],
    fadeOut: false,
    transparent: true
  },
  size: [200, 200],
  ticks: [10, 1]
}

const axes = { // command to draw the axes
  visuals: {
    drawCmd: 'drawAxis',
    show: true
  }
}

/** Ensure grid/axes + solids entities are on viewerOptions each RAF (first frame runs before second viewer() else branch). */
const applyViewerEntitiesFromState = (state) => {
  if (!state || !viewerOptions || !state.viewer) return
  viewerOptions.entities = [
    state.viewer.grid.show ? grid : undefined,
    state.viewer.axes.show ? axes : undefined,
    ...prevEntities,
    ...prevTrussEntities
  ].filter((x) => x !== undefined)
}

let prevEntities = []
let prevSolids
let prevColor = []
let latestTrussState = { nodes: [], elements: [] }
let prevTrussEntities = []
let prevTrussKey = ''
let prevTrussMeshColorKey = ''
let latestAppState = null
let trussInteractionCallback = null
let drawOverlayPreview = null
let elementChainAnchorId = null
let lastPointerClient = { x: 0, y: 0 }

const viewer = (state, i18n, trussCtl) => {
  const el = html`<canvas id='renderTarget'> </canvas>`
  latestAppState = state
  latestTrussState = state.truss || latestTrussState
  if (trussCtl && typeof trussCtl.callback === 'function') {
    trussInteractionCallback = trussCtl.callback
  }

  if (!render) {
    const options = setup(el)
    if (options.error) return html`<b style="color:red; background:white; position:fixed; z-index:10; top:50%">${options.error}</b>`
    viewerOptions = options.viewerOptions
    camera = options.camera
    render = prepareRender(viewerOptions)
    const gestures = pointerGestures(el)

    window.addEventListener('resize', (evt) => { updateView = true })

    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault()
    }, { passive: false })

    gestures.drags
      .forEach((data) => {
        const ev = data.originalEvents[0]
        const { x, y } = data.delta
        const drawMode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
        const middlePan = data.type === 'mouse' && (ev.buttons & 4) !== 0
        const touchPan = Boolean(ev.touches && ev.touches.length > 2)
        if (drawMode && drawMode !== 'none') {
          if (middlePan || touchPan) {
            panDelta[0] += x
            panDelta[1] += y
          }
          return
        }
        if (middlePan || touchPan) {
          panDelta[0] += x
          panDelta[1] += y
        } else {
          rotateDelta[0] -= x
          rotateDelta[1] -= y
        }
      })

    // zoom
    gestures.zooms
      .forEach((x) => {
        zoomDelta -= x
      })

    // auto fit
    gestures.taps
      .filter((taps) => taps.nb === 2)
      .forEach((x) => {
        zoomToFit = true
      })

    const projectWorld = syncTrussOverlay.projectWorld

    const computeDrawPlacement = (clientX, clientY) => {
      const st = latestAppState
      if (!st || !st.viewer || !st.viewer.drawing || st.viewer.drawing.mode === 'none') return null
      const rect = el.getBoundingClientRect()
      const viewProj = mat4.create()
      mat4.multiply(viewProj, camera.projection, camera.view)
      const raw = worldPointOnPlaneFromClient(clientX, clientY, rect, viewProj, 0)
      if (!raw) return null
      const drawing = st.viewer.drawing || { snapEnabled: true, gridMinorStep: 0.01 }
      return resolvePlacement(raw, (st.truss && st.truss.nodes) || [], {
        snapEnabled: drawing.snapEnabled !== false,
        gridMinorStep: drawing.gridMinorStep || 0.01,
        projectWorld,
        viewProj,
        rect,
        clientX,
        clientY
      })
    }

    const updatePreviewFromPointer = (clientX, clientY) => {
      lastPointerClient = { x: clientX, y: clientY }
      const st = latestAppState
      const mode = st && st.viewer && st.viewer.drawing && st.viewer.drawing.mode
      if (!mode || mode === 'none') {
        drawOverlayPreview = null
        return
      }
      const pl = computeDrawPlacement(clientX, clientY)
      if (!pl) {
        drawOverlayPreview = null
        return
      }
      const highlightNodeId = pl.kind === 'node' ? pl.nodeId : undefined
      if (mode === 'node') {
        drawOverlayPreview = { to: { x: pl.x, y: pl.y, z: pl.z }, toKind: pl.kind, highlightNodeId }
        return
      }
      if (elementChainAnchorId != null) {
        const truss = st.truss || { nodes: [] }
        const anchorNode = truss.nodes.find((n) => n.id === elementChainAnchorId)
        if (anchorNode) {
          drawOverlayPreview = {
            from: { x: anchorNode.x, y: anchorNode.y, z: anchorNode.z },
            to: { x: pl.x, y: pl.y, z: pl.z },
            toKind: pl.kind,
            highlightNodeId
          }
          return
        }
      }
      drawOverlayPreview = { to: { x: pl.x, y: pl.y, z: pl.z }, toKind: pl.kind, highlightNodeId }
    }

    el.addEventListener('mousemove', (e) => {
      const mode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
      if (!mode || mode === 'none') return
      updatePreviewFromPointer(e.clientX, e.clientY)
      updateView = true
    })

    el.addEventListener('mouseleave', () => {
      drawOverlayPreview = null
      updateView = true
    })

    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault()
      if (e.button !== 0) return
      const st = latestAppState
      const mode = st && st.viewer && st.viewer.drawing && st.viewer.drawing.mode
      if (!mode || mode === 'none') return
      const cb = trussInteractionCallback
      if (!cb) return
      e.preventDefault()
      const pl = computeDrawPlacement(e.clientX, e.clientY)
      if (!pl) return

      if (mode === 'node') {
        if (pl.kind === 'node') return
        cb({ op: 'addNodeAt', payload: { x: pl.x, y: pl.y, z: 0 } })
        setTimeout(() => {
          updatePreviewFromPointer(e.clientX, e.clientY)
          updateView = true
        }, 0)
        return
      }

      if (elementChainAnchorId == null) {
        if (pl.kind === 'node') {
          elementChainAnchorId = pl.nodeId
        } else {
          const nid = (st.truss && st.truss.nextNodeId) || 1
          cb({ op: 'addNodeAt', payload: { x: pl.x, y: pl.y, z: 0 } })
          elementChainAnchorId = nid
        }
        setTimeout(() => {
          updatePreviewFromPointer(e.clientX, e.clientY)
          updateView = true
        }, 0)
        return
      }

      let endId
      if (pl.kind === 'node') {
        endId = pl.nodeId
      } else {
        endId = (st.truss && st.truss.nextNodeId) || 1
        cb({ op: 'addNodeAt', payload: { x: pl.x, y: pl.y, z: 0 } })
      }
      if (endId === elementChainAnchorId) return
      cb({ op: 'addElement', payload: { startId: elementChainAnchorId, endId } })
      elementChainAnchorId = endId
      setTimeout(() => {
        updatePreviewFromPointer(e.clientX, e.clientY)
        updateView = true
      }, 0)
    }, { passive: false })

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      const mode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
      if (mode === 'element') {
        elementChainAnchorId = null
        updatePreviewFromPointer(lastPointerClient.x, lastPointerClient.y)
        updateView = true
      }
    })

    const doRotatePanZoom = () => {
      if (rotateDelta[0] || rotateDelta[1]) {
        const updated = orbitControls.rotate({ controls, camera, speed: rotateSpeed }, rotateDelta)
        rotateDelta = [0, 0]
        controls = { ...controls, ...updated.controls }
        updateView = true
      }

      if (panDelta[0] || panDelta[1]) {
        const updated = orbitControls.pan({ controls, camera, speed: panSpeed }, panDelta)
        panDelta = [0, 0]
        camera.position = updated.camera.position
        camera.target = updated.camera.target
        updateView = true
      }

      if (zoomDelta) {
        const updated = orbitControls.zoom({ controls, camera, speed: zoomSpeed }, zoomDelta)
        controls = { ...controls, ...updated.controls }
        zoomDelta = 0
        updateView = true
      }

      if (zoomToFit) {
        controls.zoomToFit.tightness = 1.5
        const zoomFitEntities = [...prevEntities, ...prevTrussEntities]
        const updated = orbitControls.zoomToFit({ controls, camera, entities: zoomFitEntities })
        controls = { ...controls, ...updated.controls }
        zoomToFit = false
        updateView = true
      }
    }

    // the heart of rendering, as themes, controls, etc change
    const updateAndRender = (timestamp) => {
      doRotatePanZoom()

      const drawMode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
      if (drawMode !== 'element') {
        elementChainAnchorId = null
      }

      applyViewerEntitiesFromState(latestAppState)

      if (updateView) {
        const updated = orbitControls.update({ controls, camera })
        controls = { ...controls, ...updated.controls }
        updateView = controls.changed // for elasticity in rotate / zoom

        camera.position = updated.camera.position
        perspectiveCamera.update(camera)

        resize(el)
        render(viewerOptions)
      }

      const stack = el.parentElement
      const svg = stack && stack.querySelector('#trussOverlay')
      if (svg) {
        syncTrussOverlay(svg, latestTrussState, camera, el, drawOverlayPreview)
      }

      window.requestAnimationFrame(updateAndRender)
    }
    window.requestAnimationFrame(updateAndRender)
  } else {
    // only generate entities when the solids change
    // themes, options, etc also change the viewer state
    const designSolids = state.design.solids.filter((solid) => solid && (solid instanceof Object))
    // Truss mode: hide all design geometry so only grid/axes + screen-space truss overlay show
    const solids = state.activeTool === 'truss' ? [] : designSolids
    if (prevSolids) {
      const theme = state.themes.themeSettings.viewer
      const color = theme.rendering.meshColor
      const sameColor = prevColor === color
      const sameSolids = compareSolids(solids, prevSolids)
      if (!(sameSolids && sameColor)) {
        prevEntities = entitiesFromSolids({ color }, solids)
        prevColor = color

        zoomToFit = shouldZoomToFitForSolids(state.viewer.rendering.autoZoom, solids)
      }
    }
    prevSolids = solids

    let meshColor
    let truss3d = false
    if (state.themes && state.themes.themeSettings) {
      meshColor = state.themes.themeSettings.viewer.rendering.meshColor
      truss3d =
        state.activeTool === 'truss' &&
        state.truss &&
        state.truss.show3dMembers
    }

    let trussKey = ''
    if (truss3d) {
      const tr = state.truss
      trussKey = JSON.stringify({
        n: tr.nodes,
        e: tr.elements,
        t: tr.sectionType,
        b: tr.sectionB,
        h: tr.sectionH,
        r: tr.sectionRadius,
        tf: tr.sectionTf,
        tw: tr.sectionTw
      })
    }

    if (truss3d && meshColor !== undefined) {
      const meshColorKey = JSON.stringify(meshColor)
      if (trussKey !== prevTrussKey || meshColorKey !== prevTrussMeshColorKey) {
        const memberSolids = trussMembersToSolids(state.truss)
        prevTrussEntities = entitiesFromSolids({ color: meshColor }, memberSolids)
        prevTrussKey = trussKey
        prevTrussMeshColorKey = meshColorKey
        zoomToFit = shouldZoomToFitForSolids(state.viewer.rendering.autoZoom, memberSolids)
        updateView = true
      }
    } else if (prevTrussEntities.length > 0 || prevTrussKey !== '') {
      prevTrussEntities = []
      prevTrussKey = ''
      prevTrussMeshColorKey = ''
      updateView = true
    }

    if (state.themes && state.themes.themeSettings) {
      const theme = state.themes.themeSettings.viewer
      grid.visuals.color = theme.grid.color
      grid.visuals.subColor = theme.grid.subColor

      if (viewerOptions.rendering) {
        viewerOptions.rendering.background = theme.rendering.background
        viewerOptions.rendering.meshColor = theme.rendering.meshColor
        updateView = true
      }
    }

    viewerOptions.entities = [
      state.viewer.grid.show ? grid : undefined,
      state.viewer.axes.show ? axes : undefined,
      ...prevEntities,
      ...prevTrussEntities
    ].filter((x) => x !== undefined)

    const viewMode = (state.viewer.camera && state.viewer.camera.viewMode) || '3d'
    if (prevViewMode !== viewMode) {
      applyViewMode(viewMode, el)
      prevViewMode = viewMode
      updateView = true
    }

    // special camera commands
    if (state.viewer.camera.position !== '') {
      const adjustment = cameras.camera.toPresetView(state.viewer.camera.position, { camera })
      camera.position = adjustment.position
      perspectiveCamera.update(camera, camera)

      state.viewer.camera.position = ''
    }
    if (state.viewer.rendering) {
      controls.autoRotate.enabled = state.viewer.rendering.autoRotate
    }
  }

  return el
}

const createContext = (canvas, contextAttributes) => {
  const get = (type) => {
    try {
      // NOTE: older browsers may return null from getContext()
      const context = canvas.getContext(type)
      return context ? { gl: context, type } : null
    } catch (e) {
      return null
    }
  }
  return (
    get('webgl2') ||
    get('webgl') ||
    get('experimental-webgl') ||
    get('webgl-experimental')
  )
}

const setup = (element) => {
  // prepare the camera
  let error
  const camera = Object.assign({}, perspectiveCamera.defaults)
  camera.position = [150, -180, 233]

  const { gl, type } = createContext(element)

  const viewerOptions = {
    glOptions: { gl },
    camera,
    drawCommands: {
      // draw commands bootstrap themselves the first time they are run
      drawAxis: drawCommands.drawAxis,
      drawGrid: drawCommands.drawGrid,
      drawLines: drawCommands.drawLines,
      drawMesh: drawCommands.drawMesh
    },
    // data
    entities: []
  }
  if (type === 'webgl') {
    if (gl.getExtension('OES_element_index_uint')) {
      viewerOptions.glOptions.optionalExtensions = ['oes_element_index_uint']
    }
  }
  return { viewerOptions, camera, error }
}

const resize = (viewerElement) => {
  const pixelRatio = window.devicePixelRatio || 1
  const bounds = viewerElement.getBoundingClientRect()

  const width = (bounds.right - bounds.left) * pixelRatio
  const height = (bounds.bottom - bounds.top) * pixelRatio

  const prevWidth = viewerElement.width
  const prevHeight = viewerElement.height

  if (prevWidth !== width || prevHeight !== height) {
    viewerElement.width = width
    viewerElement.height = height

    if (camera.projectionType === 'orthographic') {
      const aspect = width / height
      const distance = vec3.length(vec3.subtract([], camera.position, camera.target)) * 0.3
      const frustumWidth = Math.tan(camera.fov) * distance * aspect
      const frustumHeight = Math.tan(camera.fov) * distance
      Object.assign(camera, orthographicCamera.setProjection(camera, { width: frustumWidth, height: frustumHeight }))
      camera.viewport = [0, 0, width, height]
      camera.aspect = aspect
    } else {
      perspectiveCamera.setProjection(camera, camera, { width, height })
    }
    perspectiveCamera.update(camera, camera)
  }
}

let idCounter = Date.now()
const compareSolids = (current, previous) => {
  // add an id to each solid if not already
  current = current.map((s) => {
    if (!s.id) s.id = ++idCounter
    return s
  })
  // check if the solids are the same
  if (!previous) return false
  if (current.length !== previous.length) return false
  return current.reduce((acc, id, i) => acc && current[i].id === previous[i].id, true)
}

module.exports = viewer
