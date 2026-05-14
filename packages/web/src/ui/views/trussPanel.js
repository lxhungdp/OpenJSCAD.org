const html = require('nanohtml')

const defaultTruss = () => ({
  nodes: [],
  elements: [],
  nextNodeId: 1,
  nextElementId: 1,
  show3dMembers: false,
  sectionType: 'rect',
  sectionB: 2,
  sectionH: 2,
  sectionRadius: 1
})

const readNodeRow = (tr, id) => {
  const inputs = tr.querySelectorAll('.truss-node-in')
  let x = 0
  let y = 0
  let z = 0
  inputs.forEach((inp) => {
    const axis = inp.getAttribute('data-axis')
    const v = Number(inp.value)
    if (axis === 'x') x = v
    if (axis === 'y') y = v
    if (axis === 'z') z = v
  })
  return { id, x, y, z }
}

const readElementRow = (tr, id) => {
  const startInp = tr.querySelector('.truss-elem-start')
  const endInp = tr.querySelector('.truss-elem-end')
  const startId = Number(startInp && startInp.value)
  const endId = Number(endInp && endInp.value)
  return { id, startId, endId }
}

/**
 * Imperative handlers on the fresh DOM (same pattern as parameterControls).
 * morphdom replaces nodes each render, so most.fromEvent on #container is unreliable.
 */
const attachTrussHandlers = (root, trussCtl) => {
  if (!root || !trussCtl || typeof trussCtl.callback !== 'function') return

  const cb = trussCtl.callback

  const addNodeBtn = root.querySelector('#trussAddNode')
  if (addNodeBtn) {
    addNodeBtn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'addNode' })
    }
  }

  const addElBtn = root.querySelector('#trussAddElement')
  if (addElBtn) {
    addElBtn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'addElement' })
    }
  }

  root.querySelectorAll('.truss-remove-node').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      const id = btn.getAttribute('data-node-id')
      cb({ op: 'removeNode', nodeId: id })
    }
  })

  root.querySelectorAll('.truss-remove-element').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      const id = btn.getAttribute('data-element-id')
      cb({ op: 'removeElement', elementId: id })
    }
  })

  root.querySelectorAll('.truss-node-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target && ev.target.closest && ev.target.closest('tr')
      if (!tr) return
      const id = Number(tr.getAttribute('data-node-id'))
      cb({ op: 'updateNode', payload: readNodeRow(tr, id) })
    }
  })

  root.querySelectorAll('.truss-elem-start, .truss-elem-end').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target && ev.target.closest && ev.target.closest('tr')
      if (!tr) return
      const id = tr.getAttribute('data-element-id')
      cb({ op: 'updateElement', payload: readElementRow(tr, id) })
    }
  })

  const show3d = root.querySelector('#trussShow3d')
  if (show3d) {
    show3d.onchange = () => cb({ op: 'setShow3dMembers', value: show3d.checked })
  }

  const sectionType = root.querySelector('#trussSectionType')
  if (sectionType) {
    sectionType.onchange = () => cb({ op: 'setSectionType', value: sectionType.value })
  }

  const bInp = root.querySelector('#trussSectionB')
  if (bInp) {
    bInp.onchange = () => cb({ op: 'setSectionB', value: bInp.value })
  }
  const hInp = root.querySelector('#trussSectionH')
  if (hInp) {
    hInp.onchange = () => cb({ op: 'setSectionH', value: hInp.value })
  }
  const rInp = root.querySelector('#trussSectionRadius')
  if (rInp) {
    rInp.onchange = () => cb({ op: 'setSectionRadius', value: rInp.value })
  }
}

const trussPanel = (state, i18n, trussCallbacktoStream) => {
  const t = state.truss || defaultTruss()
  const secColor = state.themes && state.themes.themeSettings
    ? state.themes.themeSettings.secondaryTextColor
    : '#333'

  const nodeRows = t.nodes.map((n) => html`
    <tr data-node-id="${n.id}">
      <td>${n.id}</td>
      <td><input type="number" step="any" class="truss-node-in" data-axis="x" value="${String(n.x)}" /></td>
      <td><input type="number" step="any" class="truss-node-in" data-axis="y" value="${String(n.y)}" /></td>
      <td><input type="number" step="any" class="truss-node-in" data-axis="z" value="${String(n.z)}" /></td>
      <td><button type="button" class="truss-remove-node" data-node-id="${n.id}">×</button></td>
    </tr>
  `)

  const elemRows = t.elements.map((e) => html`
    <tr data-element-id="${e.id}">
      <td>${e.id}</td>
      <td><input type="number" step="1" class="truss-elem-start" value="${String(e.startId)}" /></td>
      <td><input type="number" step="1" class="truss-elem-end" value="${String(e.endId)}" /></td>
      <td><button type="button" class="truss-remove-element" data-element-id="${e.id}">×</button></td>
    </tr>
  `)

  const st = t.sectionType || 'rect'

  const section = html`
  <section id="truss" class="popup-menu truss-panel" style="visibility:${state.activeTool === 'truss' ? 'visible' : 'hidden'}; color:${secColor}">
    <h3>${i18n`Truss`}</h3>
    <p class="truss-hint">${i18n`Screen-space nodes/lines do not change size when zooming. Enable 3D members to render solid bars (same color as the mesh in the viewer theme).`}</p>

    <fieldset class="truss-fieldset">
      <legend><h4>${i18n`3D members`}</h4></legend>
      <label class="truss-check">
        <input type="checkbox" id="trussShow3d" checked=${!!t.show3dMembers} />
        ${i18n`Show 3D cross-section (solid bars)`}
      </label>
      <div class="truss-section-row">
        <label>${i18n`Section`}</label>
        <select id="trussSectionType">
          <option value="rect" selected=${st === 'rect'}>${i18n`Rectangle (b × h)`}</option>
          <option value="square" selected=${st === 'square'}>${i18n`Square (b)`}</option>
          <option value="circle" selected=${st === 'circle'}>${i18n`Circle (radius)`}</option>
        </select>
      </div>
      <div class="truss-section-row" style="display:${st === 'circle' ? 'none' : 'flex'}">
        <label for="trussSectionB">${i18n`b (width)`}</label>
        <input type="number" step="any" id="trussSectionB" min="0.001" value="${String(t.sectionB != null ? t.sectionB : 2)}" />
      </div>
      <div class="truss-section-row" style="display:${st === 'rect' ? 'flex' : 'none'}">
        <label for="trussSectionH">${i18n`h (depth)`}</label>
        <input type="number" step="any" id="trussSectionH" min="0.001" value="${String(t.sectionH != null ? t.sectionH : 2)}" />
      </div>
      <div class="truss-section-row" style="display:${st === 'circle' ? 'flex' : 'none'}">
        <label for="trussSectionRadius">${i18n`Radius`}</label>
        <input type="number" step="any" id="trussSectionRadius" min="0.001" value="${String(t.sectionRadius != null ? t.sectionRadius : 1)}" />
      </div>
    </fieldset>

    <h4>${i18n`Nodes`}</h4>
    <table class="truss-table">
      <thead><tr><th>id</th><th>x</th><th>y</th><th>z</th><th></th></tr></thead>
      <tbody>${nodeRows}</tbody>
    </table>
    <button type="button" id="trussAddNode">${i18n`Add node`}</button>

    <h4>${i18n`Elements`}</h4>
    <table class="truss-table">
      <thead><tr><th>id</th><th>${i18n`start node`}</th><th>${i18n`end node`}</th><th></th></tr></thead>
      <tbody>${elemRows}</tbody>
    </table>
    <button type="button" id="trussAddElement">${i18n`Add element`}</button>
  </section>`

  attachTrussHandlers(section, trussCallbacktoStream)
  return section
}

module.exports = trussPanel
