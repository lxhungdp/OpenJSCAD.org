const {
  serializeStructureFile,
  parseStructureFile,
  snapshotForCache,
  structureFromCache
} = require('./structureSnapshot')
const defaultStructure = require('./defaultStructure')

const sample = () => {
  const s = defaultStructure()
  s.nodes = [{ id: 1, x: 0, y: 0, z: 0 }]
  s.elements = [{ id: 1, iNode: 1, jNode: 1, matId: 'mat1', secId: 'sec1' }]
  s.structuresModal = 'node'
  return s
}

describe('structureSnapshot', () => {
  test('round-trip export/import', () => {
    const s = sample()
    const text = serializeStructureFile(s)
    const parsed = parseStructureFile(text)
    const file = JSON.parse(text)
    expect(parsed.ok).toBe(true)
    expect(parsed.structure.nodes).toEqual(s.nodes)
    expect(parsed.structure.structuresModal).toBe('node')
    expect(file.structure.nodes[0]).toMatchObject({ id: 1, x: 0, y: 0, z: 0 })
    expect(file.structure.elements[0]).toMatchObject({
      id: 1, iNode: 1, jNode: 1, matId: 'mat1', secId: 'sec1'
    })
    expect(Array.isArray(file.structure.materials)).toBe(true)
    expect(Array.isArray(file.structure.restraints)).toBe(true)
    expect(file.structure.loads).toBeDefined()
  })

  test('export always includes all model sections', () => {
    const text = serializeStructureFile(defaultStructure())
    const file = JSON.parse(text)
    expect(file.structure.nodes).toEqual([])
    expect(file.structure.elements).toEqual([])
    expect(file.structure.materials.length).toBeGreaterThan(0)
    expect(file.structure.sections.length).toBeGreaterThan(0)
    expect(file.structure.loads.nodal).toEqual([])
  })

  test('cache snapshot restores modal', () => {
    const s = sample()
    s.structuresModal = 'element'
    const cached = snapshotForCache(s)
    const restored = structureFromCache(cached)
    expect(restored.structuresModal).toBe('element')
  })
})
