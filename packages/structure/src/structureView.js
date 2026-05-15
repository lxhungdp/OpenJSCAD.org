/**
 * Read helpers for structure model (nodes, elements, libraries).
 */

const elementINode = (el) => {
  if (el.iNode != null) return Number(el.iNode)
  if (el.startId != null) return Number(el.startId)
  return NaN
}

const elementJNode = (el) => {
  if (el.jNode != null) return Number(el.jNode)
  if (el.endId != null) return Number(el.endId)
  return NaN
}

const nodeByIdMap = (structure) => {
  const m = Object.create(null)
  for (const n of structure.nodes || []) {
    m[n.id] = n
  }
  return m
}

const materialById = (structure, matId) =>
  (structure.materials || []).find((m) => m.matId === matId)

const sectionById = (structure, secId) =>
  (structure.sections || []).find((s) => s.secId === secId)

const defaultMatSecIds = (structure) => {
  const matId = (structure.materials && structure.materials[0] && structure.materials[0].matId) || 'mat1'
  const secId = (structure.sections && structure.sections[0] && structure.sections[0].secId) || 'sec1'
  return { matId, secId }
}

module.exports = {
  elementINode,
  elementJNode,
  nodeByIdMap,
  materialById,
  sectionById,
  defaultMatSecIds
}
