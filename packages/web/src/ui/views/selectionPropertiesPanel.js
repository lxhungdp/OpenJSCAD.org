const html = require('nanohtml')
const structureReducers = require('../flow/structureReducers')
const { formatIdRanges, parseIdsFromRangeString } = require('../selection/idRangeFormat')
const { parseSpacingPattern } = require('../selection/spacingPattern')
const {
  RESTRAINT_PRESET_OPTIONS,
  inferPresetFromDofs,
  dofsForPreset,
  isFreeDofs,
  restraintDofs,
  effectivePresetForRestraint
} = require('../restraints/restraintDofs')

const DOF_LABELS = ['Ux', 'Uy', 'Uz', 'Rx', 'Ry', 'Rz']

/** Set `window.__SEL_PROPS_DEBUG = true` in devtools to trace Apply → structure pipeline. */
const selPropsDebug = (label, data) => {
  if (typeof window !== 'undefined' && window.__SEL_PROPS_DEBUG) {
    console.log('[selection-props Apply]', label, data)
  }
}

/** Latest render context (morphdom does not copy element.onclick from nanohtml → live DOM). */
let selPropsLiveCtx = null

const getLivePanel = () => {
  if (typeof document === 'undefined') return null
  return document.getElementById('selectionPropertiesPanel')
}

const activateTab = (panel, name) => {
  if (!panel) return
  panel.querySelectorAll('[data-sel-tab]').forEach((t) => {
    t.classList.toggle('sel-tab--active', t.getAttribute('data-sel-tab') === name)
  })
  panel.querySelectorAll('[data-sel-panel]').forEach((p) => {
    p.classList.toggle('sel-tab-panel--hidden', p.getAttribute('data-sel-panel') !== name)
  })
}

/** Resolve selected ids: IDs field if non-empty, else viewer selection list; keep only ids that exist. */
const resolveSelectedIds = (rawInput, fallbackIds, existsFn) => {
  const trimmed = rawInput != null ? String(rawInput).trim() : ''
  const source = trimmed
    ? parseIdsFromRangeString(trimmed)
    : (fallbackIds || []).map(Number).filter((n) => isFinite(n))
  return [...new Set(source.filter((id) => existsFn(id)))]
}

const runApply = (panel, ctx) => {
  const livePanel = getLivePanel() || panel
  const structureCb = ctx.structureCtl && ctx.structureCtl.callback
  const viewerUiCb = ctx.viewerUiCtl && ctx.viewerUiCtl.callback
  const struct = ctx.struct
  const selectionNodeIds = ctx.nodeIds || []
  const selectionElementIds = ctx.elementIds || []

  if (typeof structureCb !== 'function') {
    console.error('[selection-props Apply] structureCtl.callback missing')
    return
  }

  const nodePanel = livePanel.querySelector('[data-sel-panel="nodes"]')
  const elemPanel = livePanel.querySelector('[data-sel-panel="elements"]')

  const nodeIdsInput = livePanel.querySelector('[data-sel-node-ids-input]')
  const elemIdsInput = livePanel.querySelector('[data-sel-element-ids-input]')

  const nextNodes = resolveSelectedIds(
    nodeIdsInput ? nodeIdsInput.value : '',
    selectionNodeIds,
    (id) => struct.nodes.some((n) => Number(n.id) === Number(id))
  )
  const nextElems = resolveSelectedIds(
    elemIdsInput ? elemIdsInput.value : '',
    selectionElementIds,
    (id) => struct.elements.some((el) => Number(el.id) === Number(id))
  )

  const nodeWrap = nodePanel && nodePanel.querySelector('.sel-props-node-bulk')
  let x
  let y
  let z
  if (nodeWrap) {
    const xInp = nodeWrap.querySelector('[data-k="x"]')
    const yInp = nodeWrap.querySelector('[data-k="y"]')
    const zInp = nodeWrap.querySelector('[data-k="z"]')
    x = xInp ? Number(xInp.value) : NaN
    y = yInp ? Number(yInp.value) : NaN
    z = zInp ? Number(zInp.value) : NaN
  }

  const panelPayload = { nodes: [], restraints: [], nodalLoads: [], elements: [], releases: [] }

  if (nextNodes.length && nodeWrap) {
    nextNodes.forEach((id) => {
      const n = struct.nodes.find((nn) => String(nn.id) === String(id))
      if (!n) return
      panelPayload.nodes.push({
        id: Number(id),
        x: isFinite(x) ? x : n.x,
        y: isFinite(y) ? y : n.y,
        z: isFinite(z) ? z : n.z
      })
    })
  }

  const restBox = nodePanel && nodePanel.querySelector('.sel-props-restraint')
  if (restBox && nextNodes.length) {
    const dofs = DOF_LABELS.map((_, i) => {
      const c = restBox.querySelector(`[data-dof="${i}"]`)
      return !!(c && c.checked)
    })
    const presetRadio = restBox.querySelector('[data-sel-restraint-preset]:checked')
    const preset = presetRadio ? presetRadio.value : inferPresetFromDofs(dofs)
    nextNodes.forEach((nid) => {
      if (isFreeDofs(dofs)) {
        panelPayload.restraints.push({ nodeId: Number(nid), remove: true })
      } else {
        panelPayload.restraints.push({
          nodeId: Number(nid),
          dofs,
          preset: preset === 'custom' ? 'custom' : inferPresetFromDofs(dofs)
        })
      }
    })
  }

  const loadBox = nodePanel && nodePanel.querySelector('.sel-props-nodal-load')
  if (loadBox && nextNodes.length) {
    const read = (k) => {
      const el = loadBox.querySelector(`[data-lk="${k}"]`)
      return el ? Number(el.value) : NaN
    }
    const Fx = read('Fx')
    const Fy = read('Fy')
    const Fz = read('Fz')
    const Mx = read('Mx')
    const My = read('My')
    const Mz = read('Mz')
    nextNodes.forEach((nid) => {
      panelPayload.nodalLoads.push({
        nodeId: Number(nid),
        Fx: isFinite(Fx) ? Fx : 0,
        Fy: isFinite(Fy) ? Fy : 0,
        Fz: isFinite(Fz) ? Fz : 0,
        Mx: isFinite(Mx) ? Mx : 0,
        My: isFinite(My) ? My : 0,
        Mz: isFinite(Mz) ? Mz : 0
      })
    })
  }

  if (elemPanel && nextElems.length) {
    const elemConnect = elemPanel.querySelector('.sel-props-element-connect')
    const elemMat = elemPanel.querySelector('.sel-props-element-mat')
    const iInp = elemConnect && elemConnect.querySelector('[data-k="iNode"]')
    const jInp = elemConnect && elemConnect.querySelector('[data-k="jNode"]')
    const matInp = elemMat && elemMat.querySelector('[data-k="matId"]')
    const secInp = elemMat && elemMat.querySelector('[data-k="secId"]')
    const relRadio = elemPanel.querySelector('[data-sel-release-end]:checked')
    const iNode = iInp ? Number(iInp.value) : NaN
    const jNode = jInp ? Number(jInp.value) : NaN
    const matId = matInp ? matInp.value : undefined
    const secId = secInp ? secInp.value : undefined
    const relEnd = relRadio && relRadio.value ? relRadio.value : 'none'
    nextElems.forEach((id) => {
      const el = struct.elements.find((ee) => String(ee.id) === String(id))
      if (!el) return
      panelPayload.elements.push({
        id: Number(id),
        iNode: isFinite(iNode) ? iNode : el.iNode,
        jNode: isFinite(jNode) ? jNode : el.jNode,
        matId: matId != null ? String(matId) : el.matId,
        secId: secId != null ? String(secId) : el.secId
      })
    })
    nextElems.forEach((eid) => {
      panelPayload.releases.push({ elementId: Number(eid), end: relEnd })
    })
  }

  selPropsDebug('apply', {
    selectionNodeIds,
    selectionElementIds,
    nextNodes,
    nextElems,
    readXYZ: { x, y, z },
    panelPayload
  })

  // One structure command (same idea as Node table: one reducer tick per user action).
  const hasStructureEdits = panelPayload.nodes.length > 0 ||
    panelPayload.restraints.length > 0 ||
    panelPayload.nodalLoads.length > 0 ||
    panelPayload.elements.length > 0 ||
    panelPayload.releases.length > 0

  if (hasStructureEdits) {
    structureCb({ op: 'applySelectionPanel', payload: panelPayload })
  }

  if (viewerUiCb) {
    viewerUiCb({
      op: 'setSelection',
      selectedNodeIds: nextNodes,
      selectedElementIds: nextElems
    })
  }
}

const runSpacing = (panel, ctx) => {
  const structureCb = ctx.structureCtl && ctx.structureCtl.callback
  const struct = ctx.struct
  const selectionNodeIds = ctx.nodeIds || []

  if (typeof structureCb !== 'function') {
    console.error('[selection-props Spacing] structureCtl.callback missing')
    return
  }

  const nodePanel = panel.querySelector('[data-sel-panel="nodes"]')
  const spacingBox = nodePanel && nodePanel.querySelector('.sel-props-spacing')
  if (!spacingBox) return

  const nodeIdsInput = panel.querySelector('[data-sel-node-ids-input]')
  const patternInp = spacingBox.querySelector('[data-sel-spacing-pattern]')
  const axisEl = spacingBox.querySelector('[data-sel-spacing-axis]:checked')
  const makeElInp = spacingBox.querySelector('[data-sel-spacing-make-element]')

  const nextNodes = resolveSelectedIds(
    nodeIdsInput ? nodeIdsInput.value : '',
    selectionNodeIds,
    (id) => struct.nodes.some((n) => Number(n.id) === Number(id))
  )

  if (!nextNodes.length) {
    console.warn('[selection-props Spacing] no anchor nodes')
    return
  }

  const parsed = parseSpacingPattern(patternInp ? patternInp.value : '')
  if (!parsed.ok) {
    console.warn('[selection-props Spacing]', parsed.error)
    if (typeof window !== 'undefined') window.alert(parsed.error)
    return
  }

  const axis = axisEl && (axisEl.value === 'y' || axisEl.value === 'z') ? axisEl.value : 'x'
  const makeElement = !!(makeElInp && makeElInp.checked)

  selPropsDebug('spacing', {
    nextNodes,
    axis,
    increments: parsed.increments,
    makeElement
  })

  structureCb({
    op: 'spacingPatternFromAnchors',
    payload: {
      anchorNodeIds: nextNodes,
      axis,
      increments: parsed.increments,
      makeElement
    }
  })
}

const runElementSpacing = (panel, ctx) => {
  const structureCb = ctx.structureCtl && ctx.structureCtl.callback
  const struct = ctx.struct
  const selectionElementIds = ctx.elementIds || []

  if (typeof structureCb !== 'function') {
    console.error('[selection-props Element Spacing] structureCtl.callback missing')
    return
  }

  const elemPanel = panel.querySelector('[data-sel-panel="elements"]')
  const spacingBox = elemPanel && elemPanel.querySelector('.sel-props-element-spacing')
  if (!spacingBox) return

  const elemIdsInput = panel.querySelector('[data-sel-element-ids-input]')
  const patternInp = spacingBox.querySelector('[data-sel-element-spacing-pattern]')
  const axisEl = spacingBox.querySelector('[data-sel-element-spacing-axis]:checked')
  const makeElInp = spacingBox.querySelector('[data-sel-element-spacing-make-element]')

  const nextElems = resolveSelectedIds(
    elemIdsInput ? elemIdsInput.value : '',
    selectionElementIds,
    (id) => struct.elements.some((e) => Number(e.id) === Number(id))
  )

  if (!nextElems.length) {
    console.warn('[selection-props Element Spacing] no anchor elements')
    return
  }

  const parsed = parseSpacingPattern(patternInp ? patternInp.value : '')
  if (!parsed.ok) {
    console.warn('[selection-props Element Spacing]', parsed.error)
    if (typeof window !== 'undefined') window.alert(parsed.error)
    return
  }

  const axis = axisEl && (axisEl.value === 'y' || axisEl.value === 'z') ? axisEl.value : 'x'
  const makeElement = !!(makeElInp && makeElInp.checked)

  selPropsDebug('element-spacing', {
    nextElems,
    axis,
    increments: parsed.increments,
    makeElement
  })

  structureCb({
    op: 'spacingPatternFromElements',
    payload: {
      anchorElementIds: nextElems,
      axis,
      increments: parsed.increments,
      makeElement
    }
  })
}

const resetDeleteConfirm = (panel) => {
  if (!panel) return
  panel.querySelectorAll('.sel-delete-row').forEach((row) => {
    row.classList.remove('sel-delete-row--confirming')
  })
}

const showDeleteConfirm = (row, confirming) => {
  if (row) row.classList.toggle('sel-delete-row--confirming', !!confirming)
}

const resolvePanelNodeIds = (panel, ctx) => {
  const struct = ctx.struct
  const nodeIdsInput = panel.querySelector('[data-sel-node-ids-input]')
  return resolveSelectedIds(
    nodeIdsInput ? nodeIdsInput.value : '',
    ctx.nodeIds || [],
    (id) => struct.nodes.some((n) => Number(n.id) === Number(id))
  )
}

const resolvePanelElementIds = (panel, ctx) => {
  const struct = ctx.struct
  const elemIdsInput = panel.querySelector('[data-sel-element-ids-input]')
  return resolveSelectedIds(
    elemIdsInput ? elemIdsInput.value : '',
    ctx.elementIds || [],
    (id) => struct.elements.some((e) => Number(e.id) === Number(id))
  )
}

const runDeleteNodes = (panel, ctx) => {
  const structureCb = ctx.structureCtl && ctx.structureCtl.callback
  const viewerUiCb = ctx.viewerUiCtl && ctx.viewerUiCtl.callback
  const nodeIds = resolvePanelNodeIds(panel, ctx)

  if (typeof structureCb !== 'function') return
  if (!nodeIds.length) {
    console.warn('[selection-props Delete] no nodes selected')
    return
  }

  structureCb({ op: 'removeNodesBatch', payload: { nodeIds } })
  resetDeleteConfirm(panel)

  if (viewerUiCb) {
    viewerUiCb({ op: 'clearSelection' })
  }
}

const runDeleteElements = (panel, ctx) => {
  const structureCb = ctx.structureCtl && ctx.structureCtl.callback
  const viewerUiCb = ctx.viewerUiCtl && ctx.viewerUiCtl.callback
  const elementIds = resolvePanelElementIds(panel, ctx)

  if (typeof structureCb !== 'function') return
  if (!elementIds.length) {
    console.warn('[selection-props Delete] no elements selected')
    return
  }

  structureCb({ op: 'removeElementsBatch', payload: { elementIds } })
  resetDeleteConfirm(panel)

  if (viewerUiCb) {
    viewerUiCb({ op: 'clearSelection' })
  }
}

let selPropsDelegationInstalled = false

/** One listener on document — survives morphdom (nanohtml onclick is not merged into live DOM). */
const ensureSelPropsDelegation = () => {
  if (selPropsDelegationInstalled || typeof document === 'undefined') return
  selPropsDelegationInstalled = true
  document.addEventListener('click', (e) => {
    const panel = getLivePanel()
    if (!panel || !panel.contains(e.target)) return

    if (e.target.closest('[data-sel-apply-all]')) {
      e.preventDefault()
      if (!selPropsLiveCtx) {
        console.warn('[selection-props Apply] no selPropsLiveCtx')
        return
      }
      runApply(panel, selPropsLiveCtx)
      return
    }

    const clearBtn = e.target.closest('[data-sel-props-clear]')
    if (clearBtn) {
      e.preventDefault()
      const viewerUiCb = selPropsLiveCtx && selPropsLiveCtx.viewerUiCtl && selPropsLiveCtx.viewerUiCtl.callback
      if (viewerUiCb) viewerUiCb({ op: 'clearSelection' })
      return
    }

    const tabBtn = e.target.closest('[data-sel-tab]')
    if (tabBtn) {
      e.preventDefault()
      activateTab(panel, tabBtn.getAttribute('data-sel-tab'))
      return
    }

    if (e.target.closest('[data-sel-spacing-run]')) {
      e.preventDefault()
      if (!selPropsLiveCtx) return
      runSpacing(panel, selPropsLiveCtx)
      return
    }

    if (e.target.closest('[data-sel-element-spacing-run]')) {
      e.preventDefault()
      if (!selPropsLiveCtx) return
      runElementSpacing(panel, selPropsLiveCtx)
      return
    }

    const deleteRow = e.target.closest('[data-sel-delete-row]')

    if (e.target.closest('[data-sel-delete-request]')) {
      e.preventDefault()
      showDeleteConfirm(deleteRow, true)
      return
    }

    if (e.target.closest('[data-sel-delete-cancel]')) {
      e.preventDefault()
      showDeleteConfirm(deleteRow, false)
      return
    }

    if (e.target.closest('[data-sel-delete-confirm]')) {
      e.preventDefault()
      if (!selPropsLiveCtx || !deleteRow) return
      const scope = deleteRow.getAttribute('data-sel-delete-scope')
      if (scope === 'elements') {
        runDeleteElements(panel, selPropsLiveCtx)
      } else {
        runDeleteNodes(panel, selPropsLiveCtx)
      }
    }
  })

  document.addEventListener('change', (e) => {
    const panel = getLivePanel()
    if (!panel || !panel.contains(e.target)) return
    const restBox = panel.querySelector('.sel-props-restraint')
    if (!restBox) return

    if (e.target.matches('[data-sel-restraint-preset]')) {
      const tuple = dofsForPreset(e.target.value)
      if (tuple) {
        tuple.forEach((v, i) => {
          const c = restBox.querySelector(`[data-dof="${i}"]`)
          if (c) c.checked = !!v
        })
      }
      return
    }

    if (e.target.matches('[data-dof]')) {
      const dofs = DOF_LABELS.map((_, i) => {
        const c = restBox.querySelector(`[data-dof="${i}"]`)
        return !!(c && c.checked)
      })
      const preset = inferPresetFromDofs(dofs)
      restBox.querySelectorAll('[data-sel-restraint-preset]').forEach((radio) => {
        radio.checked = radio.value === preset
      })
    }
  })
}
ensureSelPropsDelegation()

const commonNumeric = (items, key) => {
  if (!items.length) return ''
  const vals = items.map((n) => n[key])
  const s = new Set(vals)
  return s.size === 1 ? String(vals[0]) : ''
}

const commonRestraintDofs = (struct, nodeIds) => {
  if (!nodeIds.length) return [false, false, false, false, false, false]
  const rows = nodeIds.map((nid) => {
    const r = (struct.restraints || []).find((rr) => Number(rr.nodeId) === Number(nid))
    return r ? (restraintDofs(r) || [false, false, false, false, false, false]) : [false, false, false, false, false, false]
  })
  const out = []
  for (let i = 0; i < 6; i++) {
    const v0 = rows[0][i]
    out[i] = rows.every((row) => row[i] === v0) ? v0 : false
  }
  return out
}

const firstNodalLoadForNode = (struct, nodeId) => {
  const loads = (struct.loads && struct.loads.nodal) || []
  return loads.find((l) => Number(l.nodeId) === Number(nodeId))
}

const commonNodalLoadValues = (struct, nodeIds) => {
  const keys = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz']
  const out = {}
  for (const k of keys) {
    const vals = nodeIds.map((nid) => {
      const l = firstNodalLoadForNode(struct, nid)
      return l ? Number(l[k]) || 0 : 0
    })
    const s = new Set(vals)
    out[k] = s.size === 1 ? String(vals[0]) : ''
  }
  return out
}

const commonStringOnElements = (elems, key) => {
  if (!elems.length) return ''
  const vals = elems.map((e) => String(e[key]))
  const s = new Set(vals)
  return s.size === 1 ? vals[0] : ''
}

const matSelectOptions = (struct, selected) => (struct.materials || []).map((m) => html`
  <option value="${m.matId}" ${String(selected) === String(m.matId) ? 'selected' : ''}>${m.matId}</option>
`)

const secSelectOptions = (struct, selected) => (struct.sections || []).map((x) => html`
  <option value="${x.secId}" ${String(selected) === String(x.secId) ? 'selected' : ''}>${x.secId}</option>
`)

const RELEASE_ENDS = ['none', 'start', 'end', 'both']

const releaseRadioRow = (selected) => html`
  <div class="sel-release-radios" role="group" aria-label="Release">
    ${RELEASE_ENDS.map((end) => html`
      <label class="sel-release-opt">
        <input type="radio" name="sel-release-end" value="${end}" data-sel-release-end="" ${selected === end ? 'checked' : ''} />
        <span>${end === 'none' ? 'None' : end.charAt(0).toUpperCase() + end.slice(1)}</span>
      </label>
    `)}
  </div>
`

const commonReleaseEnd = (struct, elementIds) => {
  if (!elementIds.length) return 'none'
  const ends = elementIds.map((eid) => {
    const rel = (struct.releases || []).find((r) => Number(r.elementId) === Number(eid))
    if (!rel) return 'none'
    if (rel.end === 'start' || rel.end === 'end' || rel.end === 'both') return rel.end
    return 'none'
  })
  const e0 = ends[0]
  return ends.every((e) => e === e0) ? e0 : 'none'
}

const syncSelPropsTabs = (nodeIds, elementIds) => {
  const panel = getLivePanel()
  if (!panel) return
  if (nodeIds.length && elementIds.length) {
    activateTab(panel, 'nodes')
  } else if (elementIds.length) {
    activateTab(panel, 'elements')
  } else {
    activateTab(panel, 'nodes')
  }
}

const commonRestraintPreset = (struct, nodeIds) => {
  if (!nodeIds.length) return 'free'
  const presets = nodeIds.map((nid) => {
    const r = (struct.restraints || []).find((rr) => Number(rr.nodeId) === Number(nid))
    return r ? effectivePresetForRestraint(r) : 'free'
  })
  const p0 = presets[0]
  return presets.every((p) => p === p0) ? p0 : ''
}

const restraintPresetRadios = (selected) => html`
  <div class="sel-restraint-presets" role="radiogroup" aria-label="Restraint preset">
    ${RESTRAINT_PRESET_OPTIONS.map((p) => html`
      <label class="sel-restraint-preset">
        <input type="radio" name="sel-restraint-preset" value="${p.value}" data-sel-restraint-preset=""
          ${selected === p.value ? 'checked' : ''} />
        <span>${p.label}</span>
      </label>
    `)}
  </div>
`

const dofCheckboxRow = (struct, nodeIds, rowStart, rowEnd) => {
  const dofs = commonRestraintDofs(struct, nodeIds)
  const cells = []
  for (let i = rowStart; i < rowEnd; i++) {
    cells.push(html`<label class="sel-dof"><input type="checkbox" data-dof="${i}" ${dofs[i] ? 'checked' : ''} /><span>${DOF_LABELS[i]}</span></label>`)
  }
  return html`<div class="sel-dof-row sel-dof-row--spread">${cells}</div>`
}

const NODAL_LOAD_ROWS = [
  [{ lk: 'Fx', lab: 'Ux' }, { lk: 'Fy', lab: 'Uy' }, { lk: 'Fz', lab: 'Uz' }],
  [{ lk: 'Mx', lab: 'Rx' }, { lk: 'My', lab: 'Ry' }, { lk: 'Mz', lab: 'Rz' }]
]

const nodalLoadInputRows = (nl) => NODAL_LOAD_ROWS.map((row) => html`
  <div class="sel-load-row sel-labeled-row">
    ${row.map(({ lk, lab }) => html`
      <div class="sel-labeled-cell">
        <span class="sel-k">${lab}</span>
        <input type="number" class="sel-input" data-lk="${lk}" value="${nl[lk]}" step="any" />
      </div>
    `)}
  </div>
`)

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
  const showTabs = nodeIds.length > 0 && elementIds.length > 0

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
  const matVal = commonStringOnElements(elems, 'matId')
  const secVal = commonStringOnElements(elems, 'secId')

  const nl = commonNodalLoadValues(struct, nodeIds)
  const relEnd = commonReleaseEnd(struct, elementIds)
  const restPreset = commonRestraintPreset(struct, nodeIds)

  const nodePanelHidden = !nodeIds.length

  const panel = html`
    <div id="selectionPropertiesPanel" class="selection-props" style="${hasSel ? '' : 'display:none'}">
      ${hasSel ? html`
        <div class="selection-props__body">
          <div class="selection-props__toolbar">
            ${showTabs ? html`
              <div class="sel-tabs">
                <button type="button" class="sel-tab sel-tab--active" data-sel-tab="nodes">${i18n`Nodes`}</button>
                <button type="button" class="sel-tab" data-sel-tab="elements">${i18n`Elements`}</button>
              </div>
            ` : html`<span class="sel-panel-label">${nodeIds.length ? i18n`Nodes` : i18n`Elements`}</span>`}
            <button type="button" class="selection-props__clear" data-sel-props-clear="" title="${i18n`Clear selection`}">×</button>
          </div>
          <div data-sel-panel="nodes" class="sel-tab-panel sel-node-compact ${nodePanelHidden ? 'sel-tab-panel--hidden' : ''}">
            ${nodeIds.length ? html`
              <section class="sel-section sel-section--ids">
                <div class="sel-ids-row">
                  <span class="sel-section__label sel-section__label--inline">${i18n`IDs`}</span>
                  <input type="text" class="sel-input sel-input--ids" data-sel-node-ids-input="" value="${nStr}" spellcheck="false" placeholder="1, 3-5, 8" />
                </div>
                <div class="sel-delete-row" data-sel-delete-row="" data-sel-delete-scope="nodes">
                  <button type="button" class="sel-btn-delete-request" data-sel-delete-request="">${i18n`Delete Selected Nodes`}</button>
                  <div class="sel-delete-confirm-group">
                    <button type="button" class="sel-btn-delete-confirm" data-sel-delete-confirm="">${i18n`Confirm`}</button>
                    <button type="button" class="sel-btn-delete-cancel" data-sel-delete-cancel="">${i18n`Cancel`}</button>
                  </div>
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Coordinate`}</p>
                <div class="sel-props-node-bulk sel-coord-row sel-labeled-row">
                  <div class="sel-labeled-cell">
                    <span class="sel-k">X</span>
                    <input type="number" class="sel-input" data-k="x" value="${nx}" step="any" />
                  </div>
                  <div class="sel-labeled-cell">
                    <span class="sel-k">Y</span>
                    <input type="number" class="sel-input" data-k="y" value="${ny}" step="any" />
                  </div>
                  <div class="sel-labeled-cell">
                    <span class="sel-k">Z</span>
                    <input type="number" class="sel-input" data-k="z" value="${nz}" step="any" />
                  </div>
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Restraints`}</p>
                <div class="sel-props-restraint">
                  ${restraintPresetRadios(restPreset)}
                  ${dofCheckboxRow(struct, nodeIds, 0, 3)}
                  ${dofCheckboxRow(struct, nodeIds, 3, 6)}
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Nodal load`}</p>
                <div class="sel-props-nodal-load">
                  ${nodalLoadInputRows(nl)}
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Generate`}</p>
                <div class="sel-props-spacing">
                  <div class="sel-spacing-toolbar">
                    <div class="sel-spacing-axis" role="group" aria-label="${i18n`Axis`}">
                      <label class="sel-spacing-axis__opt"><input type="radio" name="sel-spacing-axis" value="x" data-sel-spacing-axis="" checked="" /> X</label>
                      <label class="sel-spacing-axis__opt"><input type="radio" name="sel-spacing-axis" value="y" data-sel-spacing-axis="" /> Y</label>
                      <label class="sel-spacing-axis__opt"><input type="radio" name="sel-spacing-axis" value="z" data-sel-spacing-axis="" /> Z</label>
                    </div>
                    <label class="sel-spacing-make-el">
                      <input type="checkbox" data-sel-spacing-make-element="" />
                      <span>${i18n`Make element`}</span>
                    </label>
                  </div>
                  <div class="sel-spacing-pattern-row">
                    <input type="text" class="sel-input sel-input--spacing-pattern" data-sel-spacing-pattern="" value="" spellcheck="false" placeholder="${i18n`e.g. 3 4 2@5 or -2 -3`}" />
                    <button type="button" class="sel-btn-spacing-apply" data-sel-spacing-run="" title="${i18n`Apply`}" aria-label="${i18n`Apply`}">
                      <svg class="sel-btn-spacing-apply__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  </div>
                </div>
              </section>
            ` : ''}
          </div>
          <div data-sel-panel="elements" class="sel-tab-panel sel-element-compact ${!elementIds.length ? 'sel-tab-panel--hidden' : (showTabs ? 'sel-tab-panel--hidden' : '')}">
            ${elementIds.length ? html`
              <section class="sel-section sel-section--ids">
                <div class="sel-ids-row">
                  <span class="sel-section__label sel-section__label--inline">${i18n`IDs`}</span>
                  <input type="text" class="sel-input sel-input--ids" data-sel-element-ids-input="" value="${eStr}" spellcheck="false" placeholder="1, 2-4" />
                </div>
                <div class="sel-delete-row" data-sel-delete-row="" data-sel-delete-scope="elements">
                  <button type="button" class="sel-btn-delete-request" data-sel-delete-request="">${i18n`Delete Selected Elements`}</button>
                  <div class="sel-delete-confirm-group">
                    <button type="button" class="sel-btn-delete-confirm" data-sel-delete-confirm="">${i18n`Confirm`}</button>
                    <button type="button" class="sel-btn-delete-cancel" data-sel-delete-cancel="">${i18n`Cancel`}</button>
                  </div>
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Connectivity`}</p>
                <div class="sel-props-element-connect sel-labeled-row sel-labeled-row--2">
                  <div class="sel-labeled-cell">
                    <span class="sel-k">i</span>
                    <input type="number" class="sel-input" data-k="iNode" value="${eiVal}" step="any" />
                  </div>
                  <div class="sel-labeled-cell">
                    <span class="sel-k">j</span>
                    <input type="number" class="sel-input" data-k="jNode" value="${ejVal}" step="any" />
                  </div>
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Properties`}</p>
                <div class="sel-props-element-mat sel-labeled-row sel-labeled-row--2">
                  <div class="sel-labeled-cell">
                    <span class="sel-k">${i18n`mat`}</span>
                    <select class="sel-select" data-k="matId">${matSelectOptions(struct, matVal)}</select>
                  </div>
                  <div class="sel-labeled-cell">
                    <span class="sel-k">${i18n`sec`}</span>
                    <select class="sel-select" data-k="secId">${secSelectOptions(struct, secVal)}</select>
                  </div>
                </div>
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Boundaries`}</p>
                ${releaseRadioRow(relEnd)}
              </section>
              <section class="sel-section">
                <p class="sel-section__label">${i18n`Generate`}</p>
                <div class="sel-props-element-spacing">
                  <div class="sel-spacing-toolbar">
                    <div class="sel-spacing-axis" role="group" aria-label="${i18n`Axis`}">
                      <label class="sel-spacing-axis__opt"><input type="radio" name="sel-element-spacing-axis" value="x" data-sel-element-spacing-axis="" checked="" /> X</label>
                      <label class="sel-spacing-axis__opt"><input type="radio" name="sel-element-spacing-axis" value="y" data-sel-element-spacing-axis="" /> Y</label>
                      <label class="sel-spacing-axis__opt"><input type="radio" name="sel-element-spacing-axis" value="z" data-sel-element-spacing-axis="" /> Z</label>
                    </div>
                    <label class="sel-spacing-make-el">
                      <input type="checkbox" data-sel-element-spacing-make-element="" />
                      <span>${i18n`Make element`}</span>
                    </label>
                  </div>
                  <div class="sel-spacing-pattern-row">
                    <input type="text" class="sel-input sel-input--spacing-pattern" data-sel-element-spacing-pattern="" value="" spellcheck="false" placeholder="${i18n`e.g. 3 4 2@5 or -2 -3`}" />
                    <button type="button" class="sel-btn-spacing-apply" data-sel-element-spacing-run="" title="${i18n`Apply`}" aria-label="${i18n`Apply`}">
                      <svg class="sel-btn-spacing-apply__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  </div>
                </div>
              </section>
            ` : ''}
          </div>
        </div>
        <div class="selection-props__apply-wrap">
          <button type="button" class="sel-btn-apply" data-sel-apply-all="">${i18n`Apply`}</button>
        </div>
      ` : ''}
    </div>
  `

  selPropsLiveCtx = {
    structureCtl,
    viewerUiCtl,
    struct,
    nodeIds,
    elementIds
  }
  if (hasSel && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      syncSelPropsTabs(nodeIds, elementIds)
      resetDeleteConfirm(getLivePanel())
    })
  } else if (hasSel) {
    syncSelPropsTabs(nodeIds, elementIds)
    resetDeleteConfirm(getLivePanel())
  }

  return panel
}

module.exports = selectionPropertiesPanel
