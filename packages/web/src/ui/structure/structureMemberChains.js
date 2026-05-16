/**
 * Merge collinear structural members into polylines (world space) so SVG overlay
 * draws one continuous screen line through shared nodes.
 */

const edgeKey = (a, b) => {
  const x = Number(a)
  const y = Number(b)
  return x < y ? `${x}|${y}` : `${y}|${x}`
}

const elementEnds = (el) => [
  Number(el.iNode != null ? el.iNode : el.startId),
  Number(el.jNode != null ? el.jNode : el.endId)
]

const worldPos = (nodeById, id) => {
  const n = nodeById.get(Number(id))
  return n ? [n.x, n.y, n.z] : null
}

const isCollinearMiddle = (nodeById, idPrev, idMid, idNext) => {
  const p = worldPos(nodeById, idPrev)
  const m = worldPos(nodeById, idMid)
  const n = worldPos(nodeById, idNext)
  if (!p || !m || !n) return false
  const ax = p[0] - m[0]
  const ay = p[1] - m[1]
  const az = p[2] - m[2]
  const bx = n[0] - m[0]
  const by = n[1] - m[1]
  const bz = n[2] - m[2]
  const la2 = ax * ax + ay * ay + az * az
  const lb2 = bx * bx + by * by + bz * bz
  if (la2 < 1e-18 || lb2 < 1e-18) return true
  const dot = (ax * bx + ay * by + az * bz) / Math.sqrt(la2 * lb2)
  return dot < -0.995
}

const extendFromEnd = (nodeById, adj, usedEdges, elIds, start, prev) => {
  const seq = []
  let cur = start
  let prv = prev
  while (true) {
    const nbs = (adj.get(cur) || []).filter(
      (e) => e.to !== prv && !usedEdges.has(edgeKey(cur, e.to))
    )
    if (nbs.length !== 1) break
    const { to: nxt, elId } = nbs[0]
    if (!isCollinearMiddle(nodeById, prv, cur, nxt)) break
    usedEdges.add(edgeKey(cur, nxt))
    if (elId != null) elIds.add(Number(elId))
    seq.push(nxt)
    prv = cur
    cur = nxt
  }
  return seq
}

/**
 * @param {Map<number, {id,x,y,z}>} nodeById
 * @param {Array} elements
 * @returns {Array<{ nodeIds: number[], elementIds: number[] }>}
 */
const buildMemberChains = (nodeById, elements) => {
  const adj = new Map()
  const addAdj = (from, to, elId) => {
    const f = Number(from)
    const t = Number(to)
    if (!isFinite(f) || !isFinite(t) || f === t) return
    if (!adj.has(f)) adj.set(f, [])
    adj.get(f).push({ to: t, elId })
  }

  for (const el of elements || []) {
    const [i, j] = elementEnds(el)
    addAdj(i, j, el.id)
    addAdj(j, i, el.id)
  }

  const usedEdges = new Set()
  const chains = []

  for (const el of elements || []) {
    const [i, j] = elementEnds(el)
    if (!isFinite(i) || !isFinite(j) || i === j) continue
    if (usedEdges.has(edgeKey(i, j))) continue

    usedEdges.add(edgeKey(i, j))
    const elIds = new Set([Number(el.id)])

    const head = extendFromEnd(nodeById, adj, usedEdges, elIds, i, j)
    const tail = extendFromEnd(nodeById, adj, usedEdges, elIds, j, i)
    const nodeIds = [...head.reverse(), i, j, ...tail]
    chains.push({
      nodeIds,
      elementIds: [...elIds]
    })
  }

  return chains
}

const nodeByIdFromNodes = (nodes) => {
  const map = new Map()
  ;(nodes || []).forEach((n) => {
    map.set(Number(n.id), n)
  })
  return map
}

module.exports = {
  buildMemberChains,
  nodeByIdFromNodes,
  isCollinearMiddle,
  edgeKey
}
