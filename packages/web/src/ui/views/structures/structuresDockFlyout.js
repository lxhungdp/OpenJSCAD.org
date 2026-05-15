/** Hover flyout for structures dock (from steel-girder viewerLeftDockFlyout). */
const attachHoverFlyout = (group, trigger, panel) => {
  panel.setAttribute('inert', '')

  let leaveTimer = null

  const setOpen = (open) => {
    if (open) {
      group.classList.add('structures-dock__group--open')
      panel.removeAttribute('inert')
      trigger.setAttribute('aria-expanded', 'true')
    } else {
      group.classList.remove('structures-dock__group--open')
      panel.setAttribute('inert', '')
      trigger.setAttribute('aria-expanded', 'false')
    }
  }

  setOpen(false)

  group.addEventListener('mouseenter', () => {
    if (leaveTimer != null) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    setOpen(true)
  })

  group.addEventListener('mouseleave', () => {
    leaveTimer = setTimeout(() => {
      leaveTimer = null
      setOpen(false)
    }, 140)
  })

  group.addEventListener('focusin', () => {
    if (leaveTimer != null) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    setOpen(true)
  })

  group.addEventListener('focusout', (e) => {
    const next = e.relatedTarget
    if (next && group.contains(next)) return
    leaveTimer = setTimeout(() => {
      leaveTimer = null
      setOpen(false)
    }, 140)
  })
}

module.exports = attachHoverFlyout
