const most = require('most')
const { withLatestFrom } = require('../../most-utils')
const selectionReducers = require('./viewerSelectionState')

const reduceOp = (state, op) => {
  if (!op || !op.op) return undefined
  switch (op.op) {
    case 'setSelectionMode':
      return selectionReducers.setSelectionMode(state, op.mode)
    case 'setSelection':
      return selectionReducers.setSelection(state, op)
    case 'clearSelection':
      return selectionReducers.clearSelection(state)
    default:
      return undefined
  }
}

const resolveSelectionToolbarClick = (state) => {
  const cur = (state.viewer && state.viewer.selection && state.viewer.selection.mode) || 'none'
  const next = cur === 'select' ? 'none' : 'select'
  return selectionReducers.setSelectionMode(state, next)
}

const actions = ({ sources }) => {
  const viewerUi$ = sources.viewerUiInteraction
    .thru(withLatestFrom((state, op) => reduceOp(state, op), sources.state))
    .filter((data) => data !== undefined)
    .map((data) => ({ type: 'viewerUiCommand', state: data, sink: 'state' }))

  const toggleSelectionMode$ = most.mergeArray([
    sources.dom.select('.selection-mode-btn').events('click')
  ])
    .thru(withLatestFrom(resolveSelectionToolbarClick, sources.state))
    .map((data) => ({ type: 'toggleSelectionMode', state: data, sink: 'state' }))

  return { viewerUi$, toggleSelectionMode$ }
}

module.exports = actions
