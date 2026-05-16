/**
 * Build 3D solids for structural members from global structure model.
 * Members span exactly from i-node to j-node; section orientation is stable
 * along a line so collinear elements with opposite i/j still align at joints.
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

/** Flip direction so the dominant component is positive (same line, either i→j). */
const canonicalLineAxis = (d) => {
  const out = vec3.clone(d)
  const ax = Math.abs(out[0])
  const ay = Math.abs(out[1])
  const az = Math.abs(out[2])
  if (ax >= ay && ax >= az) {
    if (out[0] < 0) vec3.negate(out, out)
  } else if (ay >= ax && ay >= az) {
    if (out[1] < 0) vec3.negate(out, out)
  } else if (out[2] < 0) {
    vec3.negate(out, out)
  }
  return vec3.normalize(vec3.create(), out)
}

/**
 * Local +Z = placementDir (pa→pb). Up/side use canonical line axis so joints
 * between collinear elements do not twist 180° when i/j is reversed.
 */
const memberRotationPaToPb = (placementDir) => {
  const z = placementDir
  const lineAxis = canonicalLineAxis(z)
  const ez = [0, 0, 1]
  let ref = ez
  if (Math.abs(vec3.dot(lineAxis, ez)) > 0.99) ref = [1, 0, 0]
  let up = vec3.subtract(vec3.create(), ref, vec3.scale(vec3.create(), lineAxis, vec3.dot(ref, lineAxis)))
  if (vec3.squaredLength(up) < 1e-10) {
    ref = [0, 1, 0]
    vec3.subtract(up, ref, vec3.scale(vec3.create(), lineAxis, vec3.dot(ref, lineAxis)))
  }
  vec3.normalize(up, up)
  if (up[2] < 0) vec3.negate(up, up)

  let side = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z, up))
  const ey = [0, 1, 0]
  if (vec3.dot(side, ey) < 0) vec3.negate(side, side)

  return mat4.fromValues(
    up[0], up[1], up[2], 0,
    side[0], side[1], side[2], 0,
    z[0], z[1], z[2], 0,
    0, 0, 0, 1
  )
}

/** Transform: local z ∈ [0, L] maps to world segment pa → pb. */
const memberTransformPaToPb = (pa, pb) => {
  const placementDir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), pb, pa))
  const R = memberRotationPaToPb(placementDir)
  const T = mat4.fromTranslation(mat4.create(), pa)
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

    const M = memberTransformPaToPb(pa, pb)
    const zCenter = L / 2

    if (profile === 'circle') {
      const cyl = cylinder({ height: L, radius: r, segments: 28, center: [0, 0, zCenter] })
      solids.push(transform(M, cyl))
    } else if (profile === 'i') {
      const beamProfile = iBeamProfile2d(H, b, tf, tw)
      if (!beamProfile) continue
      const bar = extrudeLinear({ height: L }, beamProfile)
      solids.push(transform(M, bar))
    } else {
      const box = cuboid({ size: [b, H, L], center: [0, 0, zCenter] })
      solids.push(transform(M, box))
    }
  }
  return solids
}

module.exports = structureMembersToSolids
module.exports.canonicalLineAxis = canonicalLineAxis
module.exports.memberRotationPaToPb = memberRotationPaToPb
