const defaultStructure = require('./defaultStructure')
const { sectionToFemProps, sectionTypeToProfile } = require('./sectionToFemProps')
const structureView = require('./structureView')
const structureFemAdapter = require('./structureFemAdapter')
const structureToFemLoads = require('./structureToFemLoads')

module.exports = {
  defaultStructure,
  sectionToFemProps,
  sectionTypeToProfile,
  ...structureView,
  ...structureFemAdapter,
  structureToFemLoads
}
