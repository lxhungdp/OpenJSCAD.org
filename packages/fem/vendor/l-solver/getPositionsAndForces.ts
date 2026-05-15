import { index, subset, add, sparse, flatten, multiply } from "mathjs";
import type { Mesh } from "../fem-types";
import { getGlobalStiffnessMatrix } from "./helpers/getGlobalStiffnessMatrix";
import { assembleGlobalAndReducedSparse } from "./helpers/assembleSparseStiffness";
import { getTransformationMatrix } from "./helpers/getTransformationMatrix";
import { getLocalStiffnessMatrix } from "./helpers/getLocalStiffnessMatrix";
import {
  freeIndicesEqual,
  type LinearSolverBackend,
  type LinearSolverCache,
} from "./linearSolverCache";
import { computeStructuralFingerprint } from "./structuralFingerprint";
import { stiffnessLup, stiffnessLusolve } from "./stiffnessSolveOps";
import {
  denseStiffnessMinBytes,
  formatBytes,
  heapUsedBytes,
  isLinearSolverProfilingEnabled,
  logLinearSolverProfile,
} from "./solverProfiling";

export function getPositionsAndForces(
  nodes: Mesh["nodes"]["val"],
  elements: Mesh["elements"]["val"],
  loads: Mesh["loads"]["val"],
  supports: Mesh["supports"]["val"],
  elementsProps: Mesh["elementsProps"]["val"],
  releases?: Mesh["releases"]["val"],
  options?: {
    cache?: LinearSolverCache | null;
    /**
     * `mathjs-dense-legacy`: full dense `K`, subset → sparse reduced, LUP (original).
     * `mathjs-sparse-global`: COO sparse assembly, reduced sparse LUP, `K·u` via sparse multiply for reactions.
     */
    linearSolverBackend?: LinearSolverBackend;
  },
): {
  positions: NonNullable<Mesh["positions"]["val"]>;
  displacements: Mesh["displacements"]["val"];
  reactions: Mesh["reactions"]["val"];
  internalForces: Mesh["internalForces"]["val"];
  cache: LinearSolverCache | null;
} {
  const internalForces: Mesh["internalForces"]["val"] = new Map();
  if (!nodes || !elements)
    return {
      positions: [],
      displacements: [],
      reactions: [],
      internalForces: internalForces,
      cache: null,
    };
  if (nodes.length === 0 || elements.length === 0)
    return {
      positions: [],
      displacements: [],
      reactions: [],
      internalForces: internalForces,
      cache: null,
    };

  const dof = nodes.length * 6;
  const originalPositions = nodes.flat();

  const freeInd = getFreeIndices(supports, dof);
  const structuralSig = computeStructuralFingerprint(
    nodes,
    elements,
    supports,
    elementsProps,
    releases,
  );
  const incoming = options?.cache;
  const backend: LinearSolverBackend =
    options?.linearSolverBackend ?? "mathjs-dense-legacy";
  const incomingBackend: LinearSolverBackend =
    incoming?.linearSolverBackend ?? "mathjs-dense-legacy";
  const canReuse =
    incoming != null &&
    incoming.structuralSig === structuralSig &&
    incoming.dof === dof &&
    incomingBackend === backend &&
    freeIndicesEqual(incoming.freeInd, freeInd);

  const profile = isLinearSolverProfilingEnabled();
  if (profile) {
    logLinearSolverProfile("context", {
      solverBackend: backend,
      nodes: nodes.length,
      elements: elements.length,
      dof,
      nFree: freeInd.length,
      reuseStructuralCache: canReuse,
      denseK_minPayload: formatBytes(denseStiffnessMinBytes(dof)),
      note:
        backend === "mathjs-dense-legacy"
          ? "denseK_minPayload=dof^2*8B only; number[][] uses much more"
          : "sparse path: no full dense K",
    });
  }

  let lu: unknown;
  let stiffnesses: number[][] | undefined;
  let stiffnessGlobalSparse: unknown;

  if (canReuse) {
    lu = incoming!.lu;
    if (backend === "mathjs-dense-legacy") {
      stiffnesses = incoming!.stiffnesses;
      if (profile) {
        logLinearSolverProfile("mathjs:cache", {
          skipped: "getGlobalStiffnessMatrix+subset+sparse+lup",
        });
      }
    } else {
      stiffnessGlobalSparse = incoming!.stiffnessGlobalSparse;
      if (profile) {
        logLinearSolverProfile("sparse:cache", {
          skipped: "assembleGlobalAndReduced+lup",
        });
      }
    }
  } else if (backend === "mathjs-dense-legacy") {
    const tK0 = profile ? performance.now() : 0;
    const heapBeforeK = profile ? heapUsedBytes() : undefined;
    stiffnesses = getGlobalStiffnessMatrix(
      nodes,
      elements,
      elementsProps,
      dof,
      releases,
    );
    if (profile) {
      const heapAfterK = heapUsedBytes();
      logLinearSolverProfile("mathjs:getGlobalStiffnessMatrix", {
        ms: performance.now() - tK0,
        heapBefore: heapBeforeK != null ? formatBytes(heapBeforeK) : "?",
        heapAfter: heapAfterK != null ? formatBytes(heapAfterK) : "?",
        heapDelta:
          heapBeforeK != null && heapAfterK != null
            ? formatBytes(heapAfterK - heapBeforeK)
            : "?",
      });
    }

    const tRs0 = profile ? performance.now() : 0;
    const stiffnessesFree = subset(stiffnesses, index(freeInd, freeInd));
    const stiffnessesFreeSparse = sparse(stiffnessesFree);
    if (profile) {
      logLinearSolverProfile("mathjs:subset+sparse(reduced)", {
        ms: performance.now() - tRs0,
      });
    }

    const tLup0 = profile ? performance.now() : 0;
    lu = stiffnessLup(stiffnessesFreeSparse);
    if (profile) {
      logLinearSolverProfile("mathjs:lup", { ms: performance.now() - tLup0 });
    }
  } else {
    const tA0 = profile ? performance.now() : 0;
    const heapBeforeA = profile ? heapUsedBytes() : undefined;
    const assembled = assembleGlobalAndReducedSparse(
      nodes,
      elements,
      elementsProps,
      dof,
      freeInd,
      releases,
    );
    stiffnessGlobalSparse = assembled.stiffnessGlobal;
    if (profile) {
      const heapAfterA = heapUsedBytes();
      logLinearSolverProfile("sparse:assembleGlobalAndReduced", {
        ms: performance.now() - tA0,
        heapBefore: heapBeforeA != null ? formatBytes(heapBeforeA) : "?",
        heapAfter: heapAfterA != null ? formatBytes(heapAfterA) : "?",
        heapDelta:
          heapBeforeA != null && heapAfterA != null
            ? formatBytes(heapAfterA - heapBeforeA)
            : "?",
      });
    }
    const tLup0 = profile ? performance.now() : 0;
    lu = stiffnessLup(assembled.stiffnessReduced as never);
    if (profile) {
      logLinearSolverProfile("sparse:lup(reduced)", { ms: performance.now() - tLup0 });
    }
  }

  const appliedForces = getAppliedForces(loads, dof);
  const forcesFree = subset(appliedForces, index(freeInd));
  const tSolve0 = profile ? performance.now() : 0;
  const deformationFree = stiffnessLusolve(lu, forcesFree);
  if (profile) {
    logLinearSolverProfile(
      backend === "mathjs-dense-legacy" ? "mathjs:lusolve" : "sparse:lusolve",
      { ms: performance.now() - tSolve0 },
    );
  }

  const deformations: number[] = subset(
    Array(dof).fill(0),
    index(freeInd),
    flatten(deformationFree),
  );

  const displacements = nodes
    .map((_, i) => [
      deformations[i * 6],
      deformations[i * 6 + 1],
      deformations[i * 6 + 2],
    ])
    .flat();

  const positions = add(originalPositions, displacements) as number[];
  const tRx0 = profile ? performance.now() : 0;
  const reactions =
    stiffnesses != null
      ? getReactions(stiffnesses, deformations, appliedForces, supports)
      : getReactionsSparse(
          stiffnessGlobalSparse as never,
          deformations,
          appliedForces,
          supports,
        );
  if (profile) {
    logLinearSolverProfile(
      stiffnesses != null ? "getReactions(fullK_matVec)" : "getReactions(sparse_Ku)",
      { ms: performance.now() - tRx0 },
    );
  }

  elements.forEach((e, i) => {
    const elmNodes = e.map((e) => nodes[e]);
    const dxGlobal = e.reduce(
      (a, b) => a.concat(deformations.slice(b * 6, b * 6 + 6)),
      [] as number[],
    );
    const T = getTransformationMatrix(elmNodes);
    const dxLocal = multiply(T, dxGlobal);

    const kLocal = getLocalStiffnessMatrix(elmNodes, elementsProps, i, releases);
    const fLocal = multiply(kLocal, dxLocal) as number[];

    // Zero out released Mz end moments to guard against floating-point noise
    const elementReleases = releases?.get(i);
    if (elementReleases) {
      const releasedDofMap = [5, 11]; // Mz_start, Mz_end
      elementReleases.forEach((released, idx) => {
        if (released) fLocal[releasedDofMap[idx]] = 0;
      });
    }

    internalForces.set(i, {
      N: [fLocal[0], -fLocal[6]],
      Vy: [fLocal[1], -fLocal[7]],
      Vz: [fLocal[2], -fLocal[8]],
      Mx: [fLocal[3], -fLocal[9]],
      My: [fLocal[4], -fLocal[10]],
      Mz: [fLocal[5], -fLocal[11]],
    });
  });

  let cache: LinearSolverCache | null;
  if (canReuse && incoming) {
    cache = incoming;
  } else {
    cache = {
      structuralSig,
      dof,
      freeInd: [...freeInd],
      linearSolverBackend: backend,
      lu,
      stiffnesses: backend === "mathjs-dense-legacy" ? stiffnesses : undefined,
      stiffnessGlobalSparse:
        backend === "mathjs-sparse-global" ? stiffnessGlobalSparse : undefined,
    };
  }

  return { positions, displacements: deformations, reactions, internalForces, cache };
}

// Utils
function getFreeIndices(
  supports: Mesh["supports"]["val"] | undefined,
  dof: number,
): number[] {
  const toRemove: number[] = [];
  supports?.forEach((support, index) => {
    if (support[0]) toRemove.push(index * 6);
    if (support[1]) toRemove.push(index * 6 + 1);
    if (support[2]) toRemove.push(index * 6 + 2);
    if (support[3]) toRemove.push(index * 6 + 3);
    if (support[4]) toRemove.push(index * 6 + 4);
    if (support[5]) toRemove.push(index * 6 + 5);
  });

  return Array(dof)
    .fill(0)
    .map((_, i) => i)
    .filter((v) => !toRemove.includes(v));
}

function getAppliedForces(
  forcesInputs: Mesh["loads"]["val"] | undefined,
  dof: number,
): number[] {
  const forces: number[] = Array(dof).fill(0);

  forcesInputs?.forEach((force, index) => {
    forces[index * 6] = force[0];
    forces[index * 6 + 1] = force[1];
    forces[index * 6 + 2] = force[2];
    forces[index * 6 + 3] = force[3];
    forces[index * 6 + 4] = force[4];
    forces[index * 6 + 5] = force[5];
  });

  return forces;
}

function getReactionsSparse(
  stiffnessGlobal: unknown,
  deformations: number[],
  appliedForces: number[],
  supports: Mesh["supports"]["val"] | undefined,
): Mesh["reactions"]["val"] {
  const col = deformations.map((d) => [d]);
  const Ku = multiply(stiffnessGlobal as never, col);
  const KuFlat = (Ku as { toArray: () => number[][] }).toArray().flat() as number[];
  const reactionsByDof = subtractVec(KuFlat, appliedForces);
  const nodeCount = Math.floor(deformations.length / 6);
  const reactions: Mesh["reactions"]["val"] = Array.from({ length: nodeCount }, () => [
    0, 0, 0, 0, 0, 0,
  ]);

  if (!supports) return reactions;
  supports.forEach((rest, nodeIdx) => {
    const base = nodeIdx * 6;
    for (let j = 0; j < 6; j++) {
      if (rest[j]) reactions[nodeIdx][j] = reactionsByDof[base + j] ?? 0;
    }
  });
  return reactions;
}

function getReactions(
  stiffnesses: number[][],
  deformations: number[],
  appliedForces: number[],
  supports: Mesh["supports"]["val"] | undefined,
): Mesh["reactions"]["val"] {
  const reactionsByDof = subtractVec(
    matVecMul(stiffnesses, deformations),
    appliedForces,
  );
  const nodeCount = Math.floor(deformations.length / 6);
  const reactions: Mesh["reactions"]["val"] = Array.from({ length: nodeCount }, () => [
    0, 0, 0, 0, 0, 0,
  ]);

  if (!supports) return reactions;
  supports.forEach((rest, nodeIdx) => {
    const base = nodeIdx * 6;
    for (let j = 0; j < 6; j++) {
      if (rest[j]) reactions[nodeIdx][j] = reactionsByDof[base + j] ?? 0;
    }
  });
  return reactions;
}

function matVecMul(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((sum, aij, j) => sum + aij * (x[j] ?? 0), 0));
}

function subtractVec(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - (b[i] ?? 0));
}
