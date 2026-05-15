/** Dense assembly + subset/sparse reduced (original). */
export type LinearSolverBackend = "mathjs-dense-legacy" | "mathjs-sparse-global";

/**
 * Cached LUP of the reduced (free-DOF) stiffness matrix for linear static analysis.
 * Invalid when `structuralSig` (compact fingerprint from `computeStructuralFingerprint`) mismatches.
 */
export type LinearSolverCache = {
  structuralSig: string;
  dof: number;
  freeInd: number[];
  linearSolverBackend: LinearSolverBackend;
  /** mathjs LUP decomposition; valid first argument to `lusolve`. */
  lu: unknown;
  /** Full dense global K — `mathjs-dense-legacy` only (reactions via mat–vec). */
  stiffnesses?: number[][];
  /** Global sparse K — `mathjs-sparse-global` only (reactions via `multiply(K,u)`). */
  stiffnessGlobalSparse?: unknown;
};

export function freeIndicesEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
