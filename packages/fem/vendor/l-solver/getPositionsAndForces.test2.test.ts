/// <reference types="node" />
/**
 * Large-mesh benchmark test2 (~1000 beam elements): **both** backends in one run,
 * numeric comparison + optional report files under `bench-results/`.
 *
 * **Skipped unless** `AWATIF_BENCH_LARGE=1` (dense legacy needs large heap).
 * **Console profiling** — `AWATIF_PROFILE=1`.
 * **Write reports** — default **on** when this suite runs (`comparison-1000-elements.{md,json}`).
 *   Set `AWATIF_BENCH_NO_WRITE=1` to skip writing files.
 *
 * PowerShell:
 *   $env:AWATIF_BENCH_LARGE='1'; $env:AWATIF_PROFILE='1'; $env:NODE_OPTIONS='--max-old-space-size=8192'; npx vitest run components/analysis/l-solver/getPositionsAndForces.test2.test.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "vitest";
import type { Mesh } from "../fem-types";
import type { LinearSolverBackend } from "./linearSolverCache";
import { denseStiffnessMinBytes, formatBytes } from "./solverProfiling";
import { getPositionsAndForces } from "./getPositionsAndForces";

const __dirname = dirname(fileURLToPath(import.meta.url));

const genericMemberProps = {
  elasticity: 32_836_000,
  area: 0.0625,
  momentInertia: 0.00032552,
};

function buildCantileverChain(
  nElements: number,
  segmentLength: number,
): {
  nodes: Mesh["nodes"]["val"];
  elements: Mesh["elements"]["val"];
  supports: Mesh["supports"]["val"];
  loads: Mesh["loads"]["val"];
  elementsProps: Mesh["elementsProps"]["val"];
} {
  const nodeCount = nElements + 1;
  const nodes: Mesh["nodes"]["val"] = Array.from({ length: nodeCount }, (_, j) => [
    0,
    j * segmentLength,
    0,
  ]);
  const elements: Mesh["elements"]["val"] = Array.from(
    { length: nElements },
    (_, i) => [i, i + 1],
  );
  const supports: Mesh["supports"]["val"] = new Map([
    [0, [true, true, true, true, true, true]],
  ]);
  const loads: Mesh["loads"]["val"] = new Map([[nElements, [0, -1, 0, 0, 0, 0]]]);
  const elementsProps: Mesh["elementsProps"]["val"] = new Map(
    elements.map((_, i) => [i, { ...genericMemberProps }]),
  );
  return { nodes, elements, supports, loads, elementsProps };
}

const LARGE_ELEMENT_COUNT = 1000;

function maxAbsDiff(a: number[], b: number[]): number {
  let m = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    m = Math.max(m, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  }
  return m;
}

describe.skipIf(!process.env.AWATIF_BENCH_LARGE)(
  `getPositionsAndForces test2 (~${LARGE_ELEMENT_COUNT} elements): both backends + report`,
  () => {
    test(
      `compare mathjs-sparse-global vs mathjs-dense-legacy and write bench-results`,
      () => {
        const { nodes, elements, supports, loads, elementsProps } =
          buildCantileverChain(LARGE_ELEMENT_COUNT, 1);
        expect(elements.length).toBe(LARGE_ELEMENT_COUNT);
        const dof = nodes!.length * 6;

        const run = (backend: LinearSolverBackend) => {
          const t0 = performance.now();
          const out = getPositionsAndForces(
            nodes,
            elements,
            loads,
            supports,
            elementsProps,
            undefined,
            { linearSolverBackend: backend },
          );
          const wallMs = performance.now() - t0;
          return { ...out, wallMs };
        };

        const sparse = run("mathjs-sparse-global");
        const dense = run("mathjs-dense-legacy");

        expect(sparse.positions.length).toBe(dense.positions.length);
        expect(sparse.displacements.length).toBe(dense.displacements.length);

        const maxDiffPositions = maxAbsDiff(sparse.positions, dense.positions);
        const maxDiffDisplacements = maxAbsDiff(
          sparse.displacements,
          dense.displacements,
        );

        for (let i = 0; i < sparse.positions.length; i++) {
          expect(sparse.positions[i]).toBeCloseTo(dense.positions[i]!, 5);
        }

        const tipIdx = sparse.positions.length - 2;
        const json = {
          generatedAt: new Date().toISOString(),
          model: {
            elements: LARGE_ELEMENT_COUNT,
            nodes: nodes!.length,
            dof,
            denseKMinPayloadBytes: denseStiffnessMinBytes(dof),
          },
          timingsMs: {
            mathjsSparseGlobal: sparse.wallMs,
            mathjsDenseLegacy: dense.wallMs,
            wallTimeRatioSparseOverDense: sparse.wallMs / dense.wallMs,
            wallTimeFactorDenseOverSparse: dense.wallMs / sparse.wallMs,
          },
          agreement: {
            maxAbsDiffPositions: maxDiffPositions,
            maxAbsDiffDisplacements: maxDiffDisplacements,
          },
          sample: {
            tipY_sparse: sparse.positions[tipIdx],
            tipY_dense: dense.positions[tipIdx],
            initialTipY: nodes![nodes!.length - 1]![1],
          },
        };

        const md = `# Benchmark: ${LARGE_ELEMENT_COUNT} beam elements (cantilever chain)

- **Generated:** ${json.generatedAt}
- **Nodes / elements / dof:** ${json.model.nodes} / ${json.model.elements} / ${json.model.dof}
- **Theoretical dense K payload (dof²×8B):** ${formatBytes(json.model.denseKMinPayloadBytes)}

## Wall time (full \`getPositionsAndForces\`, Node \`performance.now\`)

| Backend | ms |
|---------|-----:|
| mathjs-sparse-global | ${sparse.wallMs.toFixed(3)} |
| mathjs-dense-legacy | ${dense.wallMs.toFixed(3)} |
| Time ratio (sparse ÷ dense) | ${(sparse.wallMs / dense.wallMs).toFixed(3)} |
| Dense is × slower than sparse | ${(dense.wallMs / sparse.wallMs).toFixed(2)}× |

## Agreement (sparse vs dense)

| Metric | value |
|--------|------:|
| max \\|Δpositions\\| | ${maxDiffPositions.toExponential(6)} |
| max \\|Δdisplacements\\| | ${maxDiffDisplacements.toExponential(6)} |
| tip Y (sparse) | ${sparse.positions[tipIdx]} |
| tip Y (dense) | ${dense.positions[tipIdx]} |

## Env

- \`AWATIF_BENCH_LARGE=1\` — required to run this suite
- \`AWATIF_PROFILE=1\` — extra \`[awatif/solver]\` console lines
- \`AWATIF_BENCH_NO_WRITE=1\` — skip writing these files
`;

        const shouldWrite = process.env.AWATIF_BENCH_NO_WRITE !== "1";
        if (shouldWrite) {
          const dir = join(__dirname, "bench-results");
          mkdirSync(dir, { recursive: true });
          const base = join(dir, "comparison-1000-elements");
          writeFileSync(`${base}.json`, `${JSON.stringify(json, null, 2)}\n`, "utf8");
          writeFileSync(`${base}.md`, md, "utf8");
          console.info(`[bench/test2] wrote ${base}.md and ${base}.json`);
        }

        expect(maxDiffPositions).toBeLessThan(1e-4);
        expect(maxDiffDisplacements).toBeLessThan(1e-3);
      },
      { timeout: 600_000 },
    );
  },
);
