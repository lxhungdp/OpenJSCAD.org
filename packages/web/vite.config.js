const path = require('path')
const { defineConfig } = require('vite')
const commonjs = require('vite-plugin-commonjs').default

module.exports = defineConfig({
  root: __dirname,
  plugins: [
    commonjs({
      // Transform CJS in the web app and in workspace @jscad/* sources loaded in the browser.
      filter: (id) => {
        const n = id.split(path.sep).join('/')
        if (!n.endsWith('.js')) return false
        if (
          n.includes('/packages/web/') &&
          !n.includes('/packages/web/node_modules/') &&
          !n.includes('/packages/web/dist/') &&
          !n.includes('/packages/web/dist-vite/')
        ) {
          return true
        }
        if (n.includes('/node_modules/@jscad/')) return true
        if (/\/packages\/(io|io-utils|core|modeling|array-utils|structure|fem|utils)\//.test(n)) return true
        return false
      }
    })
  ],
  resolve: {
    alias: {
      path: 'path-browserify'
    },
    // One CodeMirror instance: addons use ../../lib/codemirror — avoid duplicate modules breaking fromTextArea.
    dedupe: ['codemirror']
  },
  define: {
    global: 'globalThis',
    'process.env': '{}'
  },
  optimizeDeps: {
    include: [
      'nanohtml',
      'most',
      'morphdom',
      'webworkify',
      '@jscad/core',
      '@jscad/modeling',
      '@jscad/io',
      '@jscad/regl-renderer',
      'codemirror',
      'brace'
    ],
    esbuildOptions: { target: 'es2020' }
  },
  build: {
    target: 'es2020',
    outDir: 'dist-vite',
    emptyOutDir: true,
    commonjsOptions: { transformMixedEsModules: true },
    sourcemap: true
  },
  // Default dev server + HMR (same class of setup as Vite-only repos like steel_bridge — no fixed HMR host).
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')]
    }
  },
  publicDir: 'public'
})
