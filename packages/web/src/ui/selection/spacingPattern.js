/**
 * Parse Midas-style spacing pattern: "3 4 2@5", "-2 -3", "a 4@b" → list of step increments.
 * @param {string} raw
 * @returns {{ ok: true, increments: number[] } | { ok: false, error: string }}
 */
const parseSpacingPattern = (raw) => {
  const s = String(raw == null ? '' : raw).trim()
  if (!s) return { ok: false, error: 'Pattern is empty' }

  const tokens = s.split(/[\s,]+/).filter(Boolean)
  if (!tokens.length) return { ok: false, error: 'Pattern is empty' }

  const repeatRe = /^(\d+)@(-?(?:\d+\.?\d*|\.\d+))$/
  const numRe = /^-?(?:\d+\.?\d*|\.\d+)$/
  const increments = []

  for (const tok of tokens) {
    const m = tok.match(repeatRe)
    if (m) {
      const count = parseInt(m[1], 10)
      const dist = parseFloat(m[2])
      if (!Number.isInteger(count) || count < 1) {
        return { ok: false, error: `Invalid repeat count in "${tok}"` }
      }
      if (!isFinite(dist)) {
        return { ok: false, error: `Invalid distance in "${tok}"` }
      }
      for (let i = 0; i < count; i++) increments.push(dist)
    } else if (numRe.test(tok)) {
      const v = parseFloat(tok)
      if (!isFinite(v)) return { ok: false, error: `Invalid number "${tok}"` }
      increments.push(v)
    } else {
      return { ok: false, error: `Invalid token "${tok}"` }
    }
  }

  return { ok: true, increments }
}

/**
 * Predict new node ids that spacingPatternFromAnchors will assign (for selection after run).
 * @param {object} struct
 * @param {number[]} anchorNodeIds
 * @param {number[]} increments
 */
const { generateIds } = require('./idAlloc')

const predictNewNodeIds = (struct, anchorNodeIds, increments) => {
  if (!increments.length || !anchorNodeIds.length) return []
  const used = struct.nodes.map((n) => Number(n.id))
  const chainLen = anchorNodeIds.length
  const ids = []
  for (let s = 0; s < increments.length; s++) {
    ids.push(...generateIds(used.concat(ids), chainLen))
  }
  return ids
}

module.exports = {
  parseSpacingPattern,
  predictNewNodeIds
}
