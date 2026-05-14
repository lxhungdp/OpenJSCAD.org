const { withLatestFrom } = require('../../most-utils')
const reducers = require('./trussReducers')

const reduceTrussOp = (state, op) => {
  if (!op || !op.op) return undefined
  switch (op.op) {
    case 'addNode':
      return reducers.addNode(state)
    case 'addElement':
      return reducers.addElement(state)
    case 'removeNode':
      return reducers.removeNode(state, op.nodeId)
    case 'removeElement':
      return reducers.removeElement(state, op.elementId)
    case 'updateNode':
      return reducers.updateNode(state, op.payload)
    case 'updateElement':
      return reducers.updateElement(state, op.payload)
    case 'setShow3dMembers':
      return reducers.setShow3dMembers(state, op.value)
    case 'setSectionType':
      return reducers.setSectionType(state, op.value)
    case 'setSectionB':
      return reducers.setSectionB(state, op.value)
    case 'setSectionH':
      return reducers.setSectionH(state, op.value)
    case 'setSectionRadius':
      return reducers.setSectionRadius(state, op.value)
    default:
      return undefined
  }
}

const actions = ({ sources }) => {
  const trussCommand$ = sources.trussInteraction
    .thru(withLatestFrom((state, op) => reduceTrussOp(state, op), sources.state))
    .filter((data) => data !== undefined)
    .map((data) => ({ type: 'trussCommand', state: data, sink: 'state' }))

  return { trussCommand$ }
}

module.exports = actions
