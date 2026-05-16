const defaultStructure = require('../../core/structure/defaultStructure')

const migrateFromTruss = (truss) => {
  if (!truss || !truss.nodes) return null
  const base = defaultStructure()
  const matId = 'mat1'
  const secId = 'sec1'
  let secType = 'rec'
  if (truss.sectionType === 'circle') secType = 'circle'
  else if (truss.sectionType === 'i') secType = 'I_Shape'
  base.sections = [{
    secId,
    type: secType,
    b: truss.sectionB != null ? truss.sectionB : 2,
    H: truss.sectionH != null ? truss.sectionH : 2,
    tw: truss.sectionTw != null ? truss.sectionTw : 0.2,
    tf: truss.sectionTf != null ? truss.sectionTf : 0.25,
    r: truss.sectionRadius != null ? truss.sectionRadius : 1
  }]
  base.nodes = (truss.nodes || []).map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z }))
  base.elements = (truss.elements || []).map((e) => ({
    id: e.id,
    iNode: e.startId != null ? e.startId : e.iNode,
    jNode: e.endId != null ? e.endId : e.jNode,
    matId,
    secId
  }))
  base.nextNodeId = truss.nextNodeId || base.nextNodeId
  base.nextElementId = truss.nextElementId || base.nextElementId
  base.show3dMembers = !!truss.show3dMembers
  return base
}

const ensure = (state) => {
  if (state.structure && typeof state.structure === 'object' && state.structure.nodes) {
    let s = Object.assign({}, defaultStructure(), state.structure)
    if (s.structuresModal === 'display') s = Object.assign({}, s, { structuresModal: null })
    syncNextIds(s)
    return s
  }
  const migrated = state.truss ? migrateFromTruss(state.truss) : null
  const s = migrated || defaultStructure()
  syncNextIds(s)
  return s
}

const { generateId, generateIds } = require('../selection/idAlloc')

const nodeIds = (s) => (s.nodes || []).map((n) => n.id)
const elementIds = (s) => (s.elements || []).map((e) => e.id)

const syncNextIds = (s) => {
  s.nextNodeId = generateId(nodeIds(s))
  s.nextElementId = generateId(elementIds(s))
}

const withStructure = (state, next) =>
  Object.assign({}, state, { structure: Object.assign({}, ensure(state), next) })

const defaultMatSec = (s) => ({
  matId: (s.materials[0] && s.materials[0].matId) || 'mat1',
  secId: (s.sections[0] && s.sections[0].secId) || 'sec1'
})

const idEq = (a, b) => String(a) === String(b)

// --- Nodes ---
const addNodeAtAlloc = (state, { x, y, z }) => {
  const s = ensure(state)
  const id = generateId(nodeIds(s))
  const nodes = s.nodes.concat([{
    id,
    x: isFinite(Number(x)) ? Number(x) : 0,
    y: isFinite(Number(y)) ? Number(y) : 0,
    z: isFinite(Number(z)) ? Number(z) : 0
  }])
  return {
    state: withStructure(state, {
      nodes,
      nextNodeId: generateId(nodes.map((n) => n.id))
    }),
    id
  }
}

const addNode = (state) => addNodeAtAlloc(state, { x: 0, y: 0, z: 0 }).state

const addNodeAt = (state, payload) => addNodeAtAlloc(state, payload).state

const removeNode = (state, nodeId) => {
  const s = ensure(state)
  const id = Number(nodeId)
  const removedElementIds = new Set(
    s.elements
      .filter((e) => Number(e.iNode) === id || Number(e.jNode) === id)
      .map((e) => Number(e.id))
  )
  return withStructure(state, {
    nodes: s.nodes.filter((n) => Number(n.id) !== id),
    elements: s.elements.filter((e) => !removedElementIds.has(Number(e.id))),
    restraints: s.restraints.filter((r) => Number(r.nodeId) !== id),
    releases: s.releases.filter((r) => !removedElementIds.has(Number(r.elementId))),
    loads: Object.assign({}, s.loads, {
      nodal: (s.loads.nodal || []).filter((l) => Number(l.nodeId) !== id),
      distributed: (s.loads.distributed || []).filter((l) => !removedElementIds.has(Number(l.elementId)))
    })
  })
}

/** Remove many nodes and all attached elements, restraints, loads, releases (one state tick). */
const removeNodesBatch = (state, { nodeIds }) => {
  const s = ensure(state)
  const ids = new Set(
    (Array.isArray(nodeIds) ? nodeIds : []).map(Number).filter((n) => isFinite(n))
  )
  if (!ids.size) return state

  const removedElementIds = new Set(
    s.elements
      .filter((e) => ids.has(Number(e.iNode)) || ids.has(Number(e.jNode)))
      .map((e) => Number(e.id))
  )

  return withStructure(state, {
    nodes: s.nodes.filter((n) => !ids.has(Number(n.id))),
    elements: s.elements.filter((e) => !removedElementIds.has(Number(e.id))),
    restraints: s.restraints.filter((r) => !ids.has(Number(r.nodeId))),
    releases: s.releases.filter((r) => !removedElementIds.has(Number(r.elementId))),
    loads: Object.assign({}, s.loads, {
      nodal: (s.loads.nodal || []).filter((l) => !ids.has(Number(l.nodeId))),
      distributed: (s.loads.distributed || []).filter((l) => !removedElementIds.has(Number(l.elementId)))
    })
  })
}

const updateNode = (state, { id, x, y, z }) => {
  const s = ensure(state)
  const nid = Number(id)
  return withStructure(state, {
    nodes: s.nodes.map((n) => (Number(n.id) === nid
      ? { id: n.id, x: Number(x), y: Number(y), z: Number(z) }
      : n))
  })
}

/** Batch node coordinates (one state tick — avoids strict id type mismatch and races). */
const updateNodesBatch = (state, { nodes: updates }) => {
  const s = ensure(state)
  if (!Array.isArray(updates) || !updates.length) return state
  const byId = new Map()
  for (const p of updates) {
    const id = Number(p && p.id)
    if (!isFinite(id)) continue
    byId.set(id, p)
  }
  if (!byId.size) return state
  return withStructure(state, {
    nodes: s.nodes.map((n) => {
      const p = byId.get(Number(n.id))
      if (!p) return n
      const nx = Number(p.x)
      const ny = Number(p.y)
      const nz = Number(p.z)
      return {
        id: n.id,
        x: isFinite(nx) ? nx : n.x,
        y: isFinite(ny) ? ny : n.y,
        z: isFinite(nz) ? nz : n.z
      }
    })
  })
}

// --- Elements ---
const addElement = (state, payload) => {
  const s = ensure(state)
  const defs = defaultMatSec(s)
  let iNode = s.nodes[0] ? s.nodes[0].id : 1
  let jNode = s.nodes[1] ? s.nodes[1].id : iNode
  if (payload) {
    if (payload.iNode != null) iNode = Number(payload.iNode)
    else if (payload.startId != null) iNode = Number(payload.startId)
    if (payload.jNode != null) jNode = Number(payload.jNode)
    else if (payload.endId != null) jNode = Number(payload.endId)
  }
  if (!isFinite(iNode) || !isFinite(jNode) || iNode === jNode) return state
  const eid = generateId(elementIds(s))
  const elements = s.elements.concat([{
    id: eid,
    iNode,
    jNode,
    matId: String((payload && payload.matId) || defs.matId),
    secId: String((payload && payload.secId) || defs.secId)
  }])
  return withStructure(state, {
    elements,
    nextElementId: generateId(elements.map((e) => e.id))
  })
}

/** One atomic update: add node at (x,y,z) then element from iNode to that new node (fixes two cb() racing same base state). */
const addElementToNewNodeAt = (state, { x, y, z, iNode }) => {
  const from = Number(iNode)
  if (!isFinite(from)) return state
  const { state: afterNode, id: jNode } = addNodeAtAlloc(state, { x, y, z })
  if (from === jNode) return state
  return addElement(afterNode, { iNode: from, jNode })
}

const removeElement = (state, elementId) => {
  const s = ensure(state)
  const id = Number(elementId)
  return withStructure(state, {
    elements: s.elements.filter((e) => Number(e.id) !== id),
    releases: s.releases.filter((r) => r.elementId !== id),
    loads: Object.assign({}, s.loads, {
      distributed: (s.loads.distributed || []).filter((l) => l.elementId !== id)
    })
  })
}

/** Remove many elements and their releases / distributed loads (nodes kept). */
const removeElementsBatch = (state, { elementIds }) => {
  const s = ensure(state)
  const ids = new Set(
    (Array.isArray(elementIds) ? elementIds : []).map(Number).filter((n) => isFinite(n))
  )
  if (!ids.size) return state

  return withStructure(state, {
    elements: s.elements.filter((e) => !ids.has(Number(e.id))),
    releases: s.releases.filter((r) => !ids.has(Number(r.elementId))),
    loads: Object.assign({}, s.loads, {
      distributed: (s.loads.distributed || []).filter((l) => !ids.has(Number(l.elementId)))
    })
  })
}

const updateElement = (state, { id, iNode, jNode, matId, secId, startId, endId }) => {
  const s = ensure(state)
  const rid = Number(id)
  const ii = isFinite(Number(iNode)) ? Number(iNode)
    : isFinite(Number(startId)) ? Number(startId) : undefined
  const jj = isFinite(Number(jNode)) ? Number(jNode)
    : isFinite(Number(endId)) ? Number(endId) : undefined
  return withStructure(state, {
    elements: s.elements.map((e) => {
      if (Number(e.id) !== rid) return e
      const defs = defaultMatSec(s)
      return {
        id: e.id,
        iNode: ii != null ? ii : e.iNode,
        jNode: jj != null ? jj : e.jNode,
        matId: matId != null ? String(matId) : e.matId || defs.matId,
        secId: secId != null ? String(secId) : e.secId || defs.secId
      }
    })
  })
}

// --- Materials ---
const addMaterial = (state) => {
  const s = ensure(state)
  const id = `mat${s.nextMatId}`
  return withStructure(state, {
    materials: s.materials.concat([{ matId: id, w: 0, E: 32836000, G: 12628000 }]),
    nextMatId: s.nextMatId + 1
  })
}

const removeMaterial = (state, matId) => {
  const s = ensure(state)
  if (s.materials.length <= 1) return state
  const defs = defaultMatSec(s)
  const fallback = s.materials.find((m) => !idEq(m.matId, matId))
  const fid = fallback ? fallback.matId : defs.matId
  return withStructure(state, {
    materials: s.materials.filter((m) => !idEq(m.matId, matId)),
    elements: s.elements.map((e) => (idEq(e.matId, matId) ? Object.assign({}, e, { matId: fid }) : e))
  })
}

const updateMaterial = (state, payload) => {
  const s = ensure(state)
  const { matId, w, E, G } = payload
  return withStructure(state, {
    materials: s.materials.map((m) => (idEq(m.matId, matId)
      ? { matId, w: Number(w), E: Number(E), G: Number(G) }
      : m))
  })
}

// --- Sections ---
const addSection = (state) => {
  const s = ensure(state)
  const id = `sec${s.nextSecId}`
  return withStructure(state, {
    sections: s.sections.concat([{
      secId: id, type: 'rec', b: 2, H: 2, tw: 0.2, tf: 0.25, r: 1
    }]),
    nextSecId: s.nextSecId + 1
  })
}

const removeSection = (state, secId) => {
  const s = ensure(state)
  if (s.sections.length <= 1) return state
  const fallback = s.sections.find((x) => !idEq(x.secId, secId))
  const fid = fallback ? fallback.secId : 'sec1'
  return withStructure(state, {
    sections: s.sections.filter((x) => !idEq(x.secId, secId)),
    elements: s.elements.map((e) => (idEq(e.secId, secId) ? Object.assign({}, e, { secId: fid }) : e))
  })
}

const updateSection = (state, payload) => {
  const s = ensure(state)
  const { secId, type, b, H, tw, tf, r } = payload
  const t = (type === 'rec' || type === 'circle' || type === 'I_Shape') ? type : 'rec'
  return withStructure(state, {
    sections: s.sections.map((x) => (idEq(x.secId, secId)
      ? {
        secId,
        type: t,
        b: Number(b),
        H: Number(H),
        tw: Number(tw),
        tf: Number(tf),
        r: Number(r)
      }
      : x))
  })
}

// --- Restraints ---
const addRestraint = (state, payload) => {
  const s = ensure(state)
  let nodeId = Number(payload && payload.nodeId)
  if (!isFinite(nodeId) && s.nodes[0]) nodeId = s.nodes[0].id
  if (!isFinite(nodeId)) return state
  const existing = s.restraints.find((r) => r.nodeId === nodeId)
  const dofs = (payload && payload.dofs) || [true, true, true, true, true, true]
  if (existing) {
    return withStructure(state, {
      restraints: s.restraints.map((r) => (r.nodeId === nodeId
        ? { id: r.id, nodeId, preset: payload.preset, dofs: dofs.map((x) => !!x) }
        : r))
    })
  }
  const id = s.nextRestraintId
  const dofsArr = (payload && payload.dofs)
    ? payload.dofs.map((x) => !!x)
    : [true, true, true, true, true, true]
  return withStructure(state, {
    restraints: s.restraints.concat([{
      id,
      nodeId,
      preset: payload && payload.preset,
      dofs: dofsArr
    }]),
    nextRestraintId: id + 1
  })
}

const removeRestraint = (state, id) => {
  const s = ensure(state)
  const rid = Number(id)
  return withStructure(state, {
    restraints: s.restraints.filter((r) => r.id !== rid)
  })
}

const updateRestraint = (state, payload) => addRestraint(state, payload)

// --- Releases ---
const addRelease = (state, payload) => {
  const s = ensure(state)
  let elementId = Number(payload && payload.elementId)
  if (!isFinite(elementId) && s.elements[0]) elementId = s.elements[0].id
  const endIn = payload && payload.end
  let end = null
  if (endIn === 'start' || endIn === 'end' || endIn === 'both') end = endIn
  else if (endIn !== 'none') end = 'both'
  if (!isFinite(elementId) || !end) return state
  const existing = s.releases.find((r) => r.elementId === elementId)
  if (existing) {
    return withStructure(state, {
      releases: s.releases.map((r) => (r.elementId === elementId
        ? { id: r.id, elementId, end }
        : r))
    })
  }
  const id = s.nextReleaseId
  return withStructure(state, {
    releases: s.releases.concat([{ id, elementId, end }]),
    nextReleaseId: id + 1
  })
}

const removeRelease = (state, id) => {
  const s = ensure(state)
  return withStructure(state, {
    releases: s.releases.filter((r) => r.id !== Number(id))
  })
}

// --- Loads ---
const addNodalLoad = (state, payload) => {
  const s = ensure(state)
  const id = s.nextNodalLoadId
  const nodeId = Number(payload && payload.nodeId) || (s.nodes[0] && s.nodes[0].id) || 1
  return withStructure(state, {
    loads: Object.assign({}, s.loads, {
      nodal: (s.loads.nodal || []).concat([{
        id,
        nodeId,
        Fx: Number(payload.Fx) || 0,
        Fy: Number(payload.Fy) || 0,
        Fz: Number(payload.Fz) || 0,
        Mx: Number(payload.Mx) || 0,
        My: Number(payload.My) || 0,
        Mz: Number(payload.Mz) || 0
      }])
    }),
    nextNodalLoadId: id + 1
  })
}

const removeNodalLoad = (state, id) => {
  const s = ensure(state)
  return withStructure(state, {
    loads: Object.assign({}, s.loads, {
      nodal: (s.loads.nodal || []).filter((l) => l.id !== Number(id))
    })
  })
}

const updateNodalLoad = (state, payload) => {
  const s = ensure(state)
  const id = Number(payload.id)
  return withStructure(state, {
    loads: Object.assign({}, s.loads, {
      nodal: (s.loads.nodal || []).map((l) => (l.id === id ? Object.assign({}, l, payload, { id }) : l))
    })
  })
}

const addDistributedLoad = (state, payload) => {
  const s = ensure(state)
  const id = s.nextDistributedLoadId
  const elementId = Number(payload && payload.elementId) || (s.elements[0] && s.elements[0].id) || 1
  return withStructure(state, {
    loads: Object.assign({}, s.loads, {
      distributed: (s.loads.distributed || []).concat([{
        id,
        elementId,
        qy: Number(payload.qy) || 0
      }])
    }),
    nextDistributedLoadId: id + 1
  })
}

const removeDistributedLoad = (state, id) => {
  const s = ensure(state)
  return withStructure(state, {
    loads: Object.assign({}, s.loads, {
      distributed: (s.loads.distributed || []).filter((l) => l.id !== Number(id))
    })
  })
}

const updateDistributedLoad = (state, payload) => {
  const s = ensure(state)
  const id = Number(payload.id)
  return withStructure(state, {
    loads: Object.assign({}, s.loads, {
      distributed: (s.loads.distributed || []).map((l) =>
        (l.id === id ? Object.assign({}, l, payload, { id }) : l))
    })
  })
}

// --- UI / display ---
const setShow3dMembers = (state, value) => withStructure(state, { show3dMembers: !!value })
const setStructuresModal = (state, modal) => {
  const patch = { structuresModal: modal || null }
  if (modal) patch.structuresView = modal
  return withStructure(state, patch)
}
const setStructuresView = (state, view) => withStructure(state, { structuresView: view })
const setBoundariesTab = (state, tab) => withStructure(state, { boundariesTab: tab })
const setPropertiesTab = (state, tab) => withStructure(state, { propertiesTab: tab })

/** Full structure replace (panel batch commit) */
const replaceStructure = (state, structure) =>
  Object.assign({}, state, { structure: Object.assign({}, defaultStructure(), structure) })

/**
 * One atomic state tick for selection properties Apply (avoids withLatestFrom race
 * when multiple structureCb() fire in the same turn).
 * @param {object} state
 * @param {{
 *   nodes?: Array<{id:number,x:number,y:number,z:number}>,
 *   restraints?: Array<{nodeId:number,dofs:boolean[]}>,
 *   nodalLoads?: Array<{nodeId:number,Fx?:number,Fy?:number,Fz?:number,Mx?:number,My?:number,Mz?:number}>,
 *   elements?: Array<{id:number,iNode?:number,jNode?:number,matId?:string,secId?:string}>,
 *   releases?: Array<{elementId:number,end:string}>
 * }} payload
 */
const applySelectionPanel = (state, payload) => {
  const p = payload || {}
  let next = state

  if (Array.isArray(p.nodes) && p.nodes.length) {
    next = updateNodesBatch(next, { nodes: p.nodes })
  }

  if (Array.isArray(p.restraints)) {
    for (const r of p.restraints) {
      if (r && isFinite(Number(r.nodeId))) {
        next = addRestraint(next, { nodeId: Number(r.nodeId), dofs: r.dofs })
      }
    }
  }

  if (Array.isArray(p.nodalLoads)) {
    for (const load of p.nodalLoads) {
      if (!load || !isFinite(Number(load.nodeId))) continue
      const s = ensure(next)
      const existing = (s.loads.nodal || []).find((l) => Number(l.nodeId) === Number(load.nodeId))
      if (existing) {
        next = updateNodalLoad(next, Object.assign({ id: existing.id }, load))
      } else {
        next = addNodalLoad(next, load)
      }
    }
  }

  if (Array.isArray(p.elements)) {
    for (const el of p.elements) {
      if (el && isFinite(Number(el.id))) next = updateElement(next, el)
    }
  }

  if (Array.isArray(p.releases)) {
    for (const rel of p.releases) {
      if (!rel || !isFinite(Number(rel.elementId))) continue
      const eid = Number(rel.elementId)
      const s = ensure(next)
      const existing = s.releases.find((r) => Number(r.elementId) === eid)
      if (rel.end === 'none' || rel.end == null || rel.end === '') {
        if (existing) next = removeRelease(next, existing.id)
      } else if (rel.end === 'start' || rel.end === 'end' || rel.end === 'both') {
        next = addRelease(next, { elementId: eid, end: rel.end })
      }
    }
  }

  return next
}

const offsetNodeAlongAxis = (node, axis, cum) => {
  const ox = Number(node.x) || 0
  const oy = Number(node.y) || 0
  const oz = Number(node.z) || 0
  const pos = { x: ox, y: oy, z: oz }
  if (axis === 'x') pos.x = ox + cum
  else if (axis === 'y') pos.y = oy + cum
  else pos.z = oz + cum
  return pos
}

const axisCoord = (node, axis) => {
  if (!node) return 0
  const v = Number(axis === 'x' ? node.x : axis === 'y' ? node.y : node.z)
  return isFinite(v) ? v : 0
}

const nodeNear = (node, pos, eps = 1e-6) => {
  if (!node || !pos) return false
  return Math.abs(Number(node.x) - pos.x) < eps &&
    Math.abs(Number(node.y) - pos.y) < eps &&
    Math.abs(Number(node.z) - pos.z) < eps
}

/** Order anchor nodes into a path along existing elements (e.g. 1-2-3). */
const orderAnchorChain = (s, anchorNodeIds) => {
  const ids = [...new Set(anchorNodeIds.map(Number).filter((n) => isFinite(n)))]
  if (ids.length <= 1) return ids

  const idSet = new Set(ids)
  const adj = new Map()
  for (const id of ids) adj.set(id, [])
  for (const e of s.elements) {
    const a = Number(e.iNode)
    const b = Number(e.jNode)
    if (idSet.has(a) && idSet.has(b)) {
      adj.get(a).push(b)
      adj.get(b).push(a)
    }
  }

  let start = ids.find((id) => (adj.get(id) || []).length === 1)
  if (start == null) start = ids.slice().sort((a, b) => a - b)[0]

  const path = [start]
  let prev = null
  let cur = start
  while (path.length < ids.length) {
    const neighbors = (adj.get(cur) || []).filter((n) => n !== prev)
    if (!neighbors.length) break
    const nextId = neighbors[0]
    path.push(nextId)
    prev = cur
    cur = nextId
  }
  for (const id of ids.slice().sort((a, b) => a - b)) {
    if (!path.includes(id)) path.push(id)
  }
  return path
}

/** One ordered node chain for spacing (1-2-3 → bays 4-5-6, 7-8-9). */
const buildSpacingNodeChain = (s, anchorNodeIds) => {
  const ids = [...new Set(anchorNodeIds.map(Number).filter((n) => isFinite(n)))]
  if (ids.length <= 1) return ids
  const idSet = new Set(ids)
  let hasInternalEdge = false
  for (const e of s.elements) {
    const a = Number(e.iNode)
    const b = Number(e.jNode)
    if (idSet.has(a) && idSet.has(b)) {
      hasInternalEdge = true
      break
    }
  }
  if (hasInternalEdge) return orderAnchorChain(s, ids)
  const ordered = []
  const seen = new Set()
  for (const raw of anchorNodeIds) {
    const id = Number(raw)
    if (!isFinite(id) || !idSet.has(id) || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }
  return ordered.length ? ordered : ids
}

const hasElementBetween = (s, a, b) => {
  const ai = Number(a)
  const bi = Number(b)
  return s.elements.some((e) =>
    (Number(e.iNode) === ai && Number(e.jNode) === bi) ||
    (Number(e.iNode) === bi && Number(e.jNode) === ai)
  )
}

const nodesAtPosition = (s, pos) => s.nodes.filter((n) => nodeNear(n, pos))

/**
 * One bay slot (sequential): reuse only if already linked from prevBay[i];
 * else remove stale nodes at slot and allocate the next id.
 */
const createBayNodes = (state, anchorNodes, axis, cum, orderedNodeIds, prevBay) => {
  if (Math.abs(cum) < 1e-9) {
    return { state, bay: orderedNodeIds.map(Number) }
  }

  const anchorIdSet = new Set(orderedNodeIds.map(Number))
  let next = state
  const bay = []

  for (let i = 0; i < anchorNodes.length; i++) {
    const anchor = anchorNodes[i]
    const pos = offsetNodeAlongAxis(anchor, axis, cum)
    const home = {
      x: Number(anchor.x),
      y: Number(anchor.y),
      z: Number(anchor.z)
    }

    if (nodeNear(home, pos)) {
      bay.push(Number(orderedNodeIds[i]))
      continue
    }

    const s = ensure(next)
    const atPos = nodesAtPosition(s, pos)
    const prevId = Number(prevBay[i])
    const linked = atPos.find((n) => hasElementBetween(s, prevId, n.id))

    if (linked) {
      bay.push(Number(linked.id))
      continue
    }

    for (const n of atPos) {
      if (!anchorIdSet.has(Number(n.id))) {
        next = removeNode(next, n.id)
      }
    }

    const alloc = addNodeAtAlloc(next, pos)
    next = alloc.state
    bay.push(alloc.id)
  }

  return { state: next, bay }
}

/** Consecutive chain segments that exist as elements on the anchor (e.g. 1–2, 2–3 → bay 4–5, 5–6). */
const chainEdgesAlongOrderedNodes = (s, orderedNodeIds) => {
  const edges = []
  for (let i = 0; i < orderedNodeIds.length - 1; i++) {
    const a = Number(orderedNodeIds[i])
    const b = Number(orderedNodeIds[i + 1])
    const el = s.elements.find((e) => {
      const ai = Number(e.iNode)
      const bi = Number(e.jNode)
      return (ai === a && bi === b) || (ai === b && bi === a)
    })
    if (el) {
      edges.push({
        bayI: i,
        bayJ: i + 1,
        matId: el.matId,
        secId: el.secId
      })
    }
  }
  return edges
}

/** Mirror source chain segments in each new bay + optional vertical prev→new per index. */
const linkBayElements = (state, {
  prevBay,
  newBay,
  chainEdges,
  makeElement,
  matId,
  secId
}) => {
  let next = state

  for (const edge of chainEdges) {
    if (edge.bayI >= newBay.length || edge.bayJ >= newBay.length) continue
    const iNode = newBay[edge.bayI]
    const jNode = newBay[edge.bayJ]
    const props = {
      matId: edge.matId != null ? edge.matId : matId,
      secId: edge.secId != null ? edge.secId : secId
    }
    if (!hasElementBetween(ensure(next), iNode, jNode)) {
      next = addElement(next, Object.assign({ iNode, jNode }, props))
    }
  }

  if (makeElement) {
    const base = {}
    if (matId != null) base.matId = matId
    if (secId != null) base.secId = secId
    for (let i = 0; i < prevBay.length && i < newBay.length; i++) {
      const iNode = prevBay[i]
      const jNode = newBay[i]
      if (!hasElementBetween(ensure(next), iNode, jNode)) {
        next = addElement(next, Object.assign({ iNode, jNode }, base))
      }
    }
  }

  return next
}

/**
 * One sequential pass: each spacing step → bay nodes (chain order) → link elements.
 * No second “resolve by position” path (that caused 4-5-8 and wrong verticals).
 */
const spacingBayPattern = (state, {
  orderedNodeIds,
  axis,
  increments,
  makeElement,
  matId,
  secId,
  chainEdges
}) => {
  const s0 = ensure(state)
  const anchorNodes = orderedNodeIds
    .map((id) => s0.nodes.find((n) => Number(n.id) === Number(id)))
    .filter(Boolean)
  if (!anchorNodes.length || !increments.length) return state

  const edges = chainEdges || chainEdgesAlongOrderedNodes(s0, orderedNodeIds)

  let next = state
  let prevBay = orderedNodeIds.map(Number)
  let cum = 0

  for (const step of increments) {
    const d = Number(step)
    if (!isFinite(d)) continue
    cum += d

    const created = createBayNodes(next, anchorNodes, axis, cum, orderedNodeIds, prevBay)
    next = created.state
    const newBay = created.bay

    next = linkBayElements(next, {
      prevBay,
      newBay,
      chainEdges: edges,
      makeElement,
      matId,
      secId
    })

    prevBay = newBay
  }

  return next
}

/**
 * Node generate: new nodes per step; vertical links only when makeElement (no parallel element).
 */
const spacingPatternFromAnchors = (state, payload) => {
  const p = payload || {}
  const axis = p.axis === 'y' || p.axis === 'z' ? p.axis : 'x'
  const increments = Array.isArray(p.increments) ? p.increments : []
  const makeElement = !!p.makeElement
  const anchorNodeIds = Array.isArray(p.anchorNodeIds)
    ? p.anchorNodeIds.map(Number).filter((n) => isFinite(n))
    : []

  if (!increments.length || !anchorNodeIds.length) return state

  const chain = buildSpacingNodeChain(ensure(state), anchorNodeIds)
  if (!chain.length) return state

  const chainEdges = chainEdgesAlongOrderedNodes(ensure(state), chain)

  return spacingBayPattern(state, {
    orderedNodeIds: chain,
    axis,
    increments,
    makeElement,
    chainEdges
  })
}

/** Connected components of selected elements → one ordered chain each (not N parallel 2-node runs). */
const chainsFromSelectedElements = (s, anchorElementIds) => {
  const adj = new Map()
  const matSecByEdge = new Map()

  for (const elemId of anchorElementIds) {
    const el = s.elements.find((e) => Number(e.id) === Number(elemId))
    if (!el) continue
    const a = Number(el.iNode)
    const b = Number(el.jNode)
    if (!isFinite(a) || !isFinite(b)) continue
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a).push(b)
    adj.get(b).push(a)
    const key = a < b ? `${a},${b}` : `${b},${a}`
    matSecByEdge.set(key, { matId: el.matId, secId: el.secId })
  }

  const visited = new Set()
  const chains = []

  for (const start of [...adj.keys()].sort((a, b) => a - b)) {
    if (visited.has(start)) continue
    const component = []
    const stack = [start]
    visited.add(start)
    while (stack.length) {
      const cur = stack.pop()
      component.push(cur)
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) {
          visited.add(nb)
          stack.push(nb)
        }
      }
    }
    const chain = orderAnchorChain(s, component)
    if (chain.length < 2) continue
    const a0 = chain[0]
    const b0 = chain[1]
    const key = a0 < b0 ? `${a0},${b0}` : `${b0},${a0}`
    const ms = matSecByEdge.get(key) || {}
    chains.push({ chain, matId: ms.matId, secId: ms.secId })
  }

  return chains
}

/** Element generate: merged endpoint chains + parallel element copy each step. */
const spacingPatternFromElements = (state, payload) => {
  const p = payload || {}
  const axis = p.axis === 'y' || p.axis === 'z' ? p.axis : 'x'
  const increments = Array.isArray(p.increments) ? p.increments : []
  const makeElement = !!p.makeElement
  const anchorElementIds = Array.isArray(p.anchorElementIds)
    ? p.anchorElementIds.map(Number).filter((n) => isFinite(n))
    : []

  if (!increments.length || !anchorElementIds.length) return state

  const s0 = ensure(state)
  const chains = chainsFromSelectedElements(s0, anchorElementIds)
  if (!chains.length) return state

  let next = state
  for (const { chain, matId, secId } of chains) {
    const chainEdges = chainEdgesAlongOrderedNodes(ensure(next), chain)
    next = spacingBayPattern(next, {
      orderedNodeIds: chain,
      axis,
      increments,
      makeElement,
      matId,
      secId,
      chainEdges
    })
  }
  return next
}

/** Run 3D frame FEM (6 DOF/node) via @jscad/fem */
const runFemAnalysis = (state) => {
  const s = ensure(state)
  const { analyzeStructure } = require('@jscad/fem')
  const result = analyzeStructure(s, {
    sparse: true,
    cache: state.femCache || null
  })
  const femResult = result.ok
    ? {
      ok: true,
      error: null,
      maxDisp: maxDisplacementMagnitude(result.displacements),
      nodeCount: s.nodes.length,
      elementCount: s.elements.length
    }
    : { ok: false, error: result.error || 'Analysis failed' }
  return Object.assign({}, state, {
    structure: s,
    femResult,
    femCache: result.cache || state.femCache || null,
    femRaw: result.ok
      ? {
        displacements: result.displacements,
        reactions: result.reactions,
        internalForces: result.internalForces
      }
      : null
  })
}

const maxDisplacementMagnitude = (displacements) => {
  if (!displacements || !displacements.length) return 0
  let max = 0
  for (let i = 0; i < displacements.length; i += 6) {
    const ux = displacements[i] || 0
    const uy = displacements[i + 1] || 0
    const uz = displacements[i + 2] || 0
    const m = Math.sqrt(ux * ux + uy * uy + uz * uz)
    if (m > max) max = m
  }
  return max
}

module.exports = {
  ensure,
  generateId,
  generateIds,
  migrateFromTruss,
  addNode,
  addNodeAt,
  removeNode,
  removeNodesBatch,
  updateNode,
  updateNodesBatch,
  addElement,
  addElementToNewNodeAt,
  removeElement,
  removeElementsBatch,
  updateElement,
  addMaterial,
  removeMaterial,
  updateMaterial,
  addSection,
  removeSection,
  updateSection,
  addRestraint,
  removeRestraint,
  updateRestraint,
  addRelease,
  removeRelease,
  addNodalLoad,
  removeNodalLoad,
  updateNodalLoad,
  addDistributedLoad,
  removeDistributedLoad,
  updateDistributedLoad,
  setShow3dMembers,
  setStructuresModal,
  setStructuresView,
  setBoundariesTab,
  setPropertiesTab,
  replaceStructure,
  applySelectionPanel,
  spacingPatternFromAnchors,
  spacingPatternFromElements,
  runFemAnalysis
}
