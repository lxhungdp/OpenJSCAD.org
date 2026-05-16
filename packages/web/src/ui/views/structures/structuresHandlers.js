const DOF_LABELS = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz']
const { inferPresetFromDofs, dofsForPreset, isFreeDofs } = require('../../restraints/restraintDofs')
const { downloadStructureJson, pickStructureJsonFile } = require('./structureFileActions')
const { getLiveStructure } = require('../../structure/structureLiveAccess')

const attachHandlers = (root, ctl) => {
  if (!root || !ctl || typeof ctl.callback !== 'function') return
  const cb = ctl.callback

  const exportBtn = root.querySelector('[data-struct-export]')
  if (exportBtn) {
    exportBtn.onclick = (e) => {
      e.preventDefault()
      downloadStructureJson(getLiveStructure())
    }
  }

  const importBtn = root.querySelector('[data-struct-import]')
  if (importBtn) {
    importBtn.onclick = (e) => {
      e.preventDefault()
      pickStructureJsonFile((result) => {
        if (!result.ok) {
          if (result.error && result.error !== 'No file selected') {
            window.alert(result.error)
          }
          return
        }
        cb({ op: 'importStructure', structure: result.structure })
      })
    }
  }

  const clearPanel = root.querySelector('[data-struct-clear-panel]')
  const clearAllBtn = root.querySelector('[data-struct-clear-all]')
  const clearConfirmBtn = root.querySelector('[data-struct-clear-confirm]')
  const clearCancelBtn = root.querySelector('[data-struct-clear-cancel]')

  const setClearConfirmVisible = (show) => {
    if (!clearPanel) return
    if (show) {
      clearPanel.removeAttribute('hidden')
    } else {
      clearPanel.setAttribute('hidden', '')
    }
    if (clearAllBtn) clearAllBtn.hidden = !!show
  }

  if (clearAllBtn) {
    clearAllBtn.onclick = (e) => {
      e.preventDefault()
      setClearConfirmVisible(true)
    }
  }
  if (clearCancelBtn) {
    clearCancelBtn.onclick = (e) => {
      e.preventDefault()
      setClearConfirmVisible(false)
    }
  }
  if (clearConfirmBtn) {
    clearConfirmBtn.onclick = (e) => {
      e.preventDefault()
      setClearConfirmVisible(false)
      cb({ op: 'clearStructure' })
    }
  }

  root.querySelectorAll('[data-struct-op]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      const op = btn.getAttribute('data-struct-op')
      if (op === 'addNode') cb({ op: 'addNode' })
      if (op === 'addElement') cb({ op: 'addElement' })
      if (op === 'addMaterial') cb({ op: 'addMaterial' })
      if (op === 'addSection') cb({ op: 'addSection' })
      if (op === 'addRestraint') cb({ op: 'addRestraint', payload: { nodeId: btn.getAttribute('data-node-id') } })
      if (op === 'addRelease') cb({ op: 'addRelease', payload: { elementId: btn.getAttribute('data-element-id') } })
      if (op === 'addNodalLoad') cb({ op: 'addNodalLoad' })
      if (op === 'addDistributedLoad') cb({ op: 'addDistributedLoad' })
    }
  })

  root.querySelectorAll('[data-struct-op="runFemAnalysis"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'runFemAnalysis' })
    }
  })

  root.querySelectorAll('[data-struct-modal]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      cb({ op: 'setStructuresModal', modal: btn.getAttribute('data-struct-modal') })
    }
  })

  root.querySelectorAll('[data-struct-modal-close]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'setStructuresModal', modal: null })
    }
  })

  const backdrop = root.querySelector('.structures-modal-backdrop')
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) cb({ op: 'setStructuresModal', modal: null })
    }
  }

  root.querySelectorAll('[data-boundaries-tab]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'setBoundariesTab', tab: btn.getAttribute('data-boundaries-tab') })
    }
  })

  root.querySelectorAll('[data-properties-tab]').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'setPropertiesTab', tab: btn.getAttribute('data-properties-tab') })
    }
  })

  const show3d = root.querySelector('#displayShow3dMembers')
  if (show3d) show3d.onchange = () => cb({ op: 'setShow3dMembers', value: show3d.checked })

  root.querySelectorAll('.struct-remove-node').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeNode', nodeId: btn.getAttribute('data-node-id') })
    }
  })
  root.querySelectorAll('.struct-remove-element').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeElement', elementId: btn.getAttribute('data-element-id') })
    }
  })
  root.querySelectorAll('.struct-remove-restraint').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeRestraint', id: btn.getAttribute('data-id') })
    }
  })
  root.querySelectorAll('.struct-remove-release').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeRelease', id: btn.getAttribute('data-id') })
    }
  })
  root.querySelectorAll('.struct-remove-material').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeMaterial', matId: btn.getAttribute('data-mat-id') })
    }
  })
  root.querySelectorAll('.struct-remove-section').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeSection', secId: btn.getAttribute('data-sec-id') })
    }
  })
  root.querySelectorAll('.struct-remove-nload').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeNodalLoad', id: btn.getAttribute('data-id') })
    }
  })
  root.querySelectorAll('.struct-remove-dload').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault()
      cb({ op: 'removeDistributedLoad', id: btn.getAttribute('data-id') })
    }
  })

  const readNodeRow = (tr) => {
    const id = Number(tr.getAttribute('data-node-id'))
    let x = 0; let y = 0; let z = 0
    tr.querySelectorAll('.struct-node-in').forEach((inp) => {
      const axis = inp.getAttribute('data-axis')
      const v = Number(inp.value)
      if (axis === 'x') x = v
      if (axis === 'y') y = v
      if (axis === 'z') z = v
    })
    return { id, x, y, z }
  }

  root.querySelectorAll('.struct-node-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      cb({ op: 'updateNode', payload: readNodeRow(tr) })
    }
  })

  root.querySelectorAll('.struct-elem-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      const id = Number(tr.getAttribute('data-element-id'))
      const iInp = tr.querySelector('[data-k="iNode"]')
      const jInp = tr.querySelector('[data-k="jNode"]')
      const matInp = tr.querySelector('[data-k="matId"]')
      const secInp = tr.querySelector('[data-k="secId"]')
      cb({
        op: 'updateElement',
        payload: {
          id,
          iNode: Number(iInp && iInp.value),
          jNode: Number(jInp && jInp.value),
          matId: matInp && matInp.value,
          secId: secInp && secInp.value
        }
      })
    }
  })

  root.querySelectorAll('.struct-mat-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      const matId = tr.getAttribute('data-mat-id')
      const w = tr.querySelector('[data-k="w"]')
      const E = tr.querySelector('[data-k="E"]')
      const G = tr.querySelector('[data-k="G"]')
      cb({
        op: 'updateMaterial',
        payload: {
          matId,
          w: Number(w && w.value),
          E: Number(E && E.value),
          G: Number(G && G.value)
        }
      })
    }
  })

  root.querySelectorAll('.struct-sec-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      const secId = tr.getAttribute('data-sec-id')
      const type = tr.querySelector('[data-k="type"]')
      const b = tr.querySelector('[data-k="b"]')
      const H = tr.querySelector('[data-k="H"]')
      const tw = tr.querySelector('[data-k="tw"]')
      const tf = tr.querySelector('[data-k="tf"]')
      const r = tr.querySelector('[data-k="r"]')
      cb({
        op: 'updateSection',
        payload: {
          secId,
          type: type && type.value,
          b: Number(b && b.value),
          H: Number(H && H.value),
          tw: Number(tw && tw.value),
          tf: Number(tf && tf.value),
          r: Number(r && r.value)
        }
      })
    }
  })

  const readRestraintDofsFromRow = (tr) =>
    DOF_LABELS.map((_, i) => {
      const c = tr.querySelector(`[data-dof="${i}"]`)
      return !!(c && c.checked)
    })

  const applyPresetToRestraintRow = (tr, presetVal) => {
    const tuple = dofsForPreset(presetVal)
    if (!tuple) return
    DOF_LABELS.forEach((_, i) => {
      const c = tr.querySelector(`[data-dof="${i}"]`)
      if (c) c.checked = !!tuple[i]
    })
  }

  const fireRestraintRow = (tr) => {
    const nodeId = Number(tr.getAttribute('data-node-id'))
    const dofs = readRestraintDofsFromRow(tr)
    const presetSel = tr.querySelector('[data-k="preset"]')
    const preset = isFreeDofs(dofs)
      ? 'free'
      : (presetSel && presetSel.value === 'custom' ? 'custom' : inferPresetFromDofs(dofs))
    if (presetSel && preset !== 'custom') presetSel.value = preset
    cb({ op: 'addRestraint', payload: { nodeId, preset, dofs } })
  }

  root.querySelectorAll('.struct-restraint-in[data-k="preset"]').forEach((sel) => {
    sel.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      applyPresetToRestraintRow(tr, ev.target.value)
      fireRestraintRow(tr)
    }
  })

  root.querySelectorAll('.struct-restraint-in[data-dof]').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      const dofs = readRestraintDofsFromRow(tr)
      const presetSel = tr.querySelector('[data-k="preset"]')
      if (presetSel) presetSel.value = inferPresetFromDofs(dofs)
      fireRestraintRow(tr)
    }
  })

  root.querySelectorAll('.struct-release-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      const elementId = Number(tr.getAttribute('data-element-id'))
      const releaseId = Number(tr.getAttribute('data-release-id'))
      const end = tr.querySelector('[data-k="end"]')
      const endVal = end && end.value
      if (endVal === 'start' || endVal === 'end' || endVal === 'both') {
        cb({ op: 'addRelease', payload: { elementId, end: endVal } })
      }
    }
  })

  root.querySelectorAll('.struct-nload-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      const id = Number(tr.getAttribute('data-id'))
      const payload = { id, nodeId: Number(tr.querySelector('[data-k="nodeId"]').value) }
      ;['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].forEach((k) => {
        const el = tr.querySelector(`[data-k="${k}"]`)
        payload[k] = Number(el && el.value) || 0
      })
      cb({ op: 'updateNodalLoad', payload })
    }
  })

  root.querySelectorAll('.struct-dload-in').forEach((inp) => {
    inp.onchange = (ev) => {
      const tr = ev.target.closest('tr')
      if (!tr) return
      cb({
        op: 'updateDistributedLoad',
        payload: {
          id: Number(tr.getAttribute('data-id')),
          elementId: Number(tr.querySelector('[data-k="elementId"]').value),
          qy: Number(tr.querySelector('[data-k="qy"]').value) || 0
        }
      })
    }
  })
}

module.exports = attachHandlers
