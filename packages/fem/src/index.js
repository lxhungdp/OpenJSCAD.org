const analyzeStructure = require('./analyzeStructure')

module.exports = {
  analyzeStructure,
  getPositionsAndForces: require('./solver/getPositionsAndForces.bundle').getPositionsAndForces
}
