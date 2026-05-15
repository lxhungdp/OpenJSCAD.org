import * as math from "mathjs";
import type { Mesh } from "../../fem-types";
import { getLocalStiffnessMatrix } from "./getLocalStiffnessMatrix";
import { getTransformationMatrix } from "./getTransformationMatrix";

const { multiply, transpose } = math;
/** CCS matrix from mathjs; typings omit the constructor on the namespace import. */
type SparseMatrixInstance = ReturnType<typeof multiply>;

const SparseMatrix = (
  math as typeof math & {
    SparseMatrix: new (data: {
      values: number[];
      index: number[];
      ptr: number[];
      size: [number, number];
    }) => SparseMatrixInstance;
  }
).SparseMatrix;

function tripletsToCcs(
  n: number,
  acc: Map<string, number>,
): { values: number[]; index: number[]; ptr: number[]; size: [number, number] } {
  const colBuckets: { row: number; val: number }[][] = Array.from(
    { length: n },
    () => [],
  );
  for (const [key, v] of acc) {
    if (v === 0) continue;
    const comma = key.indexOf(",");
    const gi = Number(key.slice(0, comma));
    const gj = Number(key.slice(comma + 1));
    colBuckets[gj].push({ row: gi, val: v });
  }
  const values: number[] = [];
  const index: number[] = [];
  const ptr: number[] = [0];
  for (let j = 0; j < n; j++) {
    colBuckets[j].sort((a, b) => a.row - b.row);
    for (const { row, val } of colBuckets[j]) {
      values.push(val);
      index.push(row);
    }
    ptr.push(values.length);
  }
  return { values, index, ptr, size: [n, n] };
}

function emptySparse(n: number): SparseMatrixInstance {
  return new SparseMatrix({
    values: [],
    index: [],
    ptr: Array.from({ length: n + 1 }, () => 0),
    size: [n, n],
  });
}

/**
 * Assembles global and reduced (free–free) stiffness as sparse CCS in one element pass.
 * Avoids allocating a dense `dof × dof` matrix.
 */
export function assembleGlobalAndReducedSparse(
  nodes: Mesh["nodes"]["val"],
  elements: Mesh["elements"]["val"],
  elementsProps: Mesh["elementsProps"]["val"] | undefined,
  dof: number,
  freeInd: number[],
  releases?: Mesh["releases"]["val"],
): {
  stiffnessGlobal: SparseMatrixInstance;
  stiffnessReduced: SparseMatrixInstance;
} {
  const nFree = freeInd.length;
  if (!nodes || !elements || !elementsProps) {
    return {
      stiffnessGlobal: emptySparse(dof),
      stiffnessReduced: emptySparse(nFree),
    };
  }

  const globalAcc = new Map<string, number>();
  const reducedAcc = new Map<string, number>();
  const g2f = new Int32Array(dof).fill(-1);
  for (let f = 0; f < freeInd.length; f++) {
    g2f[freeInd[f]!] = f;
  }

  function addGlobal(gi: number, gj: number, v: number) {
    if (v === 0) return;
    const key = `${gi},${gj}`;
    globalAcc.set(key, (globalAcc.get(key) ?? 0) + v);
  }

  function addReduced(gi: number, gj: number, v: number) {
    const fi = g2f[gi]!;
    const fj = g2f[gj]!;
    if (fi < 0 || fj < 0) return;
    if (v === 0) return;
    const key = `${fi},${fj}`;
    reducedAcc.set(key, (reducedAcc.get(key) ?? 0) + v);
  }

  elements.forEach((e, idx) => {
    const elmNodes = e.map((nodeIdx) => nodes[nodeIdx]!);
    const kLocal = getLocalStiffnessMatrix(elmNodes, elementsProps, idx, releases);
    const T = getTransformationMatrix(elmNodes);
    const kGlobal = multiply(transpose(T), multiply(kLocal, T)) as number[][];

    const offset0 = 6 * e[0]!;
    const offset1 = 6 * e[1]!;

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const v00 = kGlobal[i]![j]!;
        const v10 = kGlobal[i + 6]![j]!;
        const v01 = kGlobal[i]![j + 6]!;
        const v11 = kGlobal[i + 6]![j + 6]!;
        const pairs: readonly [number, number, number][] = [
          [offset0 + i, offset0 + j, v00],
          [offset1 + i, offset0 + j, v10],
          [offset0 + i, offset1 + j, v01],
          [offset1 + i, offset1 + j, v11],
        ];
        for (const [gi, gj, v] of pairs) {
          addGlobal(gi, gj, v);
          addReduced(gi, gj, v);
        }
      }
    }
  });

  return {
    stiffnessGlobal: new SparseMatrix(tripletsToCcs(dof, globalAcc)),
    stiffnessReduced: new SparseMatrix(tripletsToCcs(nFree, reducedAcc)),
  };
}
