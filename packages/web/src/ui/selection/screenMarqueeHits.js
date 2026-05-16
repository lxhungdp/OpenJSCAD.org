/**
 * Liang–Barsky: segment (x0,y0)-(x1,y1) vs axis-aligned rect [xmin,xmax]×[ymin,ymax] (inclusive).
 * @returns {boolean}
 */
const segmentIntersectsRect = (x0, y0, x1, y1, xmin, ymin, xmax, ymax) => {
  let u1 = 0
  let u2 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const p = [-dx, dx, -dy, dy]
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0]
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) return false
      continue
    }
    const r = q[k] / p[k]
    if (p[k] < 0) {
      if (r > u2) return false
      if (r > u1) u1 = r
    } else {
      if (r < u1) return false
      if (r < u2) u2 = r
    }
  }
  return u1 <= u2
}

const pointInRect = (px, py, left, top, right, bottom) =>
  px >= left && px <= right && py >= top && py <= bottom

/**
 * @param {object} opts
 * @param {{ nodes: object[], elements: object[] }} opts.structure
 * @param {Float32Array|number[]} opts.viewProj
 * @param {number} opts.cssW
 * @param {number} opts.cssH
 * @param {function} opts.projectWorld (x,y,z, viewProj, w, h) -> [px,py] | null
 * @param {number} opts.x0 screen px (canvas-relative)
 * @param {number} opts.y0
 * @param {number} opts.x1
 * @param {number} opts.y1
 * @param {'window'|'crossing'} opts.mode window = fully inside; crossing = intersects or inside
 */
const pickByMarquee = (opts) => {
  const {
    structure,
    viewProj,
    cssW,
    cssH,
    projectWorld,
    x0,
    y0,
    x1,
    y1,
    mode
  } = opts
  const left = Math.min(x0, x1)
  const right = Math.max(x0, x1)
  const top = Math.min(y0, y1)
  const bottom = Math.max(y0, y1)
  const nodes = structure.nodes || []
  const elements = structure.elements || []
  const nodeById = {}
  nodes.forEach((n) => { nodeById[n.id] = n })

  const selectedNodeIds = []
  const selectedElementIds = []

  for (const n of nodes) {
    const p = projectWorld(n.x, n.y, n.z, viewProj, cssW, cssH)
    if (!p) continue
    const px = p[0]
    const py = p[1]
    if (mode === 'window') {
      if (pointInRect(px, py, left, top, right, bottom)) selectedNodeIds.push(Number(n.id))
    } else {
      if (pointInRect(px, py, left, top, right, bottom)) selectedNodeIds.push(Number(n.id))
    }
  }

  for (const el of elements) {
    const iRef = el.iNode != null ? el.iNode : el.startId
    const jRef = el.jNode != null ? el.jNode : el.endId
    const a = nodeById[iRef]
    const b = nodeById[jRef]
    if (!a || !b) continue
    const pa = projectWorld(a.x, a.y, a.z, viewProj, cssW, cssH)
    const pb = projectWorld(b.x, b.y, b.z, viewProj, cssW, cssH)
    if (!pa || !pb) continue
    const xA = pa[0]
    const yA = pa[1]
    const xB = pb[0]
    const yB = pb[1]
    if (mode === 'window') {
      if (
        pointInRect(xA, yA, left, top, right, bottom) &&
        pointInRect(xB, yB, left, top, right, bottom)
      ) {
        selectedElementIds.push(Number(el.id))
      }
    } else {
      const insideA = pointInRect(xA, yA, left, top, right, bottom)
      const insideB = pointInRect(xB, yB, left, top, right, bottom)
      if (insideA || insideB || segmentIntersectsRect(xA, yA, xB, yB, left, top, right, bottom)) {
        selectedElementIds.push(Number(el.id))
      }
    }
  }

  return { selectedNodeIds, selectedElementIds }
}

module.exports = { pickByMarquee, segmentIntersectsRect, pointInRect }
