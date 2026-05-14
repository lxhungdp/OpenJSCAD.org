/**
 * Build 3D solids for truss members (world-space, theme-colored via entitiesFromSolids).
 */
const { primitives, transforms, maths } = require('@jscad/modeling')
const { cuboid, cylinder } = primitives
const { transform } = transforms
const { mat4, vec3 } = maths

const EPS = 1e-6

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
  const r = Math.max(EPS, Number(truss.sectionRadius) || 1)

  const solids = []
  for (const el of truss.elements || []) {
    const pa = byId[el.startId]
    const pb = byId[el.endId]
    if (!pa || !pb) continue

    const L = vec3.distance(pa, pb)
    if (L < EPS) continue

    const mid = vec3.scale(vec3.create(), vec3.add(vec3.create(), pa, pb), 0.5)
    const dir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), pb, pa))

    const R = mat4.fromVectorRotation(mat4.create(), [0, 0, 1], dir)
    const T = mat4.fromTranslation(mat4.create(), mid)
    const TR = mat4.multiply(mat4.create(), T, R)

    if (type === 'circle') {
      const cyl = cylinder({ height: L, radius: r, segments: 28 })
      solids.push(transform(TR, cyl))
    } else {
      const bw = type === 'square' ? b : b
      const hh = type === 'square' ? b : h
      const box = cuboid({ size: [bw, hh, L], center: [0, 0, 0] })
      solids.push(transform(TR, box))
    }
  }
  return solids
}

module.exports = trussMembersToSolids
