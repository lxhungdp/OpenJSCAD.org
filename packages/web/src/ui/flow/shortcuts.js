const most = require('most')

const { head } = require('@jscad/array-utils')

const { holdUntil, withLatestFrom } = require('../../most-utils')

const { getKeyCombos, isKeyEventScopeValid } = require('../../utils/keys')
const { merge } = require('../../utils/utils')

// see data/keybindings.json for the initial bindings
// which are set as part of the initial state in index.js

const reducers = {
  initialize: (state) => state,
  // set all shortcuts
  setShortcuts: (state, newShortcuts) => {
    const shortcuts = merge([], state.shortcuts, newShortcuts)
    return { shortcuts }
  },
  triggerShortcut: (state, { event, compositeKey }) => {
    const matchingAction = head(state.shortcuts.filter((shortcut) => shortcut.key.toLowerCase() === compositeKey))
    if (matchingAction) {
      const { command, args } = matchingAction
      return { type: command, data: args }
    }
    return undefined
  },
  requestSaveSettings: (shortcuts) => shortcuts
}

// keyboard shortcut handling
const actions = ({ sources }) => {
  const initialize$ = most.just({})
    .thru(withLatestFrom(reducers.initialize, sources.state))
    .map((payload) => Object.assign({}, { type: 'initializeShortcuts', sink: 'state' }, { state: payload }))

  // set shortcuts
  const setShortcuts$ = most.mergeArray([
    sources.store
      .filter((reply) => reply.key === 'shortcuts' && reply.type === 'read' && reply.data && reply.data.shortcuts)
      .map((reply) => reply.data.shortcuts)
  ])
    .thru(withLatestFrom(reducers.setShortcuts, sources.state))
    .map((payload) => Object.assign({}, { type: 'setShortcuts', sink: 'state' }, { state: payload }))

  // to make sure the key event was fired in the scope of the current jscad instance
  const myKey = sources.dom.element.getAttribute('key')

  const keyUps$ = most.fromEvent('keyup', sources.dom.element)
    .filter((event) => isKeyEventScopeValid(myKey, event.target))
    .multicast()

  const keyDown$ = most.fromEvent('keydown', sources.dom.element)
    .filter((event) => isKeyEventScopeValid(myKey, event.target))
    .multicast()

  // we get all key combos, accepting repeated key strokes
  const keyCombos$ = getKeyCombos({ dropRepeats: false }, keyUps$, keyDown$)

  // we match key stroke combos to actions
  const triggerFromShortcut$ = keyCombos$
    .thru(withLatestFrom(reducers.triggerShortcut, sources.state))
    .filter((x) => x !== undefined)

  // this means we wait until the data here has been initialized before saving
  const requestLoadSettings$ = initialize$
    .map((_) => ({ sink: 'store', key: 'shortcuts', type: 'read' }))

  // starts emmiting to storage only AFTER initial settings have been loaded
  const requestSaveSettings$ = sources.state
    .filter((state) => state.shortcuts)
    .map((state) => state.shortcuts)
    .thru(holdUntil(sources.store.filter((reply) => reply.key === 'shortcuts' && reply.type === 'read')))
    .map(reducers.requestSaveSettings)
    .map((data) => Object.assign({}, { data }, { sink: 'store', key: 'shortcuts', type: 'write' }))
    .multicast()

  return {
    initialize$,
    setShortcuts$,
    triggerFromShortcut$,

    requestLoadSettings$,
    requestSaveSettings$
  }
}

module.exports = actions
