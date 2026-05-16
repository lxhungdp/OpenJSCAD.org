const makeDrawMultiGrid = (regl, params) => {
  const defaults = {
    size: [50, 50],
    ticks: [10, 1]
  }
  const { size, ticks } = Object.assign({}, defaults, params)
  const drawMainGrid = require('./index')(regl, { size, ticks: ticks[0] })
  const drawSubGrid = require('./index')(regl, { size, ticks: ticks[1] })
  const drawGrid = (props) => {
    const model = props && props.model
    const shared = {
      model,
      fadeOut: props.fadeOut,
      lineWidth: props.lineWidth
    }
    drawMainGrid(Object.assign({}, props, shared, { polygonOffsetUnits: 1 }))
    drawSubGrid(Object.assign({}, props, shared, {
      color: props.subColor,
      polygonOffsetUnits: -1
    }))
  }
  return drawGrid
}

module.exports = makeDrawMultiGrid
