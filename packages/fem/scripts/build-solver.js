const esbuild = require('esbuild')
const path = require('path')

const entry = path.join(__dirname, '../vendor/l-solver/getPositionsAndForces.ts')
const outfile = path.join(__dirname, '../src/solver/getPositionsAndForces.bundle.js')

const femRoot = path.join(__dirname, '..')

esbuild
  .buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2020',
    outfile,
    absWorkingDir: femRoot,
    logLevel: 'info',
    define: {
      'import.meta.env': '{}',
      'import.meta.url': '""'
    }
  })

console.log('Wrote', outfile)
