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
 * Redraw truss overlay (screen-space node dots and line members).
 * @param {SVGElement} svgEl
 * @param {Object} truss - { nodes: [{id,x,y,z}], elements: [{id,startId,endId}] }
 * @param {Object} camera - regl perspective camera with view, projection
 * @param {HTMLCanvasElement} canvasEl
 */
function syncTrussOverlay (svgEl, truss, camera, canvasEl) {
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
    g.appendChild(c)
  })
}

module.exports = syncTrussOverlay
