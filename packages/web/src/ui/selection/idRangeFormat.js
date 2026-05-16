/**
 * Format sorted numeric ids as "1 3 5-10" (runs of consecutive ids use a hyphen).
 * @param {Iterable<number|string>} ids
 * @returns {string}
 */
const formatIdRanges = (ids) => {
  const sorted = [...new Set([...ids].map((x) => Number(x)).filter((n) => isFinite(n)))].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  const parts = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    if (j > i) parts.push(`${sorted[i]}-${sorted[j]}`)
    else parts.push(String(sorted[i]))
    i = j + 1
  }
  return parts.join(' ')
}

/**
 * Parse "1 3 5-10" into sorted unique positive integers (invalid tokens skipped).
 * @param {string} str
 * @returns {number[]}
 */
const parseIdsFromRangeString = (str) => {
  const raw = String(str || '').trim()
  if (!raw) return []
  const tokens = raw.split(/\s+/).filter(Boolean)
  const out = new Set()
  for (const tok of tokens) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(tok)
    if (range) {
      let a = Number(range[1])
      let b = Number(range[2])
      if (!isFinite(a) || !isFinite(b)) continue
      if (a > b) {
        const t = a
        a = b
        b = t
      }
      for (let k = a; k <= b; k++) out.add(k)
      continue
    }
    if (/^\d+$/.test(tok)) {
      const n = Number(tok)
      if (isFinite(n)) out.add(n)
    }
  }
  return [...out].sort((x, y) => x - y)
}

module.exports = { formatIdRanges, parseIdsFromRangeString }
