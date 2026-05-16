const html = require('nanohtml')

const dom = (state, i18n, paramsCallbacktoStream, editorCallbackToStream, structureCallbacktoStream, viewerUiCallbacktoStream) => {
  const i18nFake = (x) => x
  i18nFake.translate = (x) => x
  i18n = i18n || i18nFake

  const options = require('./options')(state, i18n)
  const parameters = require('./designParameters')(state, paramsCallbacktoStream, i18n)
  const status = require('./status')(state, i18n)
  const help = require('./help')(state, i18n)

  const editor = require('./editor').editorWrapper(state, editorCallbackToStream, i18n)
  const toolBar = require('./toolbar')(state, i18n)

  const viewer = require('./viewer')(state, i18n, structureCallbacktoStream, viewerUiCallbacktoStream)
  const selectionPropertiesPanel = require('./selectionPropertiesPanel')(state, i18n, structureCallbacktoStream, viewerUiCallbacktoStream)

  if (state.themes && state.themes.themeSettings) {
    // set the global CSS variables (theme)
    const { mainTextColor, secondaryTextColor } = state.themes.themeSettings
    const bodyEL = document.body
    bodyEL.style.setProperty('--main-text-color', `${mainTextColor}`)
    bodyEL.style.setProperty('--secondary-text-color', `${secondaryTextColor}`)
  }

  const output = html`
  <div id='container'>
    <div id='header'></div>

    ${toolBar}

    <!--Status information/errors-->
    ${status}

    <!-- Viewer + compact selection properties (right rail) -->
    <div class="view-area">
      <div id="viewerStack" class="viewer-stack">
        ${viewer}
        <svg id="trussOverlay" xmlns="http://www.w3.org/2000/svg" class="truss-overlay" aria-hidden="true"></svg>
      </div>
      <aside class="selection-props-rail" aria-label="${i18n`Selection properties`}">
        ${selectionPropertiesPanel}
      </aside>
    </div>

    <!--Params-->
    ${parameters}
    <!-- Options Popup -->
    ${options}
    <!-- Editor Popup -->
    ${state.activeTool === 'editor' ? editor : ''}
    <!-- Help Popup -->
    ${help}
    <!-- Structures menu (like Settings) -->
    ${require('./structuresPanel')(state, i18n, structureCallbacktoStream)}
    <!-- Display overlay / 3D options (like Settings) -->
    ${require('./displayPanel')(state, i18n, structureCallbacktoStream)}

  </div>
  `

  return output
}

module.exports = dom
