/** Portal on document.body so modals sit above WebGL canvas. */
const getStructuresModalLayer = () => {
  const id = 'structures-modal-layer'
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.className = 'structures-modal-layer'
    document.body.appendChild(el)
  }
  return el
}

module.exports = { getStructuresModalLayer }
