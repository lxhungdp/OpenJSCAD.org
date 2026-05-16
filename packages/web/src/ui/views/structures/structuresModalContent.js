const html = require('nanohtml')
const defaultStructure = require('../../../core/structure/defaultStructure')
const { sectionToFemProps } = require('../../../core/structure/sectionToFemProps')

/** Safe one-line FEM summary for table cells (avoids throw on NaN/∞). */
const formatFemHint = (fem) => {
  if (!fem) return '—'
  const { area, momentInertiaY, momentInertiaZ } = fem
  const ok = [area, momentInertiaY, momentInertiaZ].every(
    (n) => typeof n === 'number' && Number.isFinite(n)
  )
  if (!ok) return '—'
  try {
    return `A=${area.toExponential(3)} Iy=${momentInertiaY.toExponential(3)} Iz=${momentInertiaZ.toExponential(3)}`
  } catch (e) {
    return '—'
  }
}

const {
  RESTRAINT_PRESET_OPTIONS,
  inferPresetFromDofs,
  restraintDofs
} = require('../../restraints/restraintDofs')

const DOF_LABELS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz']

const MODAL_TITLES = {
  node: 'Nodes',
  element: 'Elements',
  boundaries: 'Boundaries',
  properties: 'Properties',
  load: 'Loads'
}

const tableShell = (theadRow, tbody) => html`
  <div class="structures-modal-table-scroll">
    <table class="struct-table structures-modal-table">
      <thead><tr>${theadRow}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>`

const buildNodeBody = (s, i18n) => {
  const nodeRows = s.nodes.map((n) => html`
    <tr data-node-id="${n.id}">
      <td>${n.id}</td>
      <td><input type="number" step="any" class="struct-node-in structures-modal-field" data-axis="x" value="${n.x}" /></td>
      <td><input type="number" step="any" class="struct-node-in structures-modal-field" data-axis="y" value="${n.y}" /></td>
      <td><input type="number" step="any" class="struct-node-in structures-modal-field" data-axis="z" value="${n.z}" /></td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-node structures-modal-icon-btn" data-node-id="${n.id}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`)
  const head = html`
    <th>id</th><th>X</th><th>Y</th><th>Z</th><th class="structures-modal-actions-col"></th>`
  return html`
    <div class="structures-modal-body">
      ${tableShell(head, nodeRows)}
      <button type="button" class="structures-modal-action" data-struct-op="addNode">${i18n`Add node`}</button>
    </div>`
}

const buildElementBody = (s, i18n) => {
  const elemRows = s.elements.map((e) => {
    const matOpts = s.materials.map((m) =>
      html`<option value="${m.matId}" selected=${m.matId === e.matId}>${m.matId}</option>`)
    const secOpts = s.sections.map((x) =>
      html`<option value="${x.secId}" selected=${x.secId === e.secId}>${x.secId}</option>`)
    return html`
    <tr data-element-id="${e.id}">
      <td>${e.id}</td>
      <td><input type="number" class="struct-elem-in structures-modal-field" data-k="iNode" value="${e.iNode}" /></td>
      <td><input type="number" class="struct-elem-in structures-modal-field" data-k="jNode" value="${e.jNode}" /></td>
      <td><select class="struct-elem-in structures-modal-field structures-modal-select" data-k="matId">${matOpts}</select></td>
      <td><select class="struct-elem-in structures-modal-field structures-modal-select" data-k="secId">${secOpts}</select></td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-element structures-modal-icon-btn" data-element-id="${e.id}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`
  })
  const head = html`
    <th>id</th><th>i</th><th>j</th><th>mat</th><th>sec</th><th class="structures-modal-actions-col"></th>`
  return html`
    <div class="structures-modal-body">
      ${tableShell(head, elemRows)}
      <button type="button" class="structures-modal-action" data-struct-op="addElement">${i18n`Add element`}</button>
    </div>`
}

const buildBoundariesBody = (s, i18n) => {
  const bTab = s.boundariesTab || 'restraint'
  const restraintRows = s.restraints.map((r) => {
    const dofs = restraintDofs(r) || [false, false, false, false, false, false]
    const effectivePreset = inferPresetFromDofs(dofs)
    const presetOpts = RESTRAINT_PRESET_OPTIONS.map((p) =>
      html`<option value="${p.value}" selected=${effectivePreset === p.value}>${p.label}</option>`)
    const dofCells = DOF_LABELS.map((label, i) => html`
      <td class="structures-modal-dof-cell">
        <input type="checkbox" class="struct-restraint-in structures-modal-checkbox" data-dof="${i}"
          checked=${dofs[i]} title="${label}" />
      </td>`)
    return html`
    <tr data-node-id="${r.nodeId}">
      <td>${r.id}</td>
      <td>${r.nodeId}</td>
      <td><select class="struct-restraint-in structures-modal-field structures-modal-select" data-k="preset">${presetOpts}</select></td>
      ${dofCells}
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-restraint structures-modal-icon-btn" data-id="${r.id}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`
  })
  const releaseRows = s.releases
    .filter((r) => r.end === 'start' || r.end === 'end' || r.end === 'both')
    .map((r) => html`
    <tr data-element-id="${r.elementId}" data-release-id="${r.id}">
      <td>${r.id}</td>
      <td>${r.elementId}</td>
      <td>
        <select class="struct-release-in structures-modal-field structures-modal-select" data-k="end">
          <option value="start" selected=${r.end === 'start'}>Start</option>
          <option value="end" selected=${r.end === 'end'}>End</option>
          <option value="both" selected=${r.end === 'both'}>Both</option>
        </select>
      </td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-release structures-modal-icon-btn" data-id="${r.id}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`)
  const restraintHead = html`
    <th>id</th><th>node</th><th>preset</th>
    ${DOF_LABELS.map((l) => html`<th class="structures-modal-dof-th" title="${l}">${l}</th>`)}
    <th class="structures-modal-actions-col"></th>`
  const releaseHead = html`
    <th>id</th><th>elem</th><th>end</th><th class="structures-modal-actions-col"></th>`
  return html`
    <div class="structures-modal-body">
      <div class="structures-modal-tabs" role="tablist">
        <button type="button" role="tab" class="structures-modal-tab${bTab === 'restraint' ? ' structures-modal-tab--active' : ''}"
          data-boundaries-tab="restraint">${i18n`Restraint`}</button>
        <button type="button" role="tab" class="structures-modal-tab${bTab === 'release' ? ' structures-modal-tab--active' : ''}"
          data-boundaries-tab="release">${i18n`Release`}</button>
      </div>
      <div class="structures-modal-tab-panel${bTab === 'restraint' ? '' : ' structures-modal-tab-panel--hidden'}" role="tabpanel">
        <p class="struct-hint structures-modal-hint">${i18n`true = fixed DOF. Preset overrides checkboxes when not Custom.`}</p>
        ${tableShell(restraintHead, restraintRows)}
        <button type="button" class="structures-modal-action" data-struct-op="addRestraint">${i18n`Add restraint`}</button>
      </div>
      <div class="structures-modal-tab-panel${bTab === 'release' ? '' : ' structures-modal-tab-panel--hidden'}" role="tabpanel">
        <p class="struct-hint structures-modal-hint">${i18n`Mz release at element end(s). × removes row.`}</p>
        ${tableShell(releaseHead, releaseRows)}
        <button type="button" class="structures-modal-action" data-struct-op="addRelease">${i18n`Add release`}</button>
      </div>
    </div>`
}

const buildPropertiesBody = (s, i18n) => {
  const pTab = s.propertiesTab || 'material'
  const matRows = s.materials.map((m) => html`
    <tr data-mat-id="${m.matId}">
      <td>${m.matId}</td>
      <td><input type="number" step="any" class="struct-mat-in structures-modal-field" data-k="w" value="${m.w}" /></td>
      <td><input type="number" step="any" class="struct-mat-in structures-modal-field" data-k="E" value="${m.E}" /></td>
      <td><input type="number" step="any" class="struct-mat-in structures-modal-field" data-k="G" value="${m.G}" /></td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-material structures-modal-icon-btn" data-mat-id="${m.matId}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`)
  const secRows = s.sections.map((x) => {
    const femHint = formatFemHint(sectionToFemProps(x))
    return html`
    <tr data-sec-id="${x.secId}">
      <td>${x.secId}</td>
      <td>
        <select class="struct-sec-in structures-modal-field structures-modal-select" data-k="type">
          <option value="rec" selected=${x.type === 'rec'}>rec</option>
          <option value="circle" selected=${x.type === 'circle'}>circle</option>
          <option value="I_Shape" selected=${x.type === 'I_Shape'}>I_Shape</option>
        </select>
      </td>
      <td><input type="number" step="any" class="struct-sec-in structures-modal-field" data-k="b" value="${x.b}" /></td>
      <td><input type="number" step="any" class="struct-sec-in structures-modal-field" data-k="H" value="${x.H}" /></td>
      <td><input type="number" step="any" class="struct-sec-in structures-modal-field" data-k="tw" value="${x.tw}" /></td>
      <td><input type="number" step="any" class="struct-sec-in structures-modal-field" data-k="tf" value="${x.tf}" /></td>
      <td><input type="number" step="any" class="struct-sec-in structures-modal-field" data-k="r" value="${x.r}" /></td>
      <td class="struct-fem-hint structures-modal-fem-cell">${femHint}</td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-section structures-modal-icon-btn" data-sec-id="${x.secId}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`
  })
  const matHead = html`<th>id</th><th>w</th><th>E</th><th>G</th><th class="structures-modal-actions-col"></th>`
  const secHead = html`
    <th>id</th><th>type</th><th>b</th><th>H</th><th>tw</th><th>tf</th><th>r</th><th>FEM</th><th class="structures-modal-actions-col"></th>`
  return html`
    <div class="structures-modal-body">
      <div class="structures-modal-tabs" role="tablist">
        <button type="button" role="tab" class="structures-modal-tab${pTab === 'material' ? ' structures-modal-tab--active' : ''}"
          data-properties-tab="material">${i18n`Material`}</button>
        <button type="button" role="tab" class="structures-modal-tab${pTab === 'sectional' ? ' structures-modal-tab--active' : ''}"
          data-properties-tab="sectional">${i18n`Sectional`}</button>
      </div>
      <div class="structures-modal-tab-panel${pTab === 'material' ? '' : ' structures-modal-tab-panel--hidden'}" role="tabpanel">
        ${tableShell(matHead, matRows)}
        <button type="button" class="structures-modal-action" data-struct-op="addMaterial">${i18n`Add material`}</button>
      </div>
      <div class="structures-modal-tab-panel${pTab === 'sectional' ? '' : ' structures-modal-tab-panel--hidden'}" role="tabpanel">
        <p class="struct-hint structures-modal-hint">${i18n`FEM props (A, Iy, Iz, J) computed from geometry below.`}</p>
        <div class="structures-modal-table-scroll structures-modal-table-scroll--wide">
          <table class="struct-table struct-table--wide structures-modal-table">
            <thead><tr>${secHead}</tr></thead>
            <tbody>${secRows}</tbody>
          </table>
        </div>
        <button type="button" class="structures-modal-action" data-struct-op="addSection">${i18n`Add section`}</button>
      </div>
    </div>`
}

const buildLoadBody = (s, i18n) => {
  const nLoadRows = (s.loads.nodal || []).map((l) => html`
    <tr data-id="${l.id}">
      <td>${l.id}</td>
      <td><input type="number" class="struct-nload-in structures-modal-field" data-k="nodeId" value="${l.nodeId}" /></td>
      <td><input type="number" step="any" class="struct-nload-in structures-modal-field" data-k="Fx" value="${l.Fx}" /></td>
      <td><input type="number" step="any" class="struct-nload-in structures-modal-field" data-k="Fy" value="${l.Fy}" /></td>
      <td><input type="number" step="any" class="struct-nload-in structures-modal-field" data-k="Fz" value="${l.Fz}" /></td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-nload structures-modal-icon-btn" data-id="${l.id}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`)
  const dLoadRows = (s.loads.distributed || []).map((l) => html`
    <tr data-id="${l.id}">
      <td>${l.id}</td>
      <td><input type="number" class="struct-dload-in structures-modal-field" data-k="elementId" value="${l.elementId}" /></td>
      <td><input type="number" step="any" class="struct-dload-in structures-modal-field" data-k="qy" value="${l.qy}" /></td>
      <td class="structures-modal-actions-cell">
        <button type="button" class="struct-remove-dload structures-modal-icon-btn" data-id="${l.id}" title="Remove" aria-label="Remove">×</button>
      </td>
    </tr>`)
  const nHead = html`<th>id</th><th>node</th><th>Fx</th><th>Fy</th><th>Fz</th><th class="structures-modal-actions-col"></th>`
  const dHead = html`<th>id</th><th>elem</th><th>qy</th><th class="structures-modal-actions-col"></th>`
  return html`
    <div class="structures-modal-body structures-modal-body--loads">
      <section class="structures-modal-section">
        <div class="structures-modal-section-title">${i18n`Nodal loads`}</div>
        ${tableShell(nHead, nLoadRows)}
        <button type="button" class="structures-modal-action" data-struct-op="addNodalLoad">${i18n`Add nodal load`}</button>
      </section>
      <section class="structures-modal-section">
        <div class="structures-modal-section-title">${i18n`Distributed loads`}</div>
        ${tableShell(dHead, dLoadRows)}
        <button type="button" class="structures-modal-action" data-struct-op="addDistributedLoad">${i18n`Add distributed load`}</button>
      </section>
    </div>`
}

const buildModalBody = (s, i18n, kind) => {
  switch (kind) {
    case 'node': return buildNodeBody(s, i18n)
    case 'element': return buildElementBody(s, i18n)
    case 'boundaries': return buildBoundariesBody(s, i18n)
    case 'properties': return buildPropertiesBody(s, i18n)
    case 'load': return buildLoadBody(s, i18n)
    default: return html`<div class="structures-modal-body"></div>`
  }
}

const buildStructuresModal = (state, i18n, kind) => {
  const s = state.structure || defaultStructure()
  const title = MODAL_TITLES[kind] || kind
  const body = buildModalBody(s, i18n, kind)
  const wide = kind === 'properties' || kind === 'boundaries' || kind === 'load'

  return html`
    <div class="structures-modal-backdrop">
      <div class="structures-modal${wide ? ' structures-modal--wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="structures-modal-head">
          <div class="structures-modal-head-text">
            <span class="structures-modal-title">${title}</span>
          </div>
          <button type="button" class="structures-modal-close" data-struct-modal-close aria-label="Close">
            <span class="structures-modal-close-icon" aria-hidden="true">×</span>
          </button>
        </header>
        ${body}
      </div>
    </div>`
}

module.exports = { buildStructuresModal, MODAL_TITLES }
