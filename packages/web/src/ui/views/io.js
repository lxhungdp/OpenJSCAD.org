const html = require('nanohtml')

const io = (state, i18n) => {
  const formatsList = state.io.availableExportFormats
    .map(({ name, displayName }) => {
      displayName = i18n.translate(displayName)
      const selected = state.io.exportFormat ? state.io.exportFormat.toLowerCase() === name.toLowerCase() : undefined
      return html`<option value=${name} selected='${selected}'>
      ${displayName}
    </option>`
    })

  const exportAvailable = state.io.availableExportFormats.length > 0

  return html`
  <div id='io' class='settings-io'>
    <div class='settings-row settings-row-project'>
      <div class="settings-project-load">
        <input type="file" value="${i18n`load project`}" id="fileLoader" multiple webkitdirectory mozdirectory msdirectory odirectory directory  />
        <label for="fileLoader" class="settings-file-label">${i18n`load project`}</label>
      </div>
      <div class="settings-project-autoreload settings-row-checkbox">
        <input type="checkbox" id="toggleAutoReload" checked=${state.design.autoReload}/>
        <label for="toggleAutoReload">${i18n`auto reload`}</label>
      </div>
    </div>
    <div class='settings-row settings-export-row' style='display:${exportAvailable ? 'flex' : 'none'}'>
      <select id='exportFormats' aria-label="Export format">
        ${formatsList}
      </select>
      <input type='button' value="${i18n`export`}" id="exportBtn"/>
    </div>
  </div>
    `
}

module.exports = io
