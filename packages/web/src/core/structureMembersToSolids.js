/**
 * Build 3D solids for structural members from global structure model.
 */
const { primitives, transforms, maths, extrusions } = require('@jscad/modeling')
const { cuboid, cylinder } = primitives
const { transform } = transforms
const { extrudeLinear } = extrusions
const { mat4, vec3 } = maths
const iBeamProfile2d = require('./iBeamProfile2d')
const { sectionTypeToProfile } = require('./structure/sectionToFemProps')
const { elementINode, elementJNode, nodeByIdMap, sectionById, defaultMatSecIds } = require('./structure/structureView')

const EPS = 1e-6

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

const memberTransform = (pa, pb, L, anchor) => {
  const dir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), pb, pa))
  const R = rotationBeamSectionWorldZStable(dir)
  const mid = vec3.scale(vec3.create(), vec3.add(vec3.create(), pa, pb), 0.5)
  const origin = anchor === 'start' ? pa : mid
  const T = mat4.fromTranslation(mat4.create(), origin)
  return mat4.multiply(mat4.create(), T, R)
}

const nodePos = (byId, ref) => {
  if (ref == null) return null
  const n = byId[ref]
  if (!n) return null
  return [n.x, n.y, n.z]
}

const structureMembersToSolids = (structure) => {
  if (!structure || !structure.show3dMembers) return []

  const byId = nodeByIdMap(structure)
  const defs = defaultMatSecIds(structure)
  const solids = []

  for (const el of structure.elements || []) {
    const pa = nodePos(byId, elementINode(el))
    const pb = nodePos(byId, elementJNode(el))
    if (!pa || !pb) continue

    const L = vec3.distance(pa, pb)
    if (L < EPS) continue

    const sec =
      sectionById(structure, el.secId != null && el.secId !== '' ? el.secId : defs.secId) ||
      sectionById(structure, defs.secId)
    if (!sec) continue

    const profile = sectionTypeToProfile(sec.type)
    const b = Math.max(EPS, Number(sec.b) || 2)
    const H = Math.max(EPS, Number(sec.H) || 2)
    const r = Math.max(EPS, Number(sec.r) || 1)
    const tf = Math.max(EPS, Number(sec.tf) || 0.25)
    const tw = Math.max(EPS, Number(sec.tw) || 0.2)

    if (profile === 'circle') {
      const cyl = cylinder({ height: L, radius: r, segments: 28 })
      const M = memberTransform(pa, pb, L, 'center')
      solids.push(transform(M, cyl))
    } else if (profile === 'i') {
      const beamProfile = iBeamProfile2d(H, b, tf, tw)
      if (!beamProfile) continue
      const bar = extrudeLinear({ height: L }, beamProfile)
      const M = memberTransform(pa, pb, L, 'start')
      solids.push(transform(M, bar))
    } else {
      const box = cuboid({ size: [b, H, L], center: [0, 0, 0] })
      const M = memberTransform(pa, pb, L, 'center')
      solids.push(transform(M, box))
    }
  }
  return solids
}

module.exports = structureMembersToSolids
