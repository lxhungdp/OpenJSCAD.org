const { glyphKindForRestraint } = require('./restraintDofs')

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Single size D (px): circle radius; triangle height = 2·D. */
const RESTRAINT_GLYPH_D = 9

const glyphMetrics = (D = RESTRAINT_GLYPH_D) => ({
  D,
  circleRadius: D,
  pyramidHeight: D * 2,
  pyramidHalfWidth: D,
  groundLineExtend: D / 3,
  fixedWidth: D * 3
})

const DEFAULT_STYLE = {
  fill: 'rgba(84, 88, 94, 0.94)',
  stroke: 'rgba(84, 88, 94, 0.94)',
  strokeWidth: '1.5'
}

const GROUND_LINE_WIDTH = '2.5'

const applyFilledShapeStyle = (el, style) => {
  const st = Object.assign({}, DEFAULT_STYLE, style)
  el.setAttribute('fill', st.fill)
  el.setAttribute('stroke', st.stroke)
  el.setAttribute('stroke-width', st.strokeWidth)
  el.setAttribute('vector-effect', 'non-scaling-stroke')
  el.setAttribute('shape-rendering', 'geometricPrecision')
  el.setAttribute('pointer-events', 'none')
}

const drawGroundLine = (parent, px, py, halfWidth, extend, style) => {
  const st = Object.assign({}, DEFAULT_STYLE, style)
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('x1', String(px - halfWidth - extend))
  line.setAttribute('y1', String(py))
  line.setAttribute('x2', String(px + halfWidth + extend))
  line.setAttribute('y2', String(py))
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', st.stroke)
  line.setAttribute('stroke-width', GROUND_LINE_WIDTH)
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('vector-effect', 'non-scaling-stroke')
  parent.appendChild(line)
}

const drawVerticalBar = (parent, x, y0, y1, style) => {
  const st = Object.assign({}, DEFAULT_STYLE, style)
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('x1', String(x))
  line.setAttribute('y1', String(y0))
  line.setAttribute('x2', String(x))
  line.setAttribute('y2', String(y1))
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', st.stroke)
  line.setAttribute('stroke-width', GROUND_LINE_WIDTH)
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('vector-effect', 'non-scaling-stroke')
  parent.appendChild(line)
}

/** Fixed — filled rectangle (steel-girder drawFixedSupport). */
const drawFixedGlyph = (parent, px, py, style, D = RESTRAINT_GLYPH_D) => {
  const m = glyphMetrics(D)
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', String(px - m.fixedWidth / 2))
  rect.setAttribute('y', String(py))
  rect.setAttribute('width', String(m.fixedWidth))
  rect.setAttribute('height', String(m.pyramidHeight))
  applyFilledShapeStyle(rect, style)
  parent.appendChild(rect)
}

/** Pinned — triangle + ground line at base. */
const drawPyramidGlyph = (parent, px, py, style, D = RESTRAINT_GLYPH_D) => {
  const m = glyphMetrics(D)
  const baseY = py + m.pyramidHeight
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute(
    'd',
    `M ${px} ${py} L ${px - m.pyramidHalfWidth} ${baseY} L ${px + m.pyramidHalfWidth} ${baseY} Z`
  )
  applyFilledShapeStyle(path, style)
  parent.appendChild(path)
  drawGroundLine(parent, px, baseY, m.pyramidHalfWidth, m.groundLineExtend, style)
}

/** Hor. roller (Uy+Uz) — circle, top at node, horizontal ground line. */
const drawHorRollerGlyph = (parent, px, py, style, D = RESTRAINT_GLYPH_D) => {
  const m = glyphMetrics(D)
  const r = m.circleRadius
  const baseY = py + r * 2
  const circle = document.createElementNS(SVG_NS, 'circle')
  circle.setAttribute('cx', String(px))
  circle.setAttribute('cy', String(py + r))
  circle.setAttribute('r', String(r))
  applyFilledShapeStyle(circle, style)
  parent.appendChild(circle)
  drawGroundLine(parent, px, baseY, r, m.groundLineExtend, style)
}

/**
 * Ver. roller (Ux+Uz) — node at leftmost point of circle; vertical bar on right (steel-girder).
 */
const drawVerRollerGlyph = (parent, px, py, style, D = RESTRAINT_GLYPH_D) => {
  const m = glyphMetrics(D)
  const r = m.circleRadius
  const cx = px + r
  const cy = py
  const circle = document.createElementNS(SVG_NS, 'circle')
  circle.setAttribute('cx', String(cx))
  circle.setAttribute('cy', String(cy))
  circle.setAttribute('r', String(r))
  applyFilledShapeStyle(circle, style)
  parent.appendChild(circle)
  const barX = px + 2 * r
  const barHalf = r + m.groundLineExtend
  drawVerticalBar(parent, barX, cy - barHalf, cy + barHalf, style)
}

/** Others — pentagon: apex at node, flat base below, total height D. */
const drawOthersGlyph = (parent, px, py, style, D = RESTRAINT_GLYPH_D) => {
  const m = glyphMetrics(D)
  const h = m.D
  const baseY = py + h
  const halfBase = m.pyramidHalfWidth
  const shoulder = halfBase * 0.58
  const shoulderY = py + h * 0.42
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute(
    'd',
    `M ${px} ${py}` +
    ` L ${px - shoulder} ${shoulderY}` +
    ` L ${px - halfBase} ${baseY}` +
    ` L ${px + halfBase} ${baseY}` +
    ` L ${px + shoulder} ${shoulderY} Z`
  )
  applyFilledShapeStyle(path, style)
  parent.appendChild(path)
  drawGroundLine(parent, px, baseY, halfBase, m.groundLineExtend, style)
}

const drawRestraintGlyph = (parent, restraint, px, py, style, D = RESTRAINT_GLYPH_D) => {
  const kind = glyphKindForRestraint(restraint)
  switch (kind) {
    case 'fixed':
      drawFixedGlyph(parent, px, py, style, D)
      return true
    case 'pyramid':
      drawPyramidGlyph(parent, px, py, style, D)
      return true
    case 'hor-roller':
      drawHorRollerGlyph(parent, px, py, style, D)
      return true
    case 'ver-roller':
      drawVerRollerGlyph(parent, px, py, style, D)
      return true
    case 'others':
      drawOthersGlyph(parent, px, py, style, D)
      return true
    default:
      return false
  }
}

module.exports = {
  drawRestraintGlyph,
  drawFixedGlyph,
  drawPyramidGlyph,
  drawHorRollerGlyph,
  drawVerRollerGlyph,
  drawOthersGlyph,
  glyphKindForRestraint,
  glyphMetrics,
  DEFAULT_STYLE,
  RESTRAINT_GLYPH_D
}
