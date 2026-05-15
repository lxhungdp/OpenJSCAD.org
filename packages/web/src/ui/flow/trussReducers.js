const defaultTruss = () => ({
  nodes: [],
  elements: [],
  nextNodeId: 1,
  nextElementId: 1,
  show3dMembers: false,
  sectionType: 'rect', // 'rect' | 'square' | 'circle' | 'i'
  sectionB: 2,
  sectionH: 2,
  sectionRadius: 1,
  sectionTf: 0.25,
  sectionTw: 0.2
})

const ensure = (state) => {
  if (!state.truss || typeof state.truss !== 'object') return defaultTruss()
  const t = Object.assign({}, defaultTruss(), state.truss)
  if (t.nextNodeId == null && t.nodes && t.nodes.length) {
    t.nextNodeId = Math.max(...t.nodes.map((n) => n.id)) + 1
  }
  if (t.nextElementId == null && t.elements && t.elements.length) {
    t.nextElementId = Math.max(...t.elements.map((e) => e.id)) + 1
  }
  return t
}

const withTruss = (state, next) => Object.assign({}, state, { truss: Object.assign({}, ensure(state), next) })

const addNode = (state) => {
  const t = ensure(state)
  const id = t.nextNodeId
  return withTruss(state, {
    nodes: t.nodes.concat([{ id, x: 0, y: 0, z: 0 }]),
    nextNodeId: id + 1
  })
}

const addNodeAt = (state, { x, y, z }) => {
  const t = ensure(state)
  const id = t.nextNodeId
  const xi = isFinite(Number(x)) ? Number(x) : 0
  const yi = isFinite(Number(y)) ? Number(y) : 0
  const zi = isFinite(Number(z)) ? Number(z) : 0
  return withTruss(state, {
    nodes: t.nodes.concat([{ id, x: xi, y: yi, z: zi }]),
    nextNodeId: id + 1
  })
}

const removeNode = (state, nodeId) => {
  const t = ensure(state)
  const id = Number(nodeId)
  return withTruss(state, {
    nodes: t.nodes.filter((n) => n.id !== id),
    elements: t.elements.filter((e) => e.startId !== id && e.endId !== id)
  })
}

const updateNode = (state, { id, x, y, z }) => {
  const t = ensure(state)
  const xi = isFinite(Number(x)) ? Number(x) : 0
  const yi = isFinite(Number(y)) ? Number(y) : 0
  const zi = isFinite(Number(z)) ? Number(z) : 0
  return withTruss(state, {
    nodes: t.nodes.map((n) => (n.id === id ? { id, x: xi, y: yi, z: zi } : n))
  })
}

const addElement = (state, payload) => {
  const t = ensure(state)
  let startId = t.nodes[0] ? t.nodes[0].id : 1
  let endId = t.nodes[1] ? t.nodes[1].id : startId
  if (payload && payload.startId != null && payload.endId != null) {
    startId = Number(payload.startId)
    endId = Number(payload.endId)
  }
  if (!isFinite(startId) || !isFinite(endId)) {
    startId = t.nodes[0] ? t.nodes[0].id : 1
    endId = t.nodes[1] ? t.nodes[1].id : startId
  }
  if (startId === endId) return state
  const id = t.nextElementId
  return withTruss(state, {
    elements: t.elements.concat([{ id, startId, endId }]),
    nextElementId: id + 1
  })
}

const removeElement = (state, elementId) => {
  const t = ensure(state)
  const rid = Number(elementId)
  return withTruss(state, {
    elements: t.elements.filter((e) => e.id !== rid)
  })
}

const updateElement = (state, { id, startId, endId }) => {
  const t = ensure(state)
  const rid = Number(id)
  const si = isFinite(Number(startId)) ? Number(startId) : (t.nodes[0] && t.nodes[0].id) || 1
  const ei = isFinite(Number(endId)) ? Number(endId) : si
  return withTruss(state, {
    elements: t.elements.map((e) => (e.id === rid ? { id: e.id, startId: si, endId: ei } : e))
  })
}

const setShow3dMembers = (state, value) => withTruss(state, { show3dMembers: !!value })

const setSectionType = (state, value) => {
  const v = (value === 'square' || value === 'circle' || value === 'rect' || value === 'i') ? value : 'rect'
  return withTruss(state, { sectionType: v })
}

const setSectionB = (state, value) => {
  const n = isFinite(Number(value)) ? Number(value) : 2
  return withTruss(state, { sectionB: Math.max(1e-3, n) })
}

const setSectionH = (state, value) => {
  const n = isFinite(Number(value)) ? Number(value) : 2
  return withTruss(state, { sectionH: Math.max(1e-3, n) })
}

const setSectionRadius = (state, value) => {
  const n = isFinite(Number(value)) ? Number(value) : 1
  return withTruss(state, { sectionRadius: Math.max(1e-3, n) })
}

const setSectionTf = (state, value) => {
  const n = isFinite(Number(value)) ? Number(value) : 0.25
  return withTruss(state, { sectionTf: Math.max(1e-3, n) })
}

const setSectionTw = (state, value) => {
  const n = isFinite(Number(value)) ? Number(value) : 0.2
  return withTruss(state, { sectionTw: Math.max(1e-3, n) })
}

module.exports = {
  addNode,
  addNodeAt,
  removeNode,
  updateNode,
  addElement,
  removeElement,
  updateElement,
  setShow3dMembers,
  setSectionType,
  setSectionB,
  setSectionH,
  setSectionRadius,
  setSectionTf,
  setSectionTw
}
