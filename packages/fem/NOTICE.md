# @jscad/fem

The linear 3D frame solver (6 DOF per node) is derived from [Awatif / frame2d](https://github.com/madil4/awatif), MIT License.

## Vendored source

- `vendor/l-solver/` — `getPositionsAndForces` and helpers (from Awatif `components/analysis/l-solver/`)
- `vendor/fem-types.ts` — minimal mesh types (from Awatif `components/data-model.ts`, trimmed)

Bundled to `src/solver/getPositionsAndForces.bundle.js` via `npm run build:solver`.

No runtime dependency on the `steel-girder/` reference folder.
