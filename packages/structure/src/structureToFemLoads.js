/**
 * Nodal load map for 6-DOF frame solver (keys = 0-based mesh node index).
 * Fx,Fy,Fz,Mx,My,Mz in global coordinates.
 */
const structureToFemLoads = (structure, nodeIdToIndex) => {
  const loads = new Map()
  const nodal = (structure.loads && structure.loads.nodal) || []

  for (const l of nodal) {
    const idx = nodeIdToIndex.get(Number(l.nodeId))
    if (idx == null) continue
    loads.set(idx, [
      Number(l.Fx) || 0,
      Number(l.Fy) || 0,
      Number(l.Fz) || 0,
      Number(l.Mx) || 0,
      Number(l.My) || 0,
      Number(l.Mz) || 0
    ])
  }

  // Distributed loads (qy): lump 50% to each end node in global Y (simplified)
  const distributed = (structure.loads && structure.loads.distributed) || []
  for (const d of distributed) {
    const el = (structure.elements || []).find((e) => e.id === Number(d.elementId))
    if (!el) continue
    const iNode = Number(el.iNode != null ? el.iNode : el.startId)
    const jNode = Number(el.jNode != null ? el.jNode : el.endId)
    const iIdx = nodeIdToIndex.get(iNode)
    const jIdx = nodeIdToIndex.get(jNode)
    if (iIdx == null || jIdx == null) continue
    const n1 = structure.nodes.find((n) => n.id === iNode)
    const n2 = structure.nodes.find((n) => n.id === jNode)
    if (!n1 || !n2) continue
    const L = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z)
    if (L <= 0) continue
    const qy = Number(d.qy) || 0
    const Fy = (qy * L) / 2
    const addFy = (idx) => {
      const prev = loads.get(idx) || [0, 0, 0, 0, 0, 0]
      loads.set(idx, [prev[0], prev[1] + Fy, prev[2], prev[3], prev[4], prev[5]])
    }
    addFy(iIdx)
    addFy(jIdx)
  }

  return loads
}

module.exports = structureToFemLoads
