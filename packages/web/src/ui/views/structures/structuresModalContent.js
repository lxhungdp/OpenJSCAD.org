const html = require('nanohtml')
const defaultStructure = require('../../../core/structure/defaultStructure')
const { sectionToFemProps } = require('../../../core/structure/sectionToFemProps')

const RESTRAINT_PRESETS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'horizontal-roller', label: 'H-roller' },
  { value: 'vertical-roller', label: 'V-roller' },
  { value: 'custom', label: 'Custom (6 DOF)' }
]

const DOF_LABELS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz']

const MODAL_TITLES = {
  node: 'Nodes',
  element: 'Elements',
  boundaries: 'Boundaries',
  properties: 'Properties',
  load: 'Loads',
  display: 'Display'
}

const buildNodeBody = (s, i18n) => {
  const nodeRows = s.nodes.map((n) => html`
    <tr data-node-id="${n.id}">
      <td>${n.id}</td>
      <td><input type="number" step="any" class="struct-node-in" data-axis="x" value="${n.x}" /></td>
      <td><input type="number" step="any" class="struct-node-in" data-axis="y" value="${n.y}" /></td>
      <td><input type="number" step="any" class="struct-node-in" data-axis="z" value="${n.z}" /></td>
      <td><button type="button" class="struct-remove-node" data-node-id="${n.id}">×</button></td>
    </tr>`)
  return html`
    <div class="structures-modal-body">
      <table class="struct-table">
        <thead><tr><th>id</th><th>X</th><th>Y</th><th>Z</th><th></th></tr></thead>
        <tbody>${nodeRows}</tbody>
      </table>
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
      <td><input type="number" class="struct-elem-in" data-k="iNode" value="${e.iNode}" /></td>
      <td><input type="number" class="struct-elem-in" data-k="jNode" value="${e.jNode}" /></td>
      <td><select class="struct-elem-in" data-k="matId">${matOpts}</select></td>
      <td><select class="struct-elem-in" data-k="secId">${secOpts}</select></td>
      <td><button type="button" class="struct-remove-element" data-element-id="${e.id}">×</button></td>
    </tr>`
  })
  return html`
    <div class="structures-modal-body">
      <table class="struct-table">
        <thead><tr><th>id</th><th>iNode</th><th>jNode</th><th>matId</th><th>secId</th><th></th></tr></thead>
        <tbody>${elemRows}</tbody>
      </table>
      <button type="button" class="structures-modal-action" data-struct-op="addElement">${i18n`Add element`}</button>
    </div>`
}

const buildBoundariesBody = (s, i18n) => {
  const bTab = s.boundariesTab || 'restraint'
  const restraintRows = s.restraints.map((r) => {
    const presetOpts = RESTRAINT_PRESETS.map((p) =>
      html`<option value="${p.value}" selected=${r.preset === p.value}>${p.label}</option>`)
    const dofCells = DOF_LABELS.map((label, i) => html`
      <td><input type="checkbox" class="struct-restraint-in" data-dof="${i}"
        checked=${r.dofs && r.dofs[i]} title="${label}" /></td>`)
    return html`
    <tr data-node-id="${r.nodeId}">
      <td>${r.id}</td>
      <td>${r.nodeId}</td>
      <td><select class="struct-restraint-in" data-k="preset">${presetOpts}</select></td>
      ${dofCells}
      <td><button type="button" class="struct-remove-restraint" data-id="${r.id}">×</button></td>
    </tr>`
  })
  const releaseRows = s.releases.map((r) => html`
    <tr data-element-id="${r.elementId}">
      <td>${r.id}</td>
      <td>${r.elementId}</td>
      <td>
        <select class="struct-release-in" data-k="end">
          <option value="start" selected=${r.end === 'start'}>start</option>
          <option value="end" selected=${r.end === 'end'}>end</option>
          <option value="both" selected=${r.end === 'both'}>both</option>
        </select>
      </td>
      <td><button type="button" class="struct-remove-release" data-id="${r.id}">×</button></td>
    </tr>`)
  return html`
    <div class="structures-modal-body">
      <div class="structures-modal-tabs">
        <button type="button" class="structures-modal-tab${bTab === 'restraint' ? ' structures-modal-tab--active' : ''}"
          data-boundaries-tab="restraint">${i18n`Restraint`}</button>
        <button type="button" class="structures-modal-tab${bTab === 'release' ? ' structures-modal-tab--active' : ''}"
          data-boundaries-tab="release">${i18n`Release`}</button>
      </div>
      <div style="display:${bTab === 'restraint' ? 'block' : 'none'}">
        <p class="struct-hint">${i18n`true = fixed DOF. Preset overrides checkboxes when not Custom.`}</p>
        <table class="struct-table">
          <thead><tr><th>id</th><th>nodeId</th><th>preset</th>
            ${DOF_LABELS.map((l) => html`<th>${l}</th>`)}
            <th></th></tr></thead>
          <tbody>${restraintRows}</tbody>
        </table>
        <button type="button" class="structures-modal-action" data-struct-op="addRestraint">${i18n`Add restraint`}</button>
      </div>
      <div style="display:${bTab === 'release' ? 'block' : 'none'}">
        <table class="struct-table">
          <thead><tr><th>id</th><th>elementId</th><th>end</th><th></th></tr></thead>
          <tbody>${releaseRows}</tbody>
        </table>
        <button type="button" class="structures-modal-action" data-struct-op="addRelease">${i18n`Add release`}</button>
      </div>
    </div>`
}

const buildPropertiesBody = (s, i18n) => {
  const pTab = s.propertiesTab || 'material'
  const matRows = s.materials.map((m) => html`
    <tr data-mat-id="${m.matId}">
      <td>${m.matId}</td>
      <td><input type="number" step="any" class="struct-mat-in" data-k="w" value="${m.w}" /></td>
      <td><input type="number" step="any" class="struct-mat-in" data-k="E" value="${m.E}" /></td>
      <td><input type="number" step="any" class="struct-mat-in" data-k="G" value="${m.G}" /></td>
      <td><button type="button" class="struct-remove-material" data-mat-id="${m.matId}">×</button></td>
    </tr>`)
  const secRows = s.sections.map((x) => {
    const fem = sectionToFemProps(x)
    const femHint = fem
      ? `A=${fem.area.toExponential(3)} Iy=${fem.momentInertiaY.toExponential(3)} Iz=${fem.momentInertiaZ.toExponential(3)}`
      : '—'
    return html`
    <tr data-sec-id="${x.secId}">
      <td>${x.secId}</td>
      <td>
        <select class="struct-sec-in" data-k="type">
          <option value="rec" selected=${x.type === 'rec'}>rec</option>
          <option value="circle" selected=${x.type === 'circle'}>circle</option>
          <option value="I_Shape" selected=${x.type === 'I_Shape'}>I_Shape</option>
        </select>
      </td>
      <td><input type="number" step="any" class="struct-sec-in" data-k="b" value="${x.b}" /></td>
      <td><input type="number" step="any" class="struct-sec-in" data-k="H" value="${x.H}" /></td>
      <td><input type="number" step="any" class="struct-sec-in" data-k="tw" value="${x.tw}" /></td>
      <td><input type="number" step="any" class="struct-sec-in" data-k="tf" value="${x.tf}" /></td>
      <td><input type="number" step="any" class="struct-sec-in" data-k="r" value="${x.r}" /></td>
      <td class="struct-fem-hint">${femHint}</td>
      <td><button type="button" class="struct-remove-section" data-sec-id="${x.secId}">×</button></td>
    </tr>`
  })
  return html`
    <div class="structures-modal-body">
      <div class="structures-modal-tabs">
        <button type="button" class="structures-modal-tab${pTab === 'material' ? ' structures-modal-tab--active' : ''}"
          data-properties-tab="material">${i18n`Material`}</button>
        <button type="button" class="structures-modal-tab${pTab === 'sectional' ? ' structures-modal-tab--active' : ''}"
          data-properties-tab="sectional">${i18n`Sectional`}</button>
      </div>
      <div style="display:${pTab === 'material' ? 'block' : 'none'}">
        <table class="struct-table">
          <thead><tr><th>matId</th><th>w</th><th>E</th><th>G</th><th></th></tr></thead>
          <tbody>${matRows}</tbody>
        </table>
        <button type="button" class="structures-modal-action" data-struct-op="addMaterial">${i18n`Add material`}</button>
      </div>
      <div style="display:${pTab === 'sectional' ? 'block' : 'none'}">
        <p class="struct-hint">${i18n`FEM props (A, Iy, Iz, J) computed from geometry below.`}</p>
        <table class="struct-table struct-table--wide">
          <thead><tr><th>secId</th><th>type</th><th>b</th><th>H</th><th>tw</th><th>tf</th><th>r</th><th>FEM</th><th></th></tr></thead>
          <tbody>${secRows}</tbody>
        </table>
        <button type="button" class="structures-modal-action" data-struct-op="addSection">${i18n`Add section`}</button>
      </div>
    </div>`
}

const buildLoadBody = (s, i18n) => {
  const nLoadRows = (s.loads.nodal || []).map((l) => html`
    <tr data-id="${l.id}">
      <td>${l.id}</td>
      <td><input type="number" class="struct-nload-in" data-k="nodeId" value="${l.nodeId}" /></td>
      <td><input type="number" step="any" class="struct-nload-in" data-k="Fx" value="${l.Fx}" /></td>
      <td><input type="number" step="any" class="struct-nload-in" data-k="Fy" value="${l.Fy}" /></td>
      <td><input type="number" step="any" class="struct-nload-in" data-k="Fz" value="${l.Fz}" /></td>
      <td><button type="button" class="struct-remove-nload" data-id="${l.id}">×</button></td>
    </tr>`)
  const dLoadRows = (s.loads.distributed || []).map((l) => html`
    <tr data-id="${l.id}">
      <td>${l.id}</td>
      <td><input type="number" class="struct-dload-in" data-k="elementId" value="${l.elementId}" /></td>
      <td><input type="number" step="any" class="struct-dload-in" data-k="qy" value="${l.qy}" /></td>
      <td><button type="button" class="struct-remove-dload" data-id="${l.id}">×</button></td>
    </tr>`)
  return html`
    <div class="structures-modal-body">
      <h4>${i18n`Nodal loads`}</h4>
      <table class="struct-table">
        <thead><tr><th>id</th><th>nodeId</th><th>Fx</th><th>Fy</th><th>Fz</th><th></th></tr></thead>
        <tbody>${nLoadRows}</tbody>
      </table>
      <button type="button" class="structures-modal-action" data-struct-op="addNodalLoad">${i18n`Add nodal load`}</button>
      <h4>${i18n`Distributed loads`}</h4>
      <table class="struct-table">
        <thead><tr><th>id</th><th>elementId</th><th>qy</th><th></th></tr></thead>
        <tbody>${dLoadRows}</tbody>
      </table>
      <button type="button" class="structures-modal-action" data-struct-op="addDistributedLoad">${i18n`Add distributed load`}</button>
    </div>`
}

const buildDisplayBody = (s, i18n) => html`
  <div class="structures-modal-body structures-modal-body--compact">
    <p class="struct-hint">${i18n`Screen-space overlay when 3D members off. Use drawing toolbar to place nodes/elements.`}</p>
    <label class="struct-check">
      <input type="checkbox" id="structShow3d" checked=${!!s.show3dMembers} />
      ${i18n`Show 3D members (solid bars)`}
    </label>
  </div>`

const buildModalBody = (s, i18n, kind) => {
  switch (kind) {
    case 'node': return buildNodeBody(s, i18n)
    case 'element': return buildElementBody(s, i18n)
    case 'boundaries': return buildBoundariesBody(s, i18n)
    case 'properties': return buildPropertiesBody(s, i18n)
    case 'load': return buildLoadBody(s, i18n)
    case 'display': return buildDisplayBody(s, i18n)
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
        <div class="structures-modal-head">
          <span>${title}</span>
          <button type="button" class="structures-modal-close" data-struct-modal-close aria-label="Close">×</button>
        </div>
        ${body}
      </div>
    </div>`
}

module.exports = { buildStructuresModal, MODAL_TITLES }
