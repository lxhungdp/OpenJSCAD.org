/**
 * Build 3D solids for truss members (world-space, theme-colored via entitiesFromSolids).
 */
const { primitives, transforms, maths, extrusions } = require('@jscad/modeling')
const { cuboid, cylinder } = primitives
const { transform } = transforms
const { extrudeLinear } = extrusions
const { mat4, vec3 } = maths
const iBeamProfile2d = require('./iBeamProfile2d')

const EPS = 1e-6

/**
 * Section plane ⊥ beam (local Z = beam direction d).
 * Local X lies in that plane as the projection of world +Z (so roll follows Δz / slope, not an arbitrary twist).
 * If d ∥ world Z, fall back to world +X then +Y for a stable basis.
 */
const rotationBeamSectionWorldZStable = (d) => {
  const ez = [0, 0, 1]
  const up = vec3.subtract(vec3.create(), ez, vec3.scale(vec3.create(), d, vec3.dot(ez, d)))
  if (vec3.squaredLength(up) < 1e-10) {
    const ex = [1, 0, 0]
    vec3.subtract(up, ex, vec3.scale(vec3.create(), d, vec3.dot(ex, d)))
    if (vec3.squaredLength(up) < 1e-10) {
      const ey = [0, 1, 0]
      vec3.subtract(up, ey, vec3.scale(vec3.create(), d, vec3.dot(ey, d)))
    }
  }
  vec3.normalize(up, up)
  const side = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), d, up))
  return mat4.fromValues(
    up[0], up[1], up[2], 0,
    side[0], side[1], side[2], 0,
    d[0], d[1], d[2], 0,
    0, 0, 0, 1
  )
}

/**
 * Place local +Z beam (length L) from node pa to pb.
 * - Centered primitives (cuboid/cylinder): geometry spans z ∈ [-L/2, L/2]; anchor at span midpoint.
 * - extrudeLinear I-beam: geometry spans z ∈ [0, L]; anchor at start node pa.
 */
const memberTransform = (pa, pb, L, anchor) => {
  const dir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), pb, pa))
  const R = rotationBeamSectionWorldZStable(dir)
  const mid = vec3.scale(vec3.create(), vec3.add(vec3.create(), pa, pb), 0.5)
  const origin = anchor === 'start' ? pa : mid
  const T = mat4.fromTranslation(mat4.create(), origin)
  return mat4.multiply(mat4.create(), T, R)
}

const nodeMap = (truss) => {
  const m = Object.create(null)
  for (const n of truss.nodes || []) {
    m[n.id] = [n.x, n.y, n.z]
  }
  return m
}

/** Resolve element endpoint to a node position; `startId` / `endId` are node ids (not element ids). */
const nodePos = (byId, ref) => {
  if (ref == null) return null
  const p = byId[ref]
  if (p) return p
  const n = Number(ref)
  return isFinite(n) ? byId[n] || null : null
}

/**
 * @param {Object} truss - truss state including nodes, elements, section* fields
 * @returns {Array} list of geom3 (may be empty)
 */
const trussMembersToSolids = (truss) => {
  if (!truss || !truss.show3dMembers) return []

  const byId = nodeMap(truss)
  const type = truss.sectionType || 'rect'
  const b = Math.max(EPS, Number(truss.sectionB) || 2)
  const h = Math.max(EPS, Number(truss.sectionH) || 2)
  const rCirc = Math.max(EPS, Number(truss.sectionRadius) || 1)
  const tf = Math.max(EPS, Number(truss.sectionTf) != null ? Number(truss.sectionTf) : 0.2)
  const tw = Math.max(EPS, Number(truss.sectionTw) != null ? Number(truss.sectionTw) : 0.15)

  const solids = []
  for (const el of truss.elements || []) {
    const pa = nodePos(byId, el.startId)
    const pb = nodePos(byId, el.endId)
    if (!pa || !pb) continue

    const L = vec3.distance(pa, pb)
    if (L < EPS) continue

    if (type === 'circle') {
      const cyl = cylinder({ height: L, radius: rCirc, segments: 28 })
      const M = memberTransform(pa, pb, L, 'center')
      solids.push(transform(M, cyl))
    } else if (type === 'i') {
      const H = h
      const B = b
      const profile = iBeamProfile2d(H, B, tf, tw)
      if (!profile) continue
      const bar = extrudeLinear({ height: L }, profile)
      const M = memberTransform(pa, pb, L, 'start')
      solids.push(transform(M, bar))
    } else {
      const bw = type === 'square' ? b : b
      const hh = type === 'square' ? b : h
      const box = cuboid({ size: [bw, hh, L], center: [0, 0, 0] })
      const M = memberTransform(pa, pb, L, 'center')
      solids.push(transform(M, box))
    }
  }
  return solids
}

module.exports = trussMembersToSolids
