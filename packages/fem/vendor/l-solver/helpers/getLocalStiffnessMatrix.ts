import { norm, subtract, multiply, inv } from "mathjs";
import type { Mesh } from "../../fem-types";

export function getLocalStiffnessMatrix(
  nodes: Mesh["nodes"]["val"],
  elementsProps: Mesh["elementsProps"]["val"] | undefined,
  index: number,
  releases?: Mesh["releases"]["val"],
): number[][] {
  if (!nodes || !elementsProps) return [];

  const elementProps = elementsProps?.get(index);

  const IzRaw = elementProps?.momentInertiaZ ?? elementProps?.momentInertia ?? 0;
  const IyRaw = elementProps?.momentInertiaY ?? elementProps?.momentInertia ?? 0;
  const ERaw = elementProps?.elasticity ?? 0;
  const ARaw = elementProps?.area ?? 0;
  let G = elementProps?.shearModulus ?? 0;
  let J = elementProps?.torsionalConstant ?? 0;
  const L = norm(subtract(nodes[0], nodes[1])) as number;

  if (!Number.isFinite(L) || L <= 0) {
    return Array.from({ length: 12 }, () => Array(12).fill(0));
  }

  const E = Number.isFinite(ERaw) && ERaw > 0 ? ERaw : 0;
  let Iy = Math.max(IyRaw, 0);
  let Iz = Math.max(IzRaw, 0);
  let A = Math.max(ARaw, 0);

  /**
   * Properties can temporarily set Iy, Iz, A, G, or J to zero while E and L stay
   * positive. That zeros bending, axial, and/or torsion rows and the assembled
   * reduced K is often singular. When E>0, use geometry-based floors (solid-circle
   * estimates from A, then L) only for missing terms so explicit non-zero user
   * values are unchanged.
   */
  if (E > 0) {
    const iCircle = A > 0 ? (A * A) / (4 * Math.PI) : 0;
    const iLen = Math.pow(Math.max(L * 1e-9, 1e-15), 4);
    const iGeom = Math.max(iCircle, iLen, 1e-48);

    Iy = IyRaw > 0 ? IyRaw : Math.max(iGeom, Iz * 1e-12);
    Iz = IzRaw > 0 ? IzRaw : Math.max(iGeom, Iy * 1e-12);

    if (ARaw <= 0 || !Number.isFinite(ARaw)) {
      A = Math.max(Math.sqrt(4 * Math.PI * iGeom), L * L * 1e-24, 1e-30);
    }
  }

  const EA = (E * A) / L;
  const EIz = (E * Iz) / L ** 3;
  const EIy = (E * Iy) / L ** 3;

  /**
   * Torsion row of the 12×12 local K uses GJ/L. When Properties (or legacy data)
   * leaves G=0 or J=0, GJ/L is zero and the global system is often singular for
   * unrestrained torsional DOFs. Use an isotropic-style fallback only for the
   * missing factor(s), so explicit user G/J still win when both are non-zero.
   */
  const imax = Math.max(Iy, Iz);
  if (G * J === 0 && E > 0) {
    const nu = 0.2;
    if (G === 0) G = E / (2 * (1 + nu));
    if (J === 0) {
      J =
        imax > 0
          ? imax
          : A > 0
            ? (A * A) / (2 * Math.PI)
            : Math.pow(Math.max(L * 1e-9, 1e-15), 4);
    }
  }

  const GJ = (G * J) / L;

  const K = [
    [EA, 0, 0, 0, 0, 0, -EA, 0, 0, 0, 0, 0],
    [0, 12 * EIz, 0, 0, 0, 6 * L * EIz, 0, -12 * EIz, 0, 0, 0, 6 * L * EIz],
    [0, 0, 12 * EIy, 0, -6 * L * EIy, 0, 0, 0, -12 * EIy, 0, -6 * L * EIy, 0],
    [0, 0, 0, GJ, 0, 0, 0, 0, 0, -GJ, 0, 0],
    [
      0,
      0,
      -6 * L * EIy,
      0,
      4 * EIy * L ** 2,
      0,
      0,
      0,
      6 * L * EIy,
      0,
      2 * EIy * L ** 2,
      0,
    ],
    [
      0,
      6 * L * EIz,
      0,
      0,
      0,
      4 * EIz * L ** 2,
      0,
      -6 * L * EIz,
      0,
      0,
      0,
      2 * EIz * L ** 2,
    ],
    [-EA, 0, 0, 0, 0, 0, EA, 0, 0, 0, 0, 0],
    [0, -12 * EIz, 0, 0, 0, -6 * EIz * L, 0, 12 * EIz, 0, 0, 0, -6 * EIz * L],
    [0, 0, -12 * EIy, 0, 6 * L * EIy, 0, 0, 0, 12 * EIy, 0, 6 * L * EIy, 0],
    [0, 0, 0, -GJ, 0, 0, 0, 0, 0, GJ, 0, 0],
    [
      0,
      0,
      -6 * L * EIy,
      0,
      2 * EIy * L ** 2,
      0,
      0,
      0,
      6 * L * EIy,
      0,
      4 * EIy * L ** 2,
      0,
    ],
    [
      0,
      6 * L * EIz,
      0,
      0,
      0,
      2 * EIz * L ** 2,
      0,
      -6 * L * EIz,
      0,
      0,
      0,
      4 * EIz * L ** 2,
    ],
  ];

  const elementReleases = releases?.get(index);
  if (elementReleases && elementReleases.some(Boolean)) {
    // Map [Mz_start, Mz_end] to local DOF indices
    const releasedDofIndices: number[] = [];
    if (elementReleases[0]) releasedDofIndices.push(5); // Mz_start
    if (elementReleases[1]) releasedDofIndices.push(11); // Mz_end
    if (releasedDofIndices.length === 0) return K;
    return condenseStiffnessMatrix(K, releasedDofIndices);
  }

  return K;
}

function condenseStiffnessMatrix(K: number[][], releasedIndices: number[]): number[][] {
  const n = K.length;
  const allIndices = Array.from({ length: n }, (_, i) => i);
  const freeIndices = allIndices.filter((i) => !releasedIndices.includes(i));

  // Extract sub-matrices
  const Kff = freeIndices.map((i) => freeIndices.map((j) => K[i][j]));
  const Kfr = freeIndices.map((i) => releasedIndices.map((j) => K[i][j]));
  const Krf = releasedIndices.map((i) => freeIndices.map((j) => K[i][j]));
  const Krr = releasedIndices.map((i) => releasedIndices.map((j) => K[i][j]));

  // K_condensed_ff = Kff - Kfr * inv(Krr) * Krf
  const correction = multiply(Kfr, multiply(inv(Krr), Krf)) as number[][];
  const condensedFf = Kff.map((row, i) => row.map((val, j) => val - correction[i][j]));

  // Reconstruct full matrix with zeros at released DOFs
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < freeIndices.length; i++) {
    for (let j = 0; j < freeIndices.length; j++) {
      result[freeIndices[i]][freeIndices[j]] = condensedFf[i][j];
    }
  }

  return result;
}
