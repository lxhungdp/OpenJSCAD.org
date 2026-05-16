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

  let el
  try {
    el = buildStructuresModal(state, i18n, modal)
  } catch (err) {
    console.error('[structures modal]', err)
    return
  }
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
      <button type="button" class="structures-menu-analyze" data-struct-op="runFemAnalysis">${i18n`Run FEM analysis`}</button>
      <p class="structures-fem-status" aria-live="polite">${femStatus}</p>
      <nav class="structures-menu-list" role="menu" aria-label="Structures">
        ${menuItems}
      </nav>
      <div class="structures-menu-file" aria-label="Model file">
        <button type="button" class="structures-menu-item structures-menu-item--file" data-struct-export>
          <span class="structures-menu-item__label">${i18n`Export JSON`}</span>
        </button>
        <button type="button" class="structures-menu-item structures-menu-item--file" data-struct-import>
          <span class="structures-menu-item__label">${i18n`Import JSON`}</span>
        </button>
        <button type="button" class="structures-menu-item structures-menu-item--file structures-menu-item--danger" data-struct-clear-all>
          <span class="structures-menu-item__label">${i18n`Clear all`}</span>
        </button>
        <div class="structures-clear-confirm" data-struct-clear-panel hidden>
          <p class="structures-clear-confirm__text">${i18n`Clear entire model? This cannot be undone.`}</p>
          <div class="structures-clear-confirm__actions">
            <button type="button" class="structures-clear-confirm__btn structures-clear-confirm__btn--danger" data-struct-clear-confirm>${i18n`Confirm`}</button>
            <button type="button" class="structures-clear-confirm__btn" data-struct-clear-cancel>${i18n`Cancel`}</button>
          </div>
        </div>
      </div>
    </section>`

  attachHandlers(panel, structureCallbacktoStream)
  syncStructuresModal(state, i18n, structureCallbacktoStream)
  return panel
}

module.exports = structuresPanel
