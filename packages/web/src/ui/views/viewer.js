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
const structureMembersToSolids = require('../../core/structureMembersToSolids')
const structureReducers = require('../flow/structureReducers')
const { worldPointOnPlaneFromClient, resolvePlacement } = require('../draw/planePointer')

// params
const rotateSpeed = 0.002
const panSpeed = 1
const zoomSpeed = 0.08

/**
 * Default 3D orbit eye position (target is origin, up is +Z).
 * Built from a classic opener, scaled closer for zoom-in, then rotated in XY (CCW from +Z).
 */
const INITIAL_3D_REFERENCE_EYE = [150, -180, 233]
/** Smaller = closer to target (more zoom in). */
const INITIAL_3D_DISTANCE_SCALE = 0.1
/** Orbit reference eye around world +Z (degrees). Positive = anticlockwise when looking down +Z. */
const INITIAL_3D_ORBIT_Z_DEG = 290

const makeInitial3dCameraPosition = () => {
  const sx = INITIAL_3D_REFERENCE_EYE[0] * INITIAL_3D_DISTANCE_SCALE
  const sy = INITIAL_3D_REFERENCE_EYE[1] * INITIAL_3D_DISTANCE_SCALE
  const sz = INITIAL_3D_REFERENCE_EYE[2] * INITIAL_3D_DISTANCE_SCALE
  const rad = (INITIAL_3D_ORBIT_Z_DEG * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const xr = sx * c - sy * s
  const yr = sx * s + sy * c
  return [xr, yr, sz]
}

const INITIAL_3D_CAMERA_POSITION = makeInitial3dCameraPosition()

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

/** Rounded bbox signature so re-instantiated solids (new object ids) do not re-trigger auto zoom. */
const getSolidsBBoxKey = (solids) => {
  if (!solids || solids.length === 0) return ''
  try {
    const measureAggregateBoundingBox = require('@jscad/modeling').measurements.measureAggregateBoundingBox
    const bbox = measureAggregateBoundingBox(...solids)
    const r = (n) => Math.round(n * 1e6) / 1e6
    return bbox.map((corner) => corner.map(r).join(',')).join('|')
  } catch (e) {
    return ''
  }
}

const rgbaArraysEqual = (a, b) => {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
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
    camera.position = [...INITIAL_3D_CAMERA_POSITION]
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

let prevGridLayoutKey = ''

const syncGridEntityFromState = (state) => {
  if (!state || !state.viewer || !state.viewer.grid) return
  const g = state.viewer.grid
  const sx = (Array.isArray(g.size) && g.size[0] > 0) ? g.size[0] : 200
  const sy = (Array.isArray(g.size) && g.size[1] > 0) ? g.size[1] : 200
  const major = (typeof g.majorStep === 'number' && isFinite(g.majorStep) && g.majorStep > 0) ? g.majorStep : 10
  const minor = (typeof g.minorStep === 'number' && isFinite(g.minorStep) && g.minorStep > 0) ? g.minorStep : 1
  grid.size = [sx, sy]
  grid.ticks = [major, minor]
  const layoutKey = `${sx},${sy},${major},${minor}`
  if (layoutKey !== prevGridLayoutKey) {
    prevGridLayoutKey = layoutKey
    // prepareRender only builds a new draw command when cacheId is unset (or cache miss in patched renderer).
    // A preset string id with no Map entry yields drawCmd === undefined and breaks the whole pass.
    delete grid.visuals.cacheId
    updateView = true
  }
}

const grid = { // command to draw the grid (size/ticks synced from state in syncGridEntityFromState)
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
  syncGridEntityFromState(state)
  viewerOptions.entities = [
    state.viewer.grid.show ? grid : undefined,
    state.viewer.axes.show ? axes : undefined,
    ...prevEntities,
    ...prevStructureEntities
  ].filter((x) => x !== undefined)
}

let prevEntities = []
let prevSolids
let prevColor = []
let latestStructureState = structureReducers.ensure({})
let prevStructureEntities = []
let prevStructureKey = ''
let prevStructureMeshColorKey = ''
/** Last bbox used for auto zoom-to-fit (avoids repeated fit on identical geometry recompile). */
let lastAutoZoomBBoxKey = null
/** Serialized theme rendering props applied to viewerOptions (avoid RAF orbit update every tick). */
let lastAppliedThemeRenderingKey = ''
let latestAppState = null
let structureInteractionCallback = null
let drawOverlayPreview = null
let elementChainAnchorId = null
let lastPointerClient = { x: 0, y: 0 }

/** One canvas for the app lifetime: each `viewer()` render used to mint a new `<canvas>`, morphdom swapped it out, and regl kept rendering a detached context → blank white viewport. */
let persistentViewerCanvas = null

const viewer = (state, i18n, structureCtl) => {
  if (!persistentViewerCanvas) {
    persistentViewerCanvas = html`<canvas id='renderTarget'> </canvas>`
  }
  const el = persistentViewerCanvas
  latestAppState = state
  latestStructureState = structureReducers.ensure(state)
  if (structureCtl && typeof structureCtl.callback === 'function') {
    structureInteractionCallback = structureCtl.callback
  }

  if (!render) {
    const options = setup(el)
    if (options.error) return html`<b style="color:red; background:white; position:fixed; z-index:10; top:50%">${options.error}</b>`
    viewerOptions = options.viewerOptions
    camera = options.camera
    render = prepareRender(viewerOptions)
    // Match orbit controls + projection to camera now; else branch may run late or not at all
    // (e.g. duplicate state skipped), leaving defaults out of sync with INITIAL_3D_CAMERA_POSITION.
    const initialViewMode = (state.viewer && state.viewer.camera && state.viewer.camera.viewMode) || '3d'
    applyViewMode(initialViewMode, el)
    prevViewMode = initialViewMode
    updateView = true

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
        const shiftLeftPan = data.type === 'mouse' && ev.shiftKey === true && (ev.buttons & 1) !== 0
        if (drawMode && drawMode !== 'none') {
          if (middlePan || touchPan || shiftLeftPan) {
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
      const drawing = st.viewer.drawing || { snapEnabled: true }
      const gridCfg = st.viewer.grid || {}
      const minorStep =
        (typeof gridCfg.minorStep === 'number' && isFinite(gridCfg.minorStep) && gridCfg.minorStep > 0)
          ? gridCfg.minorStep
          : 1
      return resolvePlacement(raw, structureReducers.ensure(st).nodes || [], {
        snapEnabled: drawing.snapEnabled !== false,
        gridMinorStep: minorStep,
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
        const struct = structureReducers.ensure(st)
        const anchorNode = struct.nodes.find((n) => n.id === elementChainAnchorId)
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

    const exitDrawingMode = () => {
      const mode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
      if (!mode || mode === 'none') return
      elementChainAnchorId = null
      drawOverlayPreview = null
      const det = document.querySelector('details.toolbar-drawing-wrap')
      if (det) det.open = false
      const navBtn = document.querySelector('.drawing-mode-btn[data-drawing-mode="none"]')
      if (navBtn) navBtn.click()
      updateView = true
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
      if (e.shiftKey) return
      const cb = structureInteractionCallback
      if (!cb) return
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
          const nid = structureReducers.ensure(st).nextNodeId || 1
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
        endId = structureReducers.ensure(st).nextNodeId || 1
        cb({ op: 'addNodeAt', payload: { x: pl.x, y: pl.y, z: 0 } })
      }
      if (endId === elementChainAnchorId) return
      cb({ op: 'addElement', payload: { iNode: elementChainAnchorId, jNode: endId } })
      elementChainAnchorId = endId
      setTimeout(() => {
        updatePreviewFromPointer(e.clientX, e.clientY)
        updateView = true
      }, 0)
    }, { passive: false })

    el.addEventListener('contextmenu', (e) => {
      const mode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
      if (!mode || mode === 'none') return
      e.preventDefault()
      exitDrawingMode()
    })

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      const mode = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing && latestAppState.viewer.drawing.mode
      if (mode && mode !== 'none') {
        e.preventDefault()
        exitDrawingMode()
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
        const zoomFitEntities = [...prevEntities, ...prevStructureEntities]
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
        const draw = latestAppState && latestAppState.viewer && latestAppState.viewer.drawing
        syncTrussOverlay(svg, latestStructureState, camera, el, drawOverlayPreview, {
          showNodeIds: !!(draw && draw.showNodeIds),
          showElementIds: !!(draw && draw.showElementIds),
          showSecId: !!(draw && draw.showSecId),
          showMatId: !!(draw && draw.showMatId),
          showRestraints: !draw || draw.showRestraints !== false,
          showReleased: !draw || draw.showReleased !== false
        })
      }
      if (stack) {
        const cursorDrawing = drawMode && drawMode !== 'none' ? 'default' : ''
        el.style.cursor = cursorDrawing
        stack.style.cursor = cursorDrawing
        if (svg) svg.style.cursor = cursorDrawing
      }

      window.requestAnimationFrame(updateAndRender)
    }
    window.requestAnimationFrame(updateAndRender)
  } else {
    // only generate entities when the solids change
    // themes, options, etc also change the viewer state
    const designSolids = state.design.solids.filter((solid) => solid && (solid instanceof Object))
    // Structures mode: hide design geometry; show grid/axes + structure overlay / members
    const solids = state.activeTool === 'structures' ? [] : designSolids
    if (prevSolids) {
      const theme = state.themes.themeSettings.viewer
      const color = theme.rendering.meshColor
      const sameColor = rgbaArraysEqual(prevColor, color)
      const sameSolids = compareSolids(solids, prevSolids)
      if (!(sameSolids && sameColor)) {
        prevEntities = entitiesFromSolids({ color }, solids)
        prevColor = color

        if (shouldZoomToFitForSolids(state.viewer.rendering.autoZoom, solids)) {
          const bboxKey = getSolidsBBoxKey(solids)
          if (bboxKey && bboxKey !== lastAutoZoomBBoxKey) {
            lastAutoZoomBBoxKey = bboxKey
            zoomToFit = true
          }
        }
      }
    }
    prevSolids = solids

    let meshColor
    const trStruct = structureReducers.ensure(state)
    // Show member solids whenever the user enables it — not only while the Structures tool is active.
    const structure3d = !!trStruct.show3dMembers

    if (state.themes && state.themes.themeSettings) {
      const v = state.themes.themeSettings.viewer
      meshColor = v && v.rendering && v.rendering.meshColor
    }
    if (!Array.isArray(meshColor) || meshColor.length < 3) {
      meshColor = [0.61, 0.61, 0.61, 1]
    }

    let structureKey = ''
    if (structure3d) {
      structureKey = JSON.stringify({
        show3d: !!trStruct.show3dMembers,
        n: trStruct.nodes,
        e: trStruct.elements,
        m: trStruct.materials,
        s: trStruct.sections
      })
    }

    if (structure3d) {
      const meshColorKey = JSON.stringify(meshColor)
      if (structureKey !== prevStructureKey || meshColorKey !== prevStructureMeshColorKey) {
        const memberSolids = structureMembersToSolids(trStruct)
        prevStructureEntities = entitiesFromSolids({ color: meshColor }, memberSolids)
        prevStructureKey = structureKey
        prevStructureMeshColorKey = meshColorKey
        updateView = true
      }
    } else if (prevStructureEntities.length > 0 || prevStructureKey !== '') {
      prevStructureEntities = []
      prevStructureKey = ''
      prevStructureMeshColorKey = ''
      updateView = true
    }

    if (state.themes && state.themes.themeSettings) {
      const theme = state.themes.themeSettings.viewer
      grid.visuals.color = theme.grid.color
      grid.visuals.subColor = theme.grid.subColor

      if (viewerOptions.rendering) {
        const trKey = JSON.stringify({
          bg: theme.rendering.background,
          mc: theme.rendering.meshColor
        })
        if (trKey !== lastAppliedThemeRenderingKey) {
          lastAppliedThemeRenderingKey = trKey
          viewerOptions.rendering.background = theme.rendering.background
          viewerOptions.rendering.meshColor = theme.rendering.meshColor
          updateView = true
        }
      }
    }

    syncGridEntityFromState(state)

    viewerOptions.entities = [
      state.viewer.grid.show ? grid : undefined,
      state.viewer.axes.show ? axes : undefined,
      ...prevEntities,
      ...prevStructureEntities
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
  camera.position = [...INITIAL_3D_CAMERA_POSITION]

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
  if (current === previous) return true
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
