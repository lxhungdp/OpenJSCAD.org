/**
 * Global structural model (FEM-ready). Geometry + properties + boundaries + loads.
 */

const defaultStructure = () => ({
  nodes: [],
  elements: [],
  materials: [
    { matId: 'mat1', w: 0, E: 32836000, G: 12628000 }
  ],
  sections: [
    { secId: 'sec1', type: 'rec', b: 2, H: 2, tw: 0.2, tf: 0.25, r: 1 }
  ],
  restraints: [],
  releases: [],
  loads: {
    nodal: [],
    distributed: []
  },
  nextNodeId: 1,
  nextElementId: 1,
  nextMatId: 2,
  nextSecId: 2,
  nextRestraintId: 1,
  nextReleaseId: 1,
  nextNodalLoadId: 1,
  nextDistributedLoadId: 1,
  show3dMembers: false,
  /** Open modal: null | node | element | boundaries | properties | load | display */
  structuresModal: null,
  /** Active Structures panel: node | element | boundaries | properties | load | display */
  structuresView: 'node',
  /** boundaries sub-tab: restraint | release */
  boundariesTab: 'restraint',
  /** properties sub-tab: material | sectional */
  propertiesTab: 'material'
})

module.exports = defaultStructure
