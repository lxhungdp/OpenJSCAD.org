const { withLatestFrom } = require('../../most-utils')
const reducers = require('./structureReducers')

const reduceStructureOp = (state, op) => {
  if (!op || !op.op) return undefined
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
    case 'removeElement':
      return reducers.removeElement(state, op.elementId)
    case 'updateNode':
      return reducers.updateNode(state, op.payload)
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
    .filter((data) => data !== undefined)
    .map((data) => ({ type: 'structureCommand', state: data, sink: 'state' }))

  return { structureCommand$ }
}

module.exports = actions
