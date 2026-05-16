const html = require('nanohtml')
const attachHandlers = require('./structures/structuresHandlers')

const displayPanel = (state, i18n, structureCallbacktoStream) => {
  const visible = state.activeTool === 'display'
  const secColor = state.themes && state.themes.themeSettings
    ? state.themes.themeSettings.secondaryTextColor
    : '#333'
  const d = (state.viewer && state.viewer.drawing) || {}
  const s = state.structure || {}
  const show3d = !!s.show3dMembers
  const vm = (state.viewer.camera && state.viewer.camera.viewMode) || '3d'
  const viewBtn = (id, label) => html`
    <button type="button" class="view-mode-btn ${vm === id ? 'view-mode-btn-active' : ''}" data-view-mode="${id}">${label}</button>
  `

  const panel = html`
    <section id="display-menu" class="popup-menu structures-menu-panel display-menu-panel"
      style="visibility:${visible ? 'visible' : 'hidden'}; color:${secColor}">
      <h3>${i18n`Display`}</h3>
      <nav class="structures-menu-list display-menu-list" role="menu" aria-label="${i18n`Display`}">
        <div class="display-view-toolbar" role="group" aria-label="View projection">
          ${viewBtn('3d', '3D')}
          ${viewBtn('xy', 'X–Y')}
          ${viewBtn('xz', 'X–Z')}
          ${viewBtn('yz', 'Y–Z')}
        </div>
        <div class="display-menu-row display-menu-row--visibility" role="group" aria-label="Grid and axes">
          <label class="structures-menu-item structures-menu-item--check">
            <input type="checkbox" id="toggleGrid" checked=${state.viewer.grid.show} />
            <span>${i18n`grid`}</span>
          </label>
          <label class="structures-menu-item structures-menu-item--check">
            <input type="checkbox" id="toggleAxes" checked=${state.viewer.axes.show} />
            <span>${i18n`axes`}</span>
          </label>
        </div>
        <div class="display-menu-divider" role="presentation"></div>
        <div class="display-menu-row" role="group" aria-label="Identifiers">
          <label class="structures-menu-item structures-menu-item--check"><input type="checkbox" id="displayShowNodeIds" checked=${!!d.showNodeIds} /> <span>${i18n`Node Id`}</span></label>
          <label class="structures-menu-item structures-menu-item--check"><input type="checkbox" id="displayShowElementIds" checked=${!!d.showElementIds} /> <span>${i18n`Element Id`}</span></label>
        </div>
        <div class="display-menu-row" role="group" aria-label="Section and material">
          <label class="structures-menu-item structures-menu-item--check"><input type="checkbox" id="displayShowSecId" checked=${!!d.showSecId} /> <span>${i18n`Sec Id`}</span></label>
          <label class="structures-menu-item structures-menu-item--check"><input type="checkbox" id="displayShowMatId" checked=${!!d.showMatId} /> <span>${i18n`Mat Id`}</span></label>
        </div>
        <div class="display-menu-row" role="group" aria-label="Boundaries">
          <label class="structures-menu-item structures-menu-item--check"><input type="checkbox" id="displayShowRestraints" checked=${d.showRestraints !== false} /> <span>${i18n`Restraints`}</span></label>
          <label class="structures-menu-item structures-menu-item--check"><input type="checkbox" id="displayShowReleased" checked=${d.showReleased !== false} /> <span>${i18n`Released`}</span></label>
        </div>
        <div class="display-menu-divider" role="presentation"></div>
        <label class="structures-menu-item structures-menu-item--check display-menu-item-full">
          <input type="checkbox" id="displayShow3dMembers" checked=${show3d} />
          <span>${i18n`Show 3D members (solid bars)`}</span>
        </label>
      </nav>
    </section>`

  attachHandlers(panel, structureCallbacktoStream)
  return panel
}

module.exports = displayPanel
