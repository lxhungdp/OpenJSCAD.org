const { serializeStructureFile, parseStructureFile } = require('../../../core/structure/structureSnapshot')

const downloadStructureJson = (structure) => {
  const text = serializeStructureFile(structure)
  const blob = new Blob([text], { type: 'application/json' })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `structure-${stamp}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

const pickStructureJsonFile = (onDone) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.style.display = 'none'
  document.body.appendChild(input)
  input.addEventListener('change', () => {
    const file = input.files && input.files[0]
    document.body.removeChild(input)
    if (!file) {
      onDone({ ok: false, error: 'No file selected' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseStructureFile(reader.result)
      onDone(parsed)
    }
    reader.onerror = () => onDone({ ok: false, error: 'Could not read file' })
    reader.readAsText(file)
  })
  input.click()
}

module.exports = {
  downloadStructureJson,
  pickStructureJsonFile
}
