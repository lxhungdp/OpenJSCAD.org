/**
 * Build FEM inputs from global structure model (3D frame, 6 DOF/node).
 * Solver maps (supports, loads, releases, elementsProps) use 0-based mesh indices.
 */
const { sectionToFemProps } = require('./sectionToFemProps')
const { elementINode, elementJNode, materialById, sectionById, defaultMatSecIds } = require('./structureView')

const RESTRAINT_PRESETS = {
  fixed: [true, true, true, true, true, true],
  pinned: [true, true, true, false, false, false],
  'horizontal-roller': [false, true, true, false, false, false],
  'vertical-roller': [true, false, true, false, false, false]
}

const tupleForRestraint = (r) => {
  if (r.preset && RESTRAINT_PRESETS[r.preset]) {
    return RESTRAINT_PRESETS[r.preset].slice()
  }
  const d = r.dofs
  if (Array.isArray(d) && d.length === 6) {
    return d.map((x) => !!x)
  }
  return [true, true, true, true, true, true]
}

/**
 * @returns {{ nodes, elements, nodeIdToIndex: Map, elementIdToIndex: Map, geometryMapping }}
 */
const structureToFemMesh = (structure) => {
  const nodes = []
  const elements = []
  const pointToNodes = new Map()
  const lineToElements = new Map()
  const nodeIdToIndex = new Map()
  const elementIdToIndex = new Map()

  for (const n of structure.nodes || []) {
    const idx = nodes.length
    nodes.push([n.x, n.y, n.z])
    nodeIdToIndex.set(n.id, idx)
    pointToNodes.set(n.id, [idx])
  }

  for (const el of structure.elements || []) {
    const i = nodeIdToIndex.get(elementINode(el))
    const j = nodeIdToIndex.get(elementJNode(el))
    if (i == null || j == null) continue
    const eidx = elements.length
    elements.push([i, j])
    elementIdToIndex.set(el.id, eidx)
    lineToElements.set(el.id, [eidx])
  }

  return {
    nodes,
    elements,
    nodeIdToIndex,
    elementIdToIndex,
    geometryMapping: { pointToNodes, lineToElements }
  }
}

/** Supports keyed by mesh node index (0..n-1). */
const structureToNodalSupports = (structure, nodeIdToIndex) => {
  const out = new Map()
  for (const r of structure.restraints || []) {
    const idx = nodeIdToIndex.get(Number(r.nodeId))
    if (idx == null) continue
    out.set(idx, tupleForRestraint(r))
  }
  return out
}

/** Releases keyed by mesh element index. */
const structureToElementReleases = (structure, elementIdToIndex) => {
  const out = new Map()
  for (const rel of structure.releases || []) {
    const eidx = elementIdToIndex.get(Number(rel.elementId))
    if (eidx == null) continue
    const end = rel.end || 'both'
    const mzStart = end === 'start' || end === 'both'
    const mzEnd = end === 'end' || end === 'both'
    out.set(eidx, [mzStart, mzEnd])
  }
  return out
}

/** Stiffness props keyed by mesh element index. */
const structureToElementsProps = (structure, elementIdToIndex) => {
  const defs = defaultMatSecIds(structure)
  const out = new Map()
  for (const el of structure.elements || []) {
    const eidx = elementIdToIndex.get(el.id)
    if (eidx == null) continue
    const mat = materialById(structure, el.matId || defs.matId)
    const sec = sectionById(structure, el.secId || defs.secId)
    const femSec = sec ? sectionToFemProps(sec) : null
    if (!femSec) continue
    out.set(eidx, {
      elasticity: mat ? Number(mat.E) || 0 : 0,
      shearModulus: mat ? Number(mat.G) || 0 : 0,
      area: femSec.area,
      momentInertiaY: femSec.momentInertiaY,
      momentInertiaZ: femSec.momentInertiaZ,
      torsionalConstant: femSec.torsionalConstant
    })
  }
  return out
}

const structureToFemSnapshot = (structure) => {
  const mesh = structureToFemMesh(structure)
  return {
    mesh: {
      nodes: mesh.nodes,
      elements: mesh.elements,
      geometryMapping: mesh.geometryMapping
    },
    nodeIdToIndex: mesh.nodeIdToIndex,
    elementIdToIndex: mesh.elementIdToIndex,
    supports: structureToNodalSupports(structure, mesh.nodeIdToIndex),
    releases: structureToElementReleases(structure, mesh.elementIdToIndex),
    elementsProps: structureToElementsProps(structure, mesh.elementIdToIndex)
  }
}

module.exports = {
  RESTRAINT_PRESETS,
  tupleForRestraint,
  structureToFemMesh,
  structureToNodalSupports,
  structureToElementReleases,
  structureToElementsProps,
  structureToFemSnapshot
}
