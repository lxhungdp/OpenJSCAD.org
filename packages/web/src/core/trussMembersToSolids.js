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
 * Local axes: +X = web “tall” direction in profile, +Y = side, +Z = beam.
 * Map +Z → beam dir and +X → projection of world +Z onto plane ⊥ beam,
 * so the web stays vertical (parallel to world Z) for horizontal members.
 */
const rotationIBeamWebParallelWorldZ = (d) => {
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

const memberTransform = (pa, pb, L, useIBeamRoll) => {
  const mid = vec3.scale(vec3.create(), vec3.add(vec3.create(), pa, pb), 0.5)
  const dir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), pb, pa))
  const R = useIBeamRoll
    ? rotationIBeamWebParallelWorldZ(dir)
    : mat4.fromVectorRotation(mat4.create(), [0, 0, 1], dir)
  const T = mat4.fromTranslation(mat4.create(), mid)
  const TR = mat4.multiply(mat4.create(), T, R)
  const Tz = mat4.fromTranslation(mat4.create(), [0, 0, -L / 2])
  return mat4.multiply(mat4.create(), TR, Tz)
}

const nodeMap = (truss) => {
  const m = {}
  ;(truss.nodes || []).forEach((n) => {
    m[n.id] = [n.x, n.y, n.z]
  })
  return m
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
    const pa = byId[el.startId]
    const pb = byId[el.endId]
    if (!pa || !pb) continue

    const L = vec3.distance(pa, pb)
    if (L < EPS) continue

    const M = memberTransform(pa, pb, L, type === 'i')

    if (type === 'circle') {
      const cyl = cylinder({ height: L, radius: rCirc, segments: 28 })
      solids.push(transform(M, cyl))
    } else if (type === 'i') {
      const H = h
      const B = b
      const profile = iBeamProfile2d(H, B, tf, tw)
      if (!profile) continue
      const bar = extrudeLinear({ height: L }, profile)
      solids.push(transform(M, bar))
    } else {
      const bw = type === 'square' ? b : b
      const hh = type === 'square' ? b : h
      const box = cuboid({ size: [bw, hh, L], center: [0, 0, 0] })
      solids.push(transform(M, box))
    }
  }
  return solids
}

module.exports = trussMembersToSolids
