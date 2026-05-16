const { withLatestFrom } = require('../../most-utils')
const reducers = require('./structureReducers')

const reduceStructureOp = (state, op) => {
  if (!op || !op.op) return undefined
  const debug = typeof window !== 'undefined' && window.__SEL_PROPS_DEBUG
  switch (op.op) {
    case 'addNode':
      return reducers.addNode(state)
    case 'addNodeAt':
      return reducers.addNodeAt(state, op.payload)
    case 'addElement':
      return reducers.addElement(state, op.payload)
    case 'addElementToNewNodeAt':
      return reducers.addElementToNewNodeAt(state, op.payload)
    case 'removeNode':
      return reducers.removeNode(state, op.nodeId)
    case 'removeNodesBatch':
      return reducers.removeNodesBatch(state, op.payload)
    case 'removeElement':
      return reducers.removeElement(state, op.elementId)
    case 'removeElementsBatch':
      return reducers.removeElementsBatch(state, op.payload)
    case 'updateNode': {
      const next = reducers.updateNode(state, op.payload)
      if (debug) {
        const nid = op.payload && op.payload.id
        const before = (state.structure && state.structure.nodes || []).find((n) => Number(n.id) === Number(nid))
        const after = (next.structure && next.structure.nodes || []).find((n) => Number(n.id) === Number(nid))
        console.log('[structure flow] updateNode', {
          payload: op.payload,
          before: before ? { x: before.x, y: before.y, z: before.z } : null,
          after: after ? { x: after.x, y: after.y, z: after.z } : null,
          stateUnchanged: next === state
        })
      }
      if (next === state) {
        console.warn('[structure flow] updateNode had no effect — id mismatch?', op.payload, {
          nodeIdsInModel: (state.structure && state.structure.nodes || []).map((n) => n.id)
        })
      }
      return next
    }
    case 'updateNodesBatch':
      return reducers.updateNodesBatch(state, op.payload)
    case 'updateElement':
      return reducers.updateElement(state, op.payload)
    case 'addMaterial':
      return reducers.addMaterial(state)
    case 'removeMaterial':
      return reducers.removeMaterial(state, op.matId)
    case 'updateMaterial':
      return reducers.updateMaterial(state, op.payload)
    case 'addSection':
      return reducers.addSection(state)
    case 'removeSection':
      return reducers.removeSection(state, op.secId)
    case 'updateSection':
      return reducers.updateSection(state, op.payload)
    case 'addRestraint':
      return reducers.addRestraint(state, op.payload)
    case 'removeRestraint':
      return reducers.removeRestraint(state, op.id)
    case 'updateRestraint':
      return reducers.updateRestraint(state, op.payload)
    case 'addRelease':
      return reducers.addRelease(state, op.payload)
    case 'removeRelease':
      return reducers.removeRelease(state, op.id)
    case 'addNodalLoad':
      return reducers.addNodalLoad(state, op.payload)
    case 'removeNodalLoad':
      return reducers.removeNodalLoad(state, op.id)
    case 'updateNodalLoad':
      return reducers.updateNodalLoad(state, op.payload)
    case 'addDistributedLoad':
      return reducers.addDistributedLoad(state, op.payload)
    case 'removeDistributedLoad':
      return reducers.removeDistributedLoad(state, op.id)
    case 'updateDistributedLoad':
      return reducers.updateDistributedLoad(state, op.payload)
    case 'setShow3dMembers':
      return reducers.setShow3dMembers(state, op.value)
    case 'setStructuresModal':
      return reducers.setStructuresModal(state, op.modal)
    case 'setStructuresView':
      return reducers.setStructuresView(state, op.view)
    case 'setBoundariesTab':
      return reducers.setBoundariesTab(state, op.tab)
    case 'setPropertiesTab':
      return reducers.setPropertiesTab(state, op.tab)
    case 'replaceStructure':
      return reducers.replaceStructure(state, op.structure)
    case 'applySelectionPanel':
      return reducers.applySelectionPanel(state, op.payload)
    case 'spacingPatternFromAnchors':
      return reducers.spacingPatternFromAnchors(state, op.payload)
    case 'spacingPatternFromElements':
      return reducers.spacingPatternFromElements(state, op.payload)
    case 'runFemAnalysis':
      return reducers.runFemAnalysis(state)
    default:
      return undefined
  }
}

const actions = ({ sources }) => {
  const structureInteraction = sources.structureInteraction || sources.trussInteraction
  const structureCommand$ = structureInteraction
    .thru(withLatestFrom((state, op) => reduceStructureOp(state, op), sources.state))
    .filter((data) => {
      if (data === undefined && typeof window !== 'undefined' && window.__SEL_PROPS_DEBUG) {
        console.warn('[structure flow] op produced undefined (unknown op or no-op)')
      }
      return data !== undefined
    })
    .map((data) => ({ type: 'structureCommand', state: data, sink: 'state' }))

  return { structureCommand$ }
}

module.exports = actions
