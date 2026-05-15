const { getPositionsAndForces } = require('./solver/getPositionsAndForces.bundle')
const {
  structureToFemSnapshot,
  structureToFemLoads
} = require('@jscad/structure')

/**
 * Linear static 3D frame analysis (6 DOF per node).
 * @param {object} structure - JSCAD structure model
 * @param {{ sparse?: boolean, cache?: object }} [options]
 * @returns {{ ok: boolean, error?: string, positions?, displacements?, reactions?, internalForces?, cache? }}
 */
const analyzeStructure = (structure, options = {}) => {
  if (!structure || !structure.nodes || !structure.elements) {
    return { ok: false, error: 'Invalid structure model' }
  }

  const snap = structureToFemSnapshot(structure)
  const { mesh, supports, releases, elementsProps, nodeIdToIndex } = snap

  if (mesh.nodes.length === 0 || mesh.elements.length === 0) {
    return { ok: false, error: 'Model has no nodes or elements' }
  }

  let hasSupport = false
  supports.forEach((s) => {
    if (s.some(Boolean)) hasSupport = true
  })
  if (!hasSupport) {
    return { ok: false, error: 'No supports — add at least one restraint' }
  }

  const loads = structureToFemLoads(structure, nodeIdToIndex)
  const backend = options.sparse ? 'mathjs-sparse-global' : 'mathjs-dense-legacy'

  try {
    const result = getPositionsAndForces(
      mesh.nodes,
      mesh.elements,
      loads,
      supports,
      elementsProps,
      releases,
      { cache: options.cache || null, linearSolverBackend: backend }
    )

    return {
      ok: true,
      positions: result.positions,
      displacements: result.displacements,
      reactions: result.reactions,
      internalForces: result.internalForces,
      cache: result.cache,
      mesh
    }
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    }
  }
}

module.exports = analyzeStructure
