const html = require('nanohtml')
const attachHandlers = require('./structures/structuresHandlers')
const { buildStructuresModal } = require('./structures/structuresModalContent')
const { getStructuresModalLayer } = require('./structures/structuresModalLayer')
const { buildStructuresMenuButtons } = require('./structures/structuresMenuEntries')

const syncStructuresModal = (state, i18n, ctl) => {
  const layer = getStructuresModalLayer()
  const modal = state.structure && state.structure.structuresModal
  if (!modal) {
    if (layer.firstChild) layer.innerHTML = ''
    return
  }

  const el = buildStructuresModal(state, i18n, modal)
  layer.innerHTML = ''
  layer.appendChild(el)
  attachHandlers(el, ctl)
}

const structuresPanel = (state, i18n, structureCallbacktoStream) => {
  const visible = state.activeTool === 'structures'
  const secColor = state.themes && state.themes.themeSettings
    ? state.themes.themeSettings.secondaryTextColor
    : '#333'
  const menuItems = buildStructuresMenuButtons(i18n)
  const fem = state.femResult
  const femStatus = fem
    ? (fem.ok
      ? `Last analysis: OK — max |u| ≈ ${fem.maxDisp.toExponential(3)} (${fem.nodeCount} nodes, ${fem.elementCount} elements)`
      : `Last analysis: failed — ${fem.error}`)
    : 'No analysis run yet.'

  const panel = html`
    <section id="structures-menu" class="popup-menu structures-menu-panel"
      style="visibility:${visible ? 'visible' : 'hidden'}; color:${secColor}">
      <h3>${i18n`Structures`}</h3>
      <p class="structures-menu-hint">${i18n`3D frame, 6 DOF/node. Edit model below, then run analysis.`}</p>
      <button type="button" class="structures-menu-analyze" data-struct-op="runFemAnalysis">${i18n`Run FEM analysis`}</button>
      <p class="structures-fem-status" aria-live="polite">${femStatus}</p>
      <nav class="structures-menu-list" role="menu" aria-label="Structures">
        ${menuItems}
      </nav>
    </section>`

  attachHandlers(panel, structureCallbacktoStream)
  syncStructuresModal(state, i18n, structureCallbacktoStream)
  return panel
}

module.exports = structuresPanel
