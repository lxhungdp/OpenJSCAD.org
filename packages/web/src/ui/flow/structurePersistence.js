const most = require('most')

const { holdUntil, withLatestFrom } = require('../../most-utils')
const { snapshotForCache, structureFromCache } = require('../../core/structure/structureSnapshot')

const STORE_KEY = 'structure'

const applyCachedStructure = (state, cached) => {
  const structure = structureFromCache(cached)
  if (!structure) return state
  return Object.assign({}, state, {
    structure,
    femResult: null,
    femCache: null,
    femRaw: null
  })
}

const pickCachePayload = (state) => {
  if (!state.structure) return null
  return snapshotForCache(state.structure)
}

const actions = ({ sources }) => {
  const requestLoad$ = sources.state
    .filter((s) => s.viewer && s.structure)
    .take(1)
    .map(() => ({ sink: 'store', key: STORE_KEY, type: 'read' }))

  const applyLoaded$ = sources.store
    .filter((reply) => reply.key === STORE_KEY && reply.type === 'read')
    .map((reply) => reply.data)
    .filter((data) => data && (data.structure || data.nodes))
    .thru(withLatestFrom(applyCachedStructure, sources.state))
    .map((state) => ({ type: 'structureCacheLoaded', sink: 'state', state }))
    .take(1)

  const requestSave$ = sources.state
    .filter((s) => s.structure && Array.isArray(s.structure.nodes))
    .map(pickCachePayload)
    .filter(Boolean)
    .thru(holdUntil(sources.store.filter((r) => r.key === STORE_KEY && r.type === 'read')))
    .skipRepeatsWith((a, b) => JSON.stringify(a) === JSON.stringify(b))
    .map((data) => ({ sink: 'store', key: STORE_KEY, type: 'write', data }))

  return { requestLoad$, applyLoaded$, requestSave$ }
}

module.exports = actions
