const html = require('nanohtml')

const options = (state, i18n) => {
  const io = require('./io')(state, i18n)
  const viewerControls = require('./viewerControls')(state, i18n)

  const themes = Object.entries(state.themes.available).map((theme) => {
    const value = theme[0]
    const name = theme[1].name
    const selected = state.themes.active === value
    return html`<option value='${value}' selected=${selected}>${name}</option>`
  })

  return html`
  <section
    class="popup-menu jscad-settings"
    id='options'
    style='visibility:${state.activeTool === 'options' ? 'visible' : 'hidden'}; color:${state.themes.themeSettings.secondaryTextColor}'
  >
    <fieldset class="settings-fieldset">
      <legend class="settings-legend">Project</legend>
      ${io}
    </fieldset>

    <fieldset class="settings-fieldset">
      <legend class="settings-legend">Viewer</legend>
      ${viewerControls}
    </fieldset>

    <fieldset class="settings-fieldset">
      <legend class="settings-legend">${i18n`Themes`}</legend>
      <div class="settings-theme-row">
        <select id='themeSwitcher' aria-label="${i18n`Themes`}">${themes}</select>
      </div>
    </fieldset>

    <fieldset class="settings-fieldset">
      <legend class="settings-legend">${i18n`Generation`}</legend>
      <div class="settings-generation-row">
        <label class="settings-timeout-label">${i18n`timeout for generation`}
          <input id='solidsTimeout' type='number' min=0 max=200000 value=${state.design.solidsTimeOut} />
        </label>
      </div>
    </fieldset>
  </section>`
}

module.exports = options
