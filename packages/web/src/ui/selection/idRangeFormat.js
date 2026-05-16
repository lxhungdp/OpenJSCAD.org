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

module.exports = { formatIdRanges }
