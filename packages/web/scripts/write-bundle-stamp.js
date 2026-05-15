#!/usr/bin/env node
/**
 * Writes dist/bundle-stamp.txt so demo.html can append ?v=... to JS/CSS
 * and avoid stale browser cache after `npm run build` without editing HTML.
 */
const fs = require('fs')
const path = require('path')

const out = path.join(__dirname, '..', 'dist', 'bundle-stamp.txt')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, String(Date.now()), 'utf8')
