const SVG_NS = 'http://www.w3.org/2000/svg'

const FORCE_ARROW_LEN_PX = 22
const MOMENT_ARC_RADIUS_PX = 11
const MOMENT_ARC_SWEEP = Math.PI * 1.35
const DISTRIB_STRIP_PX = 8
const ARROW_HEAD_PX = 6
const ARC_SEGMENTS = 28

const DEFAULT_STYLE = {
  stroke: 'rgba(198, 40, 40, 0.94)',
  fill: 'rgba(198, 40, 40, 0.38)',
  strokeWidth: '1.75'
}

const AXIS = {
  Fx: [1, 0, 0],
  Fy: [0, 1, 0],
  Fz: [0, 0, 1]
}

const MOMENT_PLANE = {
  Mx: 'yz',
  My: 'xz',
  Mz: 'xy'
}

const applyStrokeStyle = (el, style) => {
  const st = Object.assign({}, DEFAULT_STYLE, style)
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', st.stroke)
  el.setAttribute('stroke-width', st.strokeWidth)
  el.setAttribute('stroke-linecap', 'round')
  el.setAttribute('stroke-linejoin', 'round')
  el.setAttribute('vector-effect', 'non-scaling-stroke')
  el.setAttribute('shape-rendering', 'geometricPrecision')
  el.setAttribute('pointer-events', 'none')
}

const applyFillStyle = (el, style) => {
  const st = Object.assign({}, DEFAULT_STYLE, style)
  el.setAttribute('fill', st.fill)
  el.setAttribute('stroke', st.stroke)
  el.setAttribute('stroke-width', st.strokeWidth)
  el.setAttribute('vector-effect', 'non-scaling-stroke')
  el.setAttribute('shape-rendering', 'geometricPrecision')
  el.setAttribute('pointer-events', 'none')
}

const screenDist = (projectWorld, x0, y0, z0, x1, y1, z1, viewProj, cssW, cssH) => {
  const p0 = projectWorld(x0, y0, z0, viewProj, cssW, cssH)
  const p1 = projectWorld(x1, y1, z1, viewProj, cssW, cssH)
  if (!p0 || !p1) return null
  return Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
}

/** World distance so chord from origin along unit axis projects to targetPx on screen. */
const worldLenForScreenPx = (projectWorld, ox, oy, oz, ux, uy, uz, targetPx, viewProj, cssW, cssH) => {
  if (targetPx <= 0) return 0
  let lo = 1e-6
  let hi = 1
  for (let i = 0; i < 22; i++) {
    const d = screenDist(projectWorld, ox, oy, oz, ox + ux * hi, oy + uy * hi, oz + uz * hi, viewProj, cssW, cssH)
    if (d == null) break
    if (d < targetPx) hi *= 1.6
    else break
  }
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) * 0.5
    const d = screenDist(projectWorld, ox, oy, oz, ox + ux * mid, oy + uy * mid, oz + uz * mid, viewProj, cssW, cssH)
    if (d == null) return mid
    if (d < targetPx) lo = mid
    else hi = mid
  }
  return (lo + hi) * 0.5
}

const drawScreenArrow = (parent, x0, y0, x1, y1, style) => {
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('x1', String(x0))
  line.setAttribute('y1', String(y0))
  line.setAttribute('x2', String(x1))
  line.setAttribute('y2', String(y1))
  applyStrokeStyle(line, style)
  parent.appendChild(line)

  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len < 1e-4) return
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const ah = ARROW_HEAD_PX
  const tip = document.createElementNS(SVG_NS, 'polygon')
  tip.setAttribute('points', [
    `${x1},${y1}`,
    `${x1 - ux * ah + px * (ah * 0.45)},${y1 - uy * ah + py * (ah * 0.45)}`,
    `${x1 - ux * ah - px * (ah * 0.45)},${y1 - uy * ah - py * (ah * 0.45)}`
  ].join(' '))
  const st = Object.assign({}, DEFAULT_STYLE, style)
  tip.setAttribute('fill', st.stroke)
  tip.setAttribute('stroke', 'none')
  tip.setAttribute('pointer-events', 'none')
  parent.appendChild(tip)
}

/**
 * @param {'Fx'|'Fy'|'Fz'} kind
 * @param {number} value signed magnitude
 */
const drawForceGlyph = (parent, kind, value, node, projectWorld, viewProj, cssW, cssH, style) => {
  if (!value || !isFinite(value)) return
  const base = AXIS[kind]
  if (!base) return
  const sign = value > 0 ? 1 : -1
  const ux = base[0] * sign
  const uy = base[1] * sign
  const uz = base[2] * sign
  const wlen = worldLenForScreenPx(
    projectWorld, node.x, node.y, node.z, ux, uy, uz,
    FORCE_ARROW_LEN_PX, viewProj, cssW, cssH
  )
  const p0 = projectWorld(node.x, node.y, node.z, viewProj, cssW, cssH)
  const p1 = projectWorld(node.x + ux * wlen, node.y + uy * wlen, node.z + uz * wlen, viewProj, cssW, cssH)
  if (!p0 || !p1) return
  drawScreenArrow(parent, p0[0], p0[1], p1[0], p1[1], style)
}

const arcPoint = (plane, cx, cy, cz, r, angle) => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (plane === 'yz') return [cx, cy + r * c, cz + r * s]
  if (plane === 'xz') return [cx + r * c, cy, cz + r * s]
  return [cx + r * c, cy + r * s, cz]
}

/**
 * Right-hand rule: positive moment about +X rotates +Y → +Z (start angle 0 on +Y).
 */
const momentArcStartAngle = (plane, sign) => {
  if (plane === 'yz') return sign > 0 ? 0 : Math.PI
  if (plane === 'xz') return sign > 0 ? 0 : Math.PI
  return sign > 0 ? Math.PI * 0.5 : Math.PI * 1.5
}

const drawMomentGlyph = (parent, kind, value, node, projectWorld, viewProj, cssW, cssH, style) => {
  if (!value || !isFinite(value)) return
  const plane = MOMENT_PLANE[kind]
  if (!plane) return
  const sign = value > 0 ? 1 : -1
  const sweep = MOMENT_ARC_SWEEP * sign
  const start = momentArcStartAngle(plane, sign)

  const rWorld = worldLenForScreenPx(
    projectWorld, node.x, node.y, node.z,
    ...(() => {
      const p = arcPoint(plane, node.x, node.y, node.z, 1, start)
      return [p[0] - node.x, p[1] - node.y, p[2] - node.z]
    })(),
    MOMENT_ARC_RADIUS_PX, viewProj, cssW, cssH
  )

  const pts = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS
    const ang = start + sweep * t
    const w = arcPoint(plane, node.x, node.y, node.z, rWorld, ang)
    const p = projectWorld(w[0], w[1], w[2], viewProj, cssW, cssH)
    if (!p) return
    pts.push(p)
  }
  if (pts.length < 2) return

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' '))
  applyStrokeStyle(path, style)
  parent.appendChild(path)

  const n = pts.length
  const pA = pts[n - 2]
  const pB = pts[n - 1]
  drawScreenArrow(parent, pA[0], pA[1], pB[0], pB[1], style)
}

const normalizeVec3 = (v) => {
  const len = Math.hypot(v[0], v[1], v[2])
  if (len < 1e-9) return null
  return [v[0] / len, v[1] / len, v[2] / len]
}

const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]

/**
 * Filled strip along member, offset to one side (sign of q).
 * @param {'qx'|'qy'|'qz'} component
 */
const drawDistributedStrip = (parent, component, q, a, b, projectWorld, viewProj, cssW, cssH, style) => {
  if (!q || !isFinite(q)) return
  const sign = q > 0 ? 1 : -1
  const loadAxis = component === 'qx' ? [1, 0, 0] : component === 'qy' ? [0, 1, 0] : [0, 0, 1]
  const ex = normalizeVec3([b.x - a.x, b.y - a.y, b.z - a.z])
  if (!ex) return
  let side = cross3(ex, loadAxis)
  side = normalizeVec3(side)
  if (!side) return

  const stripWorld = worldLenForScreenPx(
    projectWorld, a.x, a.y, a.z, side[0], side[1], side[2],
    DISTRIB_STRIP_PX, viewProj, cssW, cssH
  )
  const ox = side[0] * stripWorld * sign
  const oy = side[1] * stripWorld * sign
  const oz = side[2] * stripWorld * sign

  const pa = projectWorld(a.x, a.y, a.z, viewProj, cssW, cssH)
  const pb = projectWorld(b.x, b.y, b.z, viewProj, cssW, cssH)
  const pao = projectWorld(a.x + ox, a.y + oy, a.z + oz, viewProj, cssW, cssH)
  const pbo = projectWorld(b.x + ox, b.y + oy, b.z + oz, viewProj, cssW, cssH)
  if (!pa || !pb || !pao || !pbo) return

  const poly = document.createElementNS(SVG_NS, 'polygon')
  poly.setAttribute('points', [
    `${pa[0]},${pa[1]}`,
    `${pb[0]},${pb[1]}`,
    `${pbo[0]},${pbo[1]}`,
    `${pao[0]},${pao[1]}`
  ].join(' '))
  applyFillStyle(poly, style)
  parent.appendChild(poly)
}

const drawNodalLoadsForNode = (parent, node, loadRow, projectWorld, viewProj, cssW, cssH, style) => {
  if (!node || !loadRow) return
  const fields = [
    ['Fx', loadRow.Fx],
    ['Fy', loadRow.Fy],
    ['Fz', loadRow.Fz],
    ['Mx', loadRow.Mx],
    ['My', loadRow.My],
    ['Mz', loadRow.Mz]
  ]
  fields.forEach(([kind, val]) => {
    const v = Number(val)
    if (!v || !isFinite(v)) return
    if (kind[0] === 'F') drawForceGlyph(parent, kind, v, node, projectWorld, viewProj, cssW, cssH, style)
    else drawMomentGlyph(parent, kind, v, node, projectWorld, viewProj, cssW, cssH, style)
  })
}

const nodeAt = (nodeById, ref) =>
  (nodeById instanceof Map ? nodeById.get(Number(ref)) : nodeById[ref])

const drawDistributedLoadsForElement = (parent, el, nodeById, loadRow, projectWorld, viewProj, cssW, cssH, style) => {
  const iRef = el.iNode != null ? el.iNode : el.startId
  const jRef = el.jNode != null ? el.jNode : el.endId
  const a = nodeAt(nodeById, iRef)
  const b = nodeAt(nodeById, jRef)
  if (!a || !b || !loadRow) return
  const comps = [
    ['qx', loadRow.qx],
    ['qy', loadRow.qy],
    ['qz', loadRow.qz]
  ]
  comps.forEach(([c, val]) => {
    const v = Number(val)
    if (!v || !isFinite(v)) return
    drawDistributedStrip(parent, c, v, a, b, projectWorld, viewProj, cssW, cssH, style)
  })
}

module.exports = {
  drawForceGlyph,
  drawMomentGlyph,
  drawDistributedStrip,
  drawNodalLoadsForNode,
  drawDistributedLoadsForElement,
  worldLenForScreenPx,
  momentArcStartAngle,
  DEFAULT_STYLE,
  FORCE_ARROW_LEN_PX,
  MOMENT_ARC_RADIUS_PX,
  DISTRIB_STRIP_PX
}
