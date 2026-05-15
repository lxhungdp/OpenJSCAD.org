const html = require('nanohtml')
const {
  iconNode,
  iconElement,
  iconBoundaries,
  iconProperties,
  iconLoad
} = require('./structuresDockIcons')

const MENU_ENTRIES = [
  { modal: 'node', label: 'Nodes', icon: iconNode },
  { modal: 'element', label: 'Elements', icon: iconElement },
  { modal: 'boundaries', label: 'Boundaries', icon: iconBoundaries },
  { modal: 'properties', label: 'Properties', icon: iconProperties },
  { modal: 'load', label: 'Loads', icon: iconLoad }
]

const buildStructuresMenuButtons = (i18n) =>
  MENU_ENTRIES.map(({ modal, label, icon }) => html`
    <button type="button" class="structures-menu-item" role="menuitem"
      data-struct-modal="${modal}" title="${label}">
      <span class="structures-menu-item__icon" aria-hidden="true">${icon}</span>
      <span class="structures-menu-item__label">${label}</span>
    </button>`)

module.exports = { MENU_ENTRIES, buildStructuresMenuButtons }
