const mat4 = require('gl-mat4')

/**
 * Project world point to CSS pixel coordinates relative to the canvas element.
 * @returns {number[]|null} [px, py, ndcz] or null if behind camera / invalid
 */
function projectWorld (x, y, z, viewProj, cssW, cssH) {
  const ax = viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12]
  const ay = viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13]
  const az = viewProj[2] * x + viewProj[6] * y + viewProj[10] * z + viewProj[14]
  const aw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15]
  if (aw === 0 || !isFinite(aw)) return null
  const ndcx = ax / aw
  const ndcy = ay / aw
  const ndcz = az / aw
  if (ndcz < -1 || ndcz > 1) return null
  if (ndcx < -1.05 || ndcx > 1.05 || ndcy < -1.05 || ndcy > 1.05) return null
  const px = (ndcx * 0.5 + 0.5) * cssW
  const py = (1 - (ndcy * 0.5 + 0.5)) * cssH
  return [px, py, ndcz]
}

/**
 * @typedef {Object} TrussOverlayPreview
 * @property {{x:number,y:number,z:number}} [from] rubber-band start (world)
 * @property {{x:number,y:number,z:number}} [to] cursor / preview end (world)
 * @property {'free'|'grid'|'node'} [toKind] snap state for preview dot
 * @property {number} [highlightNodeId] node to emphasize when snapping
 */

/**
 * Redraw truss overlay (screen-space node dots and line members).
 * @param {SVGElement} svgEl
 * @param {Object} truss - { nodes: [{id,x,y,z}], elements: [{id,startId,endId}] }
 * @param {Object} camera - regl perspective camera with view, projection
 * @param {HTMLCanvasElement} canvasEl
 * @param {TrussOverlayPreview|null} [preview]
 */
function syncTrussOverlay (svgEl, truss, camera, canvasEl, preview) {
  if (!svgEl || !truss || !camera || !camera.view || !camera.projection || !canvasEl) return

  if (truss.show3dMembers) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild)
    return
  }

  const rect = canvasEl.getBoundingClientRect()
  const cssW = rect.width
  const cssH = rect.height
  if (cssW <= 0 || cssH <= 0) return

  svgEl.setAttribute('width', String(cssW))
  svgEl.setAttribute('height', String(cssH))
  svgEl.setAttribute('viewBox', `0 0 ${cssW} ${cssH}`)

  const viewProj = mat4.create()
  mat4.multiply(viewProj, camera.projection, camera.view)

  const nodeById = {}
  truss.nodes.forEach((n) => { nodeById[n.id] = n })

  while (svgEl.firstChild) {
    svgEl.removeChild(svgEl.firstChild)
  }

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('class', 'truss-overlay-layer')
  svgEl.appendChild(g)

  const stroke = 'rgba(0,0,0,0.85)'
  const fill = 'rgba(220,50,47,0.95)'

  truss.elements.forEach((el) => {
    const a = nodeById[el.startId]
    const b = nodeById[el.endId]
    if (!a || !b) return
    const pa = projectWorld(a.x, a.y, a.z, viewProj, cssW, cssH)
    const pb = projectWorld(b.x, b.y, b.z, viewProj, cssW, cssH)
    if (!pa || !pb) return
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(pa[0]))
    line.setAttribute('y1', String(pa[1]))
    line.setAttribute('x2', String(pb[0]))
    line.setAttribute('y2', String(pb[1]))
    line.setAttribute('stroke', stroke)
    line.setAttribute('stroke-width', '1')
    line.setAttribute('vector-effect', 'non-scaling-stroke')
    line.setAttribute('shape-rendering', 'crispEdges')
    g.appendChild(line)
  })

  truss.nodes.forEach((n) => {
    const p = projectWorld(n.x, n.y, n.z, viewProj, cssW, cssH)
    if (!p) return
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    c.setAttribute('cx', String(p[0]))
    c.setAttribute('cy', String(p[1]))
    c.setAttribute('r', '4')
    c.setAttribute('fill', fill)
    c.setAttribute('stroke', 'rgba(255,255,255,0.9)')
    c.setAttribute('stroke-width', '1')
    c.setAttribute('vector-effect', 'non-scaling-stroke')
    if (preview && preview.highlightNodeId === n.id) {
      c.setAttribute('r', '7')
      c.setAttribute('stroke', 'rgba(255, 193, 7, 0.95)')
      c.setAttribute('stroke-width', '2')
    }
    g.appendChild(c)
  })

  if (preview && preview.from && preview.to) {
    const pa = projectWorld(preview.from.x, preview.from.y, preview.from.z, viewProj, cssW, cssH)
    const pb = projectWorld(preview.to.x, preview.to.y, preview.to.z, viewProj, cssW, cssH)
    if (pa && pb) {
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      guide.setAttribute('x1', String(pa[0]))
      guide.setAttribute('y1', String(pa[1]))
      guide.setAttribute('x2', String(pb[0]))
      guide.setAttribute('y2', String(pb[1]))
      guide.setAttribute('stroke', 'rgba(0, 120, 200, 0.55)')
      guide.setAttribute('stroke-width', '2')
      guide.setAttribute('stroke-dasharray', '6 4')
      guide.setAttribute('vector-effect', 'non-scaling-stroke')
      g.appendChild(guide)
    }
  }

  if (preview && preview.to) {
    const pb2 = projectWorld(preview.to.x, preview.to.y, preview.to.z, viewProj, cssW, cssH)
    if (pb2) {
      const previewFill = preview.toKind === 'node'
        ? 'rgba(33, 150, 243, 0.95)'
        : preview.toKind === 'grid'
          ? 'rgba(255, 152, 0, 0.95)'
          : 'rgba(120, 120, 120, 0.9)'
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', String(pb2[0]))
      dot.setAttribute('cy', String(pb2[1]))
      dot.setAttribute('r', '5')
      dot.setAttribute('fill', previewFill)
      dot.setAttribute('stroke', 'rgba(255,255,255,0.85)')
      dot.setAttribute('stroke-width', '1')
      dot.setAttribute('vector-effect', 'non-scaling-stroke')
      g.appendChild(dot)
    }
  }
}

syncTrussOverlay.projectWorld = projectWorld
module.exports = syncTrussOverlay
