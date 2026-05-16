const { ensure } = require('../flow/structureReducers')

let latestAppState = null

const registerAppStateForExport = (state) => {
  latestAppState = state
}

/** Full FEM model (nodes, elements, …) — same source as viewer overlay. */
const getLiveStructure = () => ensure(latestAppState || {})

module.exports = {
  registerAppStateForExport,
  getLiveStructure
}
