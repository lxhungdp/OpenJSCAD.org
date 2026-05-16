/**
 * One grid layer (major or minor). Used as separate entities so each pass gets full props (incl. model).
 * @param {0|1} layerIndex 0 = major ticks, 1 = minor ticks
 */
module.exports = (layerIndex) => (regl, entity) => {
  const size = entity.size || [50, 50]
  const ticks = Array.isArray(entity.ticks) ? entity.ticks : [10, 1]
  const tick = ticks[layerIndex]
  const draw = require('./index')(regl, { size, ticks: tick })
  return (props) => {
    const p = Object.assign({}, props)
    if (layerIndex === 1 && props.subColor != null) {
      p.color = props.subColor
    }
    draw(p)
  }
}
