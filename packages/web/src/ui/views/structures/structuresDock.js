const html = require('nanohtml')
const {
  iconStructures,
  iconNode,
  iconElement,
  iconBoundaries,
  iconProperties,
  iconLoad,
  iconDisplay
} = require('./structuresDockIcons')

const FLYOUT_ENTRIES = [
  { modal: 'node', label: 'Node', icon: iconNode },
  { modal: 'element', label: 'Element', icon: iconElement },
  { modal: 'boundaries', label: 'Boundaries', icon: iconBoundaries },
  { modal: 'properties', label: 'Properties', icon: iconProperties },
  { modal: 'load', label: 'Loads', icon: iconLoad },
  { modal: 'display', label: 'Display', icon: iconDisplay }
]

const buildStructuresDock = (state, i18n) => {
  const visible = state.activeTool === 'structures'
  const entries = FLYOUT_ENTRIES.map(({ modal, label, icon }) => html`
    <button type="button" class="structures-dock__entry" role="menuitem"
      data-struct-modal="${modal}" title="${label}" aria-label="${label}">
      <span class="structures-dock__entry-icon">${icon}</span>
      <span class="structures-dock__entry-label">${label}</span>
    </button>`)

  return html`
    <div id="structures-dock" class="structures-dock"
      style="visibility:${visible ? 'visible' : 'hidden'}; pointer-events:${visible ? 'auto' : 'none'}">
      <div class="structures-dock__bar">
        <div class="structures-dock__group">
          <button type="button" class="structures-dock__trigger" aria-haspopup="true" aria-expanded="false">
            <span class="structures-dock__trigger-icon">${iconStructures}</span>
            <span class="structures-dock__trigger-label">${i18n`Structures`}</span>
          </button>
          <div class="structures-dock__panel" role="menu" aria-label="Structures">
            <div class="structures-dock__panel-inner">
              <div class="structures-dock__entries">${entries}</div>
            </div>
          </div>
        </div>
      </div>
    </div>`
}

module.exports = buildStructuresDock
