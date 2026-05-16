const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')

const multiplyMat4Vec4 = (m, x, y, z, w) => ([
  m[0] * x + m[4] * y + m[8] * z + m[12] * w,
  m[1] * x + m[5] * y + m[9] * z + m[13] * w,
  m[2] * x + m[6] * y + m[10] * z + m[14] * w,
  m[3] * x + m[7] * y + m[11] * z + m[15] * w
])

const transformPerspective = (out, inv, x, y, z, w) => {
  const v = multiplyMat4Vec4(inv, x, y, z, w)
  if (v[3] === 0 || !isFinite(v[3])) return null
  out[0] = v[0] / v[3]
  out[1] = v[1] / v[3]
  out[2] = v[2] / v[3]
  return out
}

/**
 * @param {Float32Array|number[]} invViewProj
 * @param {number} ndcx
 * @param {number} ndcy
 * @returns {{ origin: number[], dir: number[] }|null}
 */
const worldRayFromNdc = (invViewProj, ndcx, ndcy) => {
  const a = []
  const b = []
  if (!transformPerspective(a, invViewProj, ndcx, ndcy, -1, 1)) return null
  if (!transformPerspective(b, invViewProj, ndcx, ndcy, 1, 1)) return null
  const dir = vec3.subtract([], b, a)
  const len = vec3.length(dir)
  if (len < 1e-12) return null
  vec3.scale(dir, dir, 1 / len)
  return { origin: a, dir }
}

/**
 * Intersect ray with plane z = planeZ. Returns [x,y,z] or null.
 */
const intersectPlaneZ = (origin, dir, planeZ) => {
  if (Math.abs(dir[2]) < 1e-12) return null
  const t = (planeZ - origin[2]) / dir[2]
  if (t < 0 || !isFinite(t)) return null
  return [
    origin[0] + dir[0] * t,
    origin[1] + dir[1] * t,
    planeZ
  ]
}

const snapWorldToStep = (v, step) => {
  if (!step || step <= 0) return v
  return Math.round(v / step) * step
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRect} rect
 * @param {Float32Array|number[]} viewProj
 * @param {number} [planeZ=0]
 * @returns {number[]|null} [x,y,z] on plane
 */
const worldPointOnPlaneFromClient = (clientX, clientY, rect, viewProj, planeZ = 0) => {
  const px = clientX - rect.left
  const py = clientY - rect.top
  const ndcx = (px / rect.width) * 2 - 1
  const ndcy = -((py / rect.height) * 2 - 1)
  const inv = mat4.create()
  if (!mat4.invert(inv, viewProj)) return null
  const ray = worldRayFromNdc(inv, ndcx, ndcy)
  if (!ray) return null
  return intersectPlaneZ(ray.origin, ray.dir, planeZ)
}

/**
 * Nearest node if within pickRadiusPx in screen space.
 * @param {function} projectWorld (x,y,z, viewProj, w, h) -> [px,py] | null
 */
const nearestNodeByScreenPx = (nodes, clientX, clientY, rect, projectWorld, viewProj, pickRadiusPx = 14, ignoreNodeIds) => {
  const cssW = rect.width
  const cssH = rect.height
  const px = clientX - rect.left
  const py = clientY - rect.top
  let best = null
  let bestD2 = pickRadiusPx * pickRadiusPx
  const ignore =
    ignoreNodeIds == null
      ? null
      : new Set(
        (Array.isArray(ignoreNodeIds) ? ignoreNodeIds : [ignoreNodeIds]).map((id) => String(id))
      )
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    if (ignore && ignore.has(String(n.id))) continue
    const p = projectWorld(n.x, n.y, n.z, viewProj, cssW, cssH)
    if (!p) continue
    const dx = p[0] - px
    const dy = p[1] - py
    const d2 = dx * dx + dy * dy
    if (d2 <= bestD2) {
      bestD2 = d2
      best = n
    }
  }
  return best
}

/**
 * @param {object} options
 * @param {boolean} options.snapEnabled
 * @param {number} options.gridMinorStep
 * @param {function} options.projectWorld
 * @param {Float32Array|number[]} options.viewProj
 * @param {DOMRect} options.rect
 * @param {number} options.clientX
 * @param {number} options.clientY
 * @param {unknown|unknown[]} [options.ignoreNodeIds] node id(s) excluded from screen snap (e.g. chain anchor while drawing elements)
 * @returns {{ kind: 'node'|'grid'|'free', x: number, y: number, z: number, nodeId?: number }}
 */
const resolvePlacement = (raw, nodes, options) => {
  const {
    snapEnabled,
    gridMinorStep,
    projectWorld,
    viewProj,
    rect,
    clientX,
    clientY,
    ignoreNodeIds
  } = options
  const z = raw[2]
  let x = raw[0]
  let y = raw[1]

  const snappedNode = nearestNodeByScreenPx(nodes, clientX, clientY, rect, projectWorld, viewProj, 14, ignoreNodeIds)
  if (snappedNode) {
    return { kind: 'node', x: snappedNode.x, y: snappedNode.y, z: snappedNode.z, nodeId: snappedNode.id }
  }

  if (snapEnabled && gridMinorStep > 0) {
    return {
      kind: 'grid',
      x: snapWorldToStep(x, gridMinorStep),
      y: snapWorldToStep(y, gridMinorStep),
      z
    }
  }

  return { kind: 'free', x, y, z }
}

module.exports = {
  worldPointOnPlaneFromClient,
  resolvePlacement,
  snapWorldToStep,
  intersectPlaneZ,
  worldRayFromNdc
}
