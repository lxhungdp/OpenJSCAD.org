/**
 * Allocate numeric ids from the smallest unused positive integer(s).
 * @param {number[]} usedIds - ids already taken
 * @param {number} [count=1]
 * @returns {number[]}
 */
const generateIds = (usedIds, count = 1) => {
  const n = Math.max(1, Number(count) || 1)
  const used = new Set(
    (usedIds || []).map(Number).filter((id) => isFinite(id) && id > 0)
  )
  const ids = []
  let cursor = 1
  while (ids.length < n) {
    while (used.has(cursor)) cursor += 1
    ids.push(cursor)
    used.add(cursor)
    cursor += 1
  }
  return ids
}

/** @param {number[]} usedIds */
const generateId = (usedIds) => generateIds(usedIds, 1)[0]

module.exports = {
  generateId,
  generateIds
}
