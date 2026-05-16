const html = require('nanohtml')

/** Viewer settings in Options: grid spacing / snap only (view + grid visibility live in Display menu). */
const viewerControls = (state, i18n) => {
  const g = (state.viewer && state.viewer.grid) || {}
  const minorStep = (typeof g.minorStep === 'number' && g.minorStep > 0) ? g.minorStep : 1
  const majorStep = (typeof g.majorStep === 'number' && g.majorStep > 0) ? g.majorStep : 10
  const sizeX = (Array.isArray(g.size) && g.size[0] > 0) ? g.size[0] : 200
  const sizeY = (Array.isArray(g.size) && g.size[1] > 0) ? g.size[1] : 200
  return html`
<div id='controls' class='settings-viewer'>
  <div class="settings-row settings-viewer-grid-fields" role="group" aria-label="Grid and snap spacing">
    <div class="settings-grid-field">
      <label for="gridMinorStep">Minor grid / snap (world)</label>
      <input type="number" id="gridMinorStep" min="1e-9" step="any" value=${minorStep} />
    </div>
    <div class="settings-grid-field">
      <label for="gridMajorStep">Major grid (world)</label>
      <input type="number" id="gridMajorStep" min="1e-9" step="any" value=${majorStep} />
    </div>
    <div class="settings-grid-field settings-grid-field-span">
      <span class="settings-grid-field-label">Grid range (world, X × Y; axis from −½ to +½)</span>
      <div class="settings-grid-size-pair">
        <input type="number" id="gridSizeX" min="1e-9" step="any" value=${sizeX} title="Extent along X" />
        <span class="settings-grid-size-mul">×</span>
        <input type="number" id="gridSizeY" min="1e-9" step="any" value=${sizeY} title="Extent along Y" />
      </div>
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
