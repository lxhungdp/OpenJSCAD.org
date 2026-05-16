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

const syncNextIds = (s) => {
  if (s.nextNodeId == null && s.nodes.length) {
    s.nextNodeId = Math.max(...s.nodes.map((n) => n.id)) + 1
  }
  if (s.nextElementId == null && s.elements.length) {
    s.nextElementId = Math.max(...s.elements.map((e) => e.id)) + 1
  }
}

const withStructure = (state, next) =>
  Object.assign({}, state, { structure: Object.assign({}, ensure(state), next) })

const defaultMatSec = (s) => ({
  matId: (s.materials[0] && s.materials[0].matId) || 'mat1',
  secId: (s.sections[0] && s.sections[0].secId) || 'sec1'
})

const idEq = (a, b) => String(a) === String(b)

// --- Nodes ---
const addNode = (state) => {
  const s = ensure(state)
  const id = s.nextNodeId
  return withStructure(state, {
    nodes: s.nodes.concat([{ id, x: 0, y: 0, z: 0 }]),
    nextNodeId: id + 1
  })
}

const addNodeAt = (state, { x, y, z }) => {
  const s = ensure(state)
  const id = s.nextNodeId
  return withStructure(state, {
    nodes: s.nodes.concat([{
      id,
      x: isFinite(Number(x)) ? Number(x) : 0,
      y: isFinite(Number(y)) ? Number(y) : 0,
      z: isFinite(Number(z)) ? Number(z) : 0
    }]),
    nextNodeId: id + 1
  })
}

const removeNode = (state, nodeId) => {
  const s = ensure(state)
  const id = Number(nodeId)
  return withStructure(state, {
    nodes: s.nodes.filter((n) => n.id !== id),
    elements: s.elements.filter((e) => e.iNode !== id && e.jNode !== id),
    restraints: s.restraints.filter((r) => r.nodeId !== id),
    loads: Object.assign({}, s.loads, {
      nodal: (s.loads.nodal || []).filter((l) => l.nodeId !== id)
    })
  })
}

const updateNode = (state, { id, x, y, z }) => {
  const s = ensure(state)
  return withStructure(state, {
    nodes: s.nodes.map((n) => (n.id === id
      ? { id, x: Number(x), y: Number(y), z: Number(z) }
      : n))
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
  const id = s.nextElementId
  return withStructure(state, {
    elements: s.elements.concat([{
      id,
      iNode,
      jNode,
      matId: String((payload && payload.matId) || defs.matId),
      secId: String((payload && payload.secId) || defs.secId)
    }]),
    nextElementId: id + 1
  })
}

/** One atomic update: add node at (x,y,z) then element from iNode to that new node (fixes two cb() racing same base state). */
const addElementToNewNodeAt = (state, { x, y, z, iNode }) => {
  const s = ensure(state)
  const from = Number(iNode)
  if (!isFinite(from)) return state
  const jNode = s.nextNodeId
  if (from === jNode) return state
  const afterNode = addNodeAt(state, { x, y, z })
  return addElement(afterNode, { iNode: from, jNode })
}

const removeElement = (state, elementId) => {
  const s = ensure(state)
  const id = Number(elementId)
  return withStructure(state, {
    elements: s.elements.filter((e) => e.id !== id),
    releases: s.releases.filter((r) => r.elementId !== id),
    loads: Object.assign({}, s.loads, {
      distributed: (s.loads.distributed || []).filter((l) => l.elementId !== id)
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
      if (e.id !== rid) return e
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
  const end = (payload && (payload.end === 'start' || payload.end === 'end' || payload.end === 'both'))
    ? payload.end : 'both'
  if (!isFinite(elementId)) return state
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
  migrateFromTruss,
  addNode,
  addNodeAt,
  removeNode,
  updateNode,
  addElement,
  addElementToNewNodeAt,
  removeElement,
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
  runFemAnalysis
}
