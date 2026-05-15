const html = require('nanohtml')

const dom = (state, i18n, paramsCallbacktoStream, editorCallbackToStream, trussCallbacktoStream) => {
  const i18nFake = (x) => x
  i18nFake.translate = (x) => x
  i18n = i18n || i18nFake

  const options = require('./options')(state, i18n)
  const parameters = require('./designParameters')(state, paramsCallbacktoStream, i18n)
  const status = require('./status')(state, i18n)
  const help = require('./help')(state, i18n)

  const editor = require('./editor').editorWrapper(state, editorCallbackToStream, i18n)
  const toolBar = require('./toolbar')(state, i18n)

  const viewer = require('./viewer')(state, i18n)

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

    <!--Viewer + screen-space truss overlay-->
    <div id="viewerStack">
      ${viewer}
      <svg id="trussOverlay" xmlns="http://www.w3.org/2000/svg" class="truss-overlay" aria-hidden="true"></svg>
    </div>

    <!--Params-->
    ${parameters}
    <!-- Options Popup -->
    ${options}
    <!-- Editor Popup -->
    ${state.activeTool === 'editor' ? editor : ''}
    <!-- Help Popup -->
    ${help}
    <!-- Truss editor -->
    ${require('./trussPanel')(state, i18n, trussCallbacktoStream)}

  </div>
  `

  return output
}

module.exports = dom
