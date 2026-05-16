const SVG_NS = 'http://www.w3.org/2000/svg'

/** Screen-space ring radius (px), fixed like restraint glyphs. */
const RELEASE_GLYPH_R = 5.5

/** Inset from joint toward member interior along screen chord (px). */
const RELEASE_INSET_PX = 6

const DEFAULT_STYLE = {
  fill: 'none',
  stroke: 'rgba(84, 88, 94, 0.94)',
  strokeWidth: '1.75'
}

const applyRingStyle = (el, style) => {
  const st = Object.assign({}, DEFAULT_STYLE, style)
  el.setAttribute('fill', st.fill)
  el.setAttribute('stroke', st.stroke)
  el.setAttribute('stroke-width', st.strokeWidth)
  el.setAttribute('vector-effect', 'non-scaling-stroke')
  el.setAttribute('shape-rendering', 'geometricPrecision')
  el.setAttribute('pointer-events', 'none')
}

const drawReleaseRing = (parent, px, py, style, r = RELEASE_GLYPH_R) => {
  const circle = document.createElementNS(SVG_NS, 'circle')
  circle.setAttribute('cx', String(px))
  circle.setAttribute('cy', String(py))
  circle.setAttribute('r', String(r))
  applyRingStyle(circle, style)
  parent.appendChild(circle)
}

/**
 * Mz release markers at element ends (steel-girder: hollow rings inset along member).
 * @param {SVGElement} parent
 * @param {[number,number]} pa screen px at i-node
 * @param {[number,number]} pb screen px at j-node
 * @param {'start'|'end'|'both'} end
 * @param {object} [style]
 */
const drawReleaseGlyphsForElement = (parent, pa, pb, end, style) => {
  if (!pa || !pb) return
  const dx = pb[0] - pa[0]
  const dy = pb[1] - pa[1]
  const len = Math.hypot(dx, dy)
  const ux = len > 1e-6 ? dx / len : 1
  const uy = len > 1e-6 ? dy / len : 0

  if (end === 'start' || end === 'both') {
    drawReleaseRing(parent, pa[0] + ux * RELEASE_INSET_PX, pa[1] + uy * RELEASE_INSET_PX, style)
  }
  if (end === 'end' || end === 'both') {
    drawReleaseRing(parent, pb[0] - ux * RELEASE_INSET_PX, pb[1] - uy * RELEASE_INSET_PX, style)
  }
}

const normalizeReleaseEnd = (end) => {
  if (end === 'start' || end === 'end' || end === 'both') return end
  return null
}

module.exports = {
  drawReleaseGlyphsForElement,
  drawReleaseRing,
  normalizeReleaseEnd,
  DEFAULT_STYLE,
  RELEASE_GLYPH_R,
  RELEASE_INSET_PX
}
