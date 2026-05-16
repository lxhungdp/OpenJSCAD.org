const NODAL_LOAD_KEYS = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz']
const DISTRIB_LOAD_KEYS = ['qx', 'qy', 'qz']

const isNonZero = (v) => {
  const n = Number(v)
  return isFinite(n) && n !== 0
}

const hasNodalLoad = (row) =>
  !!row && NODAL_LOAD_KEYS.some((k) => isNonZero(row[k]))

const hasDistributedLoad = (row) =>
  !!row && DISTRIB_LOAD_KEYS.some((k) => isNonZero(row[k]))

const nodalLoadIsEmpty = (row) => !hasNodalLoad(row)

const distributedLoadIsEmpty = (row) => !hasDistributedLoad(row)

const activeDistribAxes = (row) =>
  DISTRIB_LOAD_KEYS.filter((k) => isNonZero(row && row[k]))

module.exports = {
  NODAL_LOAD_KEYS,
  DISTRIB_LOAD_KEYS,
  hasNodalLoad,
  hasDistributedLoad,
  nodalLoadIsEmpty,
  distributedLoadIsEmpty,
  activeDistribAxes,
  isNonZero
}
