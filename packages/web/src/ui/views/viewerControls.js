const html = require('nanohtml')

const viewerControls = (state, i18n) => {
  const vm = (state.viewer.camera && state.viewer.camera.viewMode) || '3d'
  const btn = (id, label) => html`
    <button type="button" class="view-mode-btn ${vm === id ? 'view-mode-btn-active' : ''}" data-view-mode="${id}">${label}</button>
  `
  return html`
<div id='controls' class='settings-viewer'>
  <div class="settings-view-toolbar" role="group" aria-label="View projection">
    ${btn('3d', '3D')}
    ${btn('xy', 'X–Y')}
    ${btn('xz', 'X–Z')}
    ${btn('yz', 'Y–Z')}
  </div>
  <div class="settings-row settings-viewer-pair">
    <div class="settings-pair-cell settings-row-checkbox">
      <input type="checkbox" id="toggleGrid" checked=${state.viewer.grid.show} />
      <label for="toggleGrid">${i18n`grid`}</label>
    </div>
    <div class="settings-pair-cell settings-row-checkbox">
      <input type="checkbox" id="toggleAxes" checked=${state.viewer.axes.show} />
      <label for="toggleAxes">${i18n`axes`}</label>
    </div>
  </div>
  <div class="settings-row settings-viewer-pair">
    <div class="settings-pair-cell settings-row-checkbox">
      <input type="checkbox" id="toggleAutoRotate" checked=${state.viewer.rendering.autoRotate}/>
      <label for="toggleAutoRotate">${i18n`auto rotate`}</label>
    </div>
    <div class="settings-pair-cell settings-row-checkbox">
      <input type="checkbox" id="toggleAutoZoom" checked=${state.viewer.rendering.autoZoom}/>
      <label for="toggleAutoZoom">${i18n`auto zoom`}</label>
    </div>
  </div>
  <div class="settings-row settings-row-checkbox">
    <input type="checkbox" id="toggleDrawSnap" checked=${(state.viewer.drawing && state.viewer.drawing.snapEnabled) !== false} />
    <label for="toggleDrawSnap">Snap on (nodes, then grid in world units)</label>
  </div>
</div>`
}

module.exports = viewerControls
