const html = require('nanohtml')

/** Toolbar-sized icons (separate nodes so nanohtml does not reuse one instance twice). */
const iconDrawNode = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`
const iconDrawElement = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>`

const toolbar = (state, i18n) => {
  const optionsIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-settings"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  const editorIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-3"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"/><line x1="3" y1="22" x2="21" y2="22"/></svg>`
  const helpIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-help-circle"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg>`

  /** Three nodes: apex at top, base along bottom (connected triangle). */
  const structuresIcon = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 5L5 19M12 5l7 14M5 19h14"/></svg>`

  const drawMode = (state.viewer && state.viewer.drawing && state.viewer.drawing.mode) || 'none'
  const drawingActiveClass = drawMode !== 'none' ? ' toolbar-drawing-active' : ''
  const nodeOn = drawMode === 'node'
  const elementOn = drawMode === 'element'
  const selMode = (state.viewer && state.viewer.selection && state.viewer.selection.mode) || 'none'
  const selectOn = selMode === 'select'
  const structuresActiveClass = state.activeTool === 'structures' ? ' toolbar-btn-active' : ''
  const displayActiveClass = state.activeTool === 'display' ? ' toolbar-btn-active' : ''
  const optionsActiveClass = state.activeTool === 'options' ? ' toolbar-btn-active' : ''
  const { iconDisplayToolbar } = require('./structures/structuresDockIcons')

  const iconSelect = () => html`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke-dasharray="3 2"/></svg>`

  return html`<span id='toolbar'>
        <div class="toolbar-drawing-group${drawingActiveClass}" role="group" aria-label="${i18n`Drawing`}">
          <button type="button" id="toolbarDrawNode" class="toolbar-drawing-seg drawing-mode-btn${nodeOn ? ' toolbar-drawing-seg--on' : ''}"
            data-drawing-mode="node" role="switch" aria-checked="${nodeOn ? 'true' : 'false'}" title="${i18n`Draw nodes`}" aria-label="${i18n`Draw nodes`}">
            ${iconDrawNode()}
          </button>
          <button type="button" id="toolbarDrawElement" class="toolbar-drawing-seg drawing-mode-btn${elementOn ? ' toolbar-drawing-seg--on' : ''}"
            data-drawing-mode="element" role="switch" aria-checked="${elementOn ? 'true' : 'false'}" title="${i18n`Draw elements`}" aria-label="${i18n`Draw elements`}">
            ${iconDrawElement()}
          </button>
          <button type="button" class="drawing-mode-btn toolbar-drawing-sr-only" data-drawing-mode="none" tabindex="-1" aria-hidden="true">${i18n`Navigate`}</button>
        </div>
        <button type="button" id="toolbarSelect" class="toolbar-select-btn selection-mode-btn${selectOn ? ' toolbar-select-btn--on' : ''}"
          title="${i18n`Select nodes and elements`}" aria-label="${i18n`Select`}" aria-pressed="${selectOn ? 'true' : 'false'}">
          ${iconSelect()}
        </button>
        <button id='toggleOptions' class="${optionsActiveClass}" aria-label='options'>
          ${optionsIcon}
        </button>
        <button id='toggleEditor' aria-label='editor'>
          ${editorIcon}
        </button>
        <button id='toggleStructures' class="${structuresActiveClass}" aria-label='structures'>
          ${structuresIcon}
        </button>
        <button id='toggleDisplay' class="${displayActiveClass}" aria-label='display'>
          ${iconDisplayToolbar}
        </button>
        <button id='toggleHelp' aria-label='help'>
          ${helpIcon}
        </button>
      </span>`
}

module.exports = toolbar
