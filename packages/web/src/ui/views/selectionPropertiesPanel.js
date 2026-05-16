const html = require('nanohtml')
const structureReducers = require('../flow/structureReducers')
const { formatIdRanges } = require('../selection/idRangeFormat')

/**
 * @param {HTMLElement} root
 * @param {function} structureCb
 * @param {function} [viewerUiCb]
 * @param {object} struct — snapshot from structureReducers.ensure(state)
 * @param {number[]} nodeIds
 * @param {number[]} elementIds
 */
const attachHandlers = (root, structureCb, viewerUiCb, struct, nodeIds, elementIds) => {
  if (!root || typeof structureCb !== 'function') return

  const clearBtn = root.querySelector('[data-sel-props-clear]')
  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.preventDefault()
      if (viewerUiCb) viewerUiCb({ op: 'clearSelection' })
    }
  }

  const nodeWrap = root.querySelector('.sel-props-node-bulk')
  if (nodeWrap && nodeIds.length) {
    const applyNodes = () => {
      const x = Number(nodeWrap.querySelector('[data-k="x"]') && nodeWrap.querySelector('[data-k="x"]').value)
      const y = Number(nodeWrap.querySelector('[data-k="y"]') && nodeWrap.querySelector('[data-k="y"]').value)
      const z = Number(nodeWrap.querySelector('[data-k="z"]') && nodeWrap.querySelector('[data-k="z"]').value)
      nodeIds.forEach((id) => {
        const n = struct.nodes.find((nn) => String(nn.id) === String(id))
        if (!n) return
        structureCb({
          op: 'updateNode',
          payload: {
            id: Number(id),
            x: isFinite(x) ? x : n.x,
            y: isFinite(y) ? y : n.y,
            z: isFinite(z) ? z : n.z
          }
        })
      })
    }
    ;['x', 'y', 'z'].forEach((k) => {
      const inp = nodeWrap.querySelector(`[data-k="${k}"]`)
      if (inp) inp.onchange = () => applyNodes()
    })
  }

  const elWrap = root.querySelector('.sel-props-element-bulk')
  if (elWrap && elementIds.length) {
    const applyElems = () => {
      const iInp = elWrap.querySelector('[data-k="iNode"]')
      const jInp = elWrap.querySelector('[data-k="jNode"]')
      const matInp = elWrap.querySelector('[data-k="matId"]')
      const secInp = elWrap.querySelector('[data-k="secId"]')
      const iNode = Number(iInp && iInp.value)
      const jNode = Number(jInp && jInp.value)
      const matId = matInp && matInp.value
      const secId = secInp && secInp.value
      elementIds.forEach((id) => {
        const el = struct.elements.find((ee) => String(ee.id) === String(id))
        if (!el) return
        structureCb({
          op: 'updateElement',
          payload: {
            id: Number(id),
            iNode: isFinite(iNode) ? iNode : el.iNode,
            jNode: isFinite(jNode) ? jNode : el.jNode,
            matId: matId != null ? String(matId) : el.matId,
            secId: secId != null ? String(secId) : el.secId
          }
        })
      })
    }
    elWrap.querySelectorAll('.sel-elem-in').forEach((inp) => {
      inp.onchange = () => applyElems()
    })
  }
}

const commonNumeric = (nodes, key) => {
  if (!nodes.length) return ''
  const vals = nodes.map((n) => n[key])
  const s = new Set(vals)
  return s.size === 1 ? String(vals[0]) : ''
}

/**
 * @param {object} state
 * @param {function} i18n
 * @param {object} structureCtl — { callback }
 * @param {object} viewerUiCtl — { callback } optional
 */
const selectionPropertiesPanel = (state, i18n, structureCtl, viewerUiCtl) => {
  const sel = (state.viewer && state.viewer.selection) || {}
  const struct = structureReducers.ensure(state)
  const nodeIds = (sel.selectedNodeIds || []).map(Number).filter((n) => isFinite(n))
  const elementIds = (sel.selectedElementIds || []).map(Number).filter((n) => isFinite(n))
  const hasSel = sel.mode === 'select' && (nodeIds.length > 0 || elementIds.length > 0)

  const nodes = nodeIds.map((id) => struct.nodes.find((n) => String(n.id) === String(id))).filter(Boolean)
  const elems = elementIds.map((id) => struct.elements.find((e) => String(e.id) === String(id))).filter(Boolean)

  const nStr = formatIdRanges(nodeIds)
  const eStr = formatIdRanges(elementIds)

  const nx = commonNumeric(nodes, 'x')
  const ny = commonNumeric(nodes, 'y')
  const nz = commonNumeric(nodes, 'z')

  const firstEl = elems.length ? elems[0] : null
  const eiVal = firstEl && elems.every((e) => String(e.iNode) === String(firstEl.iNode)) ? String(firstEl.iNode) : ''
  const ejVal = firstEl && elems.every((e) => String(e.jNode) === String(firstEl.jNode)) ? String(firstEl.jNode) : ''
  const matVal = firstEl && elems.every((e) => String(e.matId) === String(firstEl.matId)) ? String(firstEl.matId) : ''
  const secVal = firstEl && elems.every((e) => String(e.secId) === String(firstEl.secId)) ? String(firstEl.secId) : ''

  const structureCb = structureCtl && structureCtl.callback
  const viewerUi = viewerUiCtl && viewerUiCtl.callback
  const panel = html`
    <aside id="selectionPropertiesPanel" class="selection-props" style="${hasSel ? 'display:flex' : 'display:none'}" aria-label="${i18n`Selection properties`}">
      <div class="selection-props__inner">
        <header class="selection-props__head">
          <h3 class="selection-props__title">${i18n`Properties`}</h3>
          <button type="button" class="selection-props__clear" data-sel-props-clear="" title="${i18n`Clear selection`}">×</button>
        </header>
        ${hasSel ? html`
          <p class="selection-props__hint">${i18n`Drag on the canvas: left→right window; right→left crossing (AutoCAD-style).`}</p>
          ${nodeIds.length ? html`
            <section class="selection-props__section">
              <h4 class="selection-props__label">${i18n`Nodes`}</h4>
              <label class="selection-props__field">
                <span class="selection-props__fname">${i18n`IDs`}</span>
                <input type="text" class="selection-props__input" readonly value="${nStr}" />
              </label>
              <div class="sel-props-node-bulk">
                <label class="selection-props__field"><span class="selection-props__fname">x</span>
                  <input type="number" class="selection-props__input sel-node-in" data-k="x" value="${nx}" step="any" /></label>
                <label class="selection-props__field"><span class="selection-props__fname">y</span>
                  <input type="number" class="selection-props__input sel-node-in" data-k="y" value="${ny}" step="any" /></label>
                <label class="selection-props__field"><span class="selection-props__fname">z</span>
                  <input type="number" class="selection-props__input sel-node-in" data-k="z" value="${nz}" step="any" /></label>
              </div>
            </section>
          ` : ''}
          ${elementIds.length ? html`
            <section class="selection-props__section">
              <h4 class="selection-props__label">${i18n`Elements`}</h4>
              <label class="selection-props__field">
                <span class="selection-props__fname">${i18n`IDs`}</span>
                <input type="text" class="selection-props__input" readonly value="${eStr}" />
              </label>
              <div class="sel-props-element-bulk">
                <label class="selection-props__field"><span class="selection-props__fname">i</span>
                  <input type="number" class="selection-props__input sel-elem-in" data-k="iNode" value="${eiVal}" /></label>
                <label class="selection-props__field"><span class="selection-props__fname">j</span>
                  <input type="number" class="selection-props__input sel-elem-in" data-k="jNode" value="${ejVal}" /></label>
                <label class="selection-props__field"><span class="selection-props__fname">${i18n`matId`}</span>
                  <input type="text" class="selection-props__input sel-elem-in" data-k="matId" value="${matVal}" /></label>
                <label class="selection-props__field"><span class="selection-props__fname">${i18n`secId`}</span>
                  <input type="text" class="selection-props__input sel-elem-in" data-k="secId" value="${secVal}" /></label>
              </div>
            </section>
          ` : ''}
        ` : html`<p class="selection-props__empty">${i18n`No selection`}</p>`}
      </div>
    </aside>
  `

  if (structureCb && hasSel) {
    attachHandlers(panel, structureCb, viewerUi, struct, nodeIds, elementIds)
  } else if (structureCb && !hasSel) {
    attachHandlers(panel, structureCb, viewerUi, struct, [], [])
  }

  return panel
}

module.exports = selectionPropertiesPanel
