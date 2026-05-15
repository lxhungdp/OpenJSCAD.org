/**
 * Vite entry (ESM) — same pattern as a minimal Vite app (e.g. steel_bridge: index.html + type="module" entry).
 * Bootstraps the legacy CJS app in src/index.js.
 */
import '../css/demo.css'
import '../css/structures-dock.css'
import '../css/codemirror.css'

import makeJscad from './index.js'

function showBootError(err) {
  const pre = document.createElement('pre')
  pre.style.cssText =
    'box-sizing:border-box;margin:0;padding:16px;min-height:100vh;background:#fff;color:#b91c1c;font:14px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word'
  pre.textContent =
    err && err.stack
      ? err.stack
      : (err && err.message) || String(err)
  document.body.replaceChildren(pre)
}

const rootEl = document.createElement('div')
document.body.appendChild(rootEl)
rootEl.className = 'wrapper'

const el1 = document.createElement('div')
el1.className = 'jscad1'
rootEl.appendChild(el1)

;(async () => {
  try {
    // makeJscad is async — must await or failures inside become unhandled rejections (blank page).
    await makeJscad(el1, { name: 'jscad1', logging: false })
  } catch (err) {
    console.error(err)
    showBootError(err)
  }
})()

window.addEventListener('beforeunload', (event) => {
  event.preventDefault()
  event.returnValue = ''
})
