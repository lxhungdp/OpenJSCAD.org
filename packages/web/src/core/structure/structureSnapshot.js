const defaultStructure = require('./defaultStructure')

const FORMAT = 'jscad-structure'
const VERSION = 1

const PERSIST_KEYS = [
  'nodes',
  'elements',
  'materials',
  'sections',
  'restraints',
  'releases',
  'loads',
  'nextNodeId',
  'nextElementId',
  'nextMatId',
  'nextSecId',
  'nextRestraintId',
  'nextReleaseId',
  'nextNodalLoadId',
  'nextDistributedLoadId',
  'show3dMembers',
  'structuresModal',
  'structuresView',
  'boundariesTab',
  'propertiesTab'
]

const cloneRow = (row) => Object.assign({}, row)

const pickPersistedStructure = (structure) => {
  const base = defaultStructure()
  const s = structure && typeof structure === 'object' ? structure : {}
  const out = {}

  for (const key of PERSIST_KEYS) {
    if (key === 'loads') {
      const loads = s.loads && typeof s.loads === 'object' ? s.loads : base.loads
      out.loads = {
        nodal: Array.isArray(loads.nodal) ? loads.nodal.map(cloneRow) : [],
        distributed: Array.isArray(loads.distributed) ? loads.distributed.map(cloneRow) : []
      }
      continue
    }
    if (Array.isArray(base[key])) {
      out[key] = Array.isArray(s[key]) ? s[key].map(cloneRow) : []
      continue
    }
    out[key] = s[key] !== undefined ? s[key] : base[key]
  }

  return out
}

const normalizeImportedStructure = (raw) => {
  const base = defaultStructure()
  const src = raw && typeof raw === 'object' ? raw : {}
  const merged = Object.assign({}, base, pickPersistedStructure(src))
  if (src.loads && typeof src.loads === 'object') {
    merged.loads = {
      nodal: Array.isArray(src.loads.nodal) ? src.loads.nodal : [],
      distributed: Array.isArray(src.loads.distributed) ? src.loads.distributed : []
    }
  }
  return merged
}

const validateStructure = (structure) => {
  if (!structure || typeof structure !== 'object') {
    return { ok: false, error: 'Missing structure object' }
  }
  if (!Array.isArray(structure.nodes)) {
    return { ok: false, error: 'structure.nodes must be an array' }
  }
  if (!Array.isArray(structure.elements)) {
    return { ok: false, error: 'structure.elements must be an array' }
  }
  if (!Array.isArray(structure.materials)) {
    return { ok: false, error: 'structure.materials must be an array' }
  }
  if (!Array.isArray(structure.sections)) {
    return { ok: false, error: 'structure.sections must be an array' }
  }
  if (!structure.loads || typeof structure.loads !== 'object') {
    return { ok: false, error: 'structure.loads is required' }
  }
  return { ok: true, structure: normalizeImportedStructure(structure) }
}

/**
 * @param {object} structure — app structure model
 * @returns {string}
 */
const serializeStructureFile = (structure) => {
  const payload = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    structure: pickPersistedStructure(structure)
  }
  return JSON.stringify(payload, null, 2)
}

/**
 * @param {string} text
 * @returns {{ ok: true, structure: object } | { ok: false, error: string }}
 */
const parseStructureFile = (text) => {
  let root
  try {
    root = JSON.parse(String(text == null ? '' : text))
  } catch (e) {
    return { ok: false, error: 'Invalid JSON file' }
  }

  if (!root || typeof root !== 'object') {
    return { ok: false, error: 'Empty or invalid file' }
  }

  let structure = root.structure
  if (!structure && Array.isArray(root.nodes)) {
    structure = root
  }

  if (root.format && root.format !== FORMAT) {
    return { ok: false, error: `Unsupported format: ${root.format}` }
  }

  if (root.version != null && Number(root.version) > VERSION) {
    return { ok: false, error: `Unsupported file version: ${root.version}` }
  }

  return validateStructure(structure)
}

/** Payload stored in localStorage (structure fields only). */
const snapshotForCache = (structure) => ({
  structure: pickPersistedStructure(structure)
})

const structureFromCache = (cached) => {
  if (!cached || typeof cached !== 'object') return null
  const structure = cached.structure || cached
  const v = validateStructure(structure)
  return v.ok ? v.structure : null
}

module.exports = {
  FORMAT,
  VERSION,
  PERSIST_KEYS,
  pickPersistedStructure,
  serializeStructureFile,
  parseStructureFile,
  snapshotForCache,
  structureFromCache,
  normalizeImportedStructure
}
