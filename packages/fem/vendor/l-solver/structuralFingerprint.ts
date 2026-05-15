import type { Mesh } from "../fem-types";

/**
 * Compact O(n) structural fingerprint for linear-solver cache invalidation.
 * Replaces full JSON.stringify(nodes/elements) to avoid huge intermediate strings on large meshes.
 *
 * Uses two independent 64-bit FNV-1a streams over the same byte sequence (128-bit tag).
 * Suitable for engineering models; not a cryptographic hash.
 */
const FNV64_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;
const BASIS_A = 0xcbf29ce484222325n;
const BASIS_B = 0x9ae16a3b2f90404fn;

function fnv1aFold(h: bigint, byte: number): bigint {
  return ((h ^ BigInt(byte & 0xff)) * FNV64_PRIME) & MASK64;
}

const scratch = new Uint8Array(8);
const scratchDv = new DataView(scratch.buffer);

function foldU32(hA: bigint, hB: bigint, n: number): [bigint, bigint] {
  scratchDv.setUint32(0, n >>> 0, true);
  let a = hA;
  let b = hB;
  for (let i = 0; i < 4; i++) {
    a = fnv1aFold(a, scratch[i]!);
  }
  for (let i = 3; i >= 0; i--) {
    b = fnv1aFold(b, scratch[i]!);
  }
  return [a, b];
}

function foldF64(hA: bigint, hB: bigint, x: number): [bigint, bigint] {
  scratchDv.setFloat64(0, x, true);
  let a = hA;
  let b = hB;
  for (let i = 0; i < 8; i++) {
    a = fnv1aFold(a, scratch[i]!);
  }
  for (let i = 7; i >= 0; i--) {
    b = fnv1aFold(b, scratch[i]!);
  }
  return [a, b];
}

function serializeSupports(supports: Mesh["supports"]["val"] | undefined): string {
  if (!supports || supports.size === 0) return "";
  return [...supports.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}:${v.map((b) => (b ? 1 : 0)).join("")}`)
    .join("|");
}

function serializeReleases(releases: Mesh["releases"]["val"] | undefined): string {
  if (!releases || releases.size === 0) return "";
  return [...releases.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}:${v.map((b) => (b ? 1 : 0)).join("")}`)
    .join("|");
}

function serializeElementsProps(
  props: Mesh["elementsProps"]["val"] | undefined,
): string {
  if (!props || props.size === 0) return "";
  return [...props.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => {
      const o = v as Record<string, number | undefined>;
      const keys = Object.keys(o).sort();
      const body = keys.map((key) => `${key}:${o[key] ?? ""}`).join(",");
      return `${k}:{${body}}`;
    })
    .join("|");
}

function foldUtf8(hA: bigint, hB: bigint, s: string): [bigint, bigint] {
  if (s.length === 0) return [hA, hB];
  const enc = new TextEncoder();
  const bytes = enc.encode(s);
  let a = hA;
  let b = hB;
  for (let i = 0; i < bytes.length; i++) {
    a = fnv1aFold(a, bytes[i]!);
  }
  for (let i = bytes.length - 1; i >= 0; i--) {
    b = fnv1aFold(b, bytes[i]!);
  }
  return [a, b];
}

/**
 * Fingerprint of everything that affects K and the free-DOF set (not loads).
 * Fixed width (~34 hex chars + separators); safe to store on `LinearSolverCache.structuralSig`.
 */
export function computeStructuralFingerprint(
  nodes: Mesh["nodes"]["val"],
  elements: Mesh["elements"]["val"],
  supports: Mesh["supports"]["val"],
  elementsProps: Mesh["elementsProps"]["val"],
  releases: Mesh["releases"]["val"] | undefined,
): string {
  let hA = BASIS_A;
  let hB = BASIS_B;

  const na = nodes ?? [];
  [hA, hB] = foldU32(hA, hB, na.length);
  for (const row of na) {
    [hA, hB] = foldU32(hA, hB, row.length);
    for (let c = 0; c < row.length; c++) {
      [hA, hB] = foldF64(hA, hB, row[c]!);
    }
  }

  const ea = elements ?? [];
  [hA, hB] = foldU32(hA, hB, ea.length);
  for (const el of ea) {
    [hA, hB] = foldU32(hA, hB, el.length);
    for (let i = 0; i < el.length; i++) {
      [hA, hB] = foldU32(hA, hB, el[i]!);
    }
  }

  const supPart = serializeSupports(supports);
  const relPart = serializeReleases(releases);
  const propsPart = serializeElementsProps(elementsProps);
  [hA, hB] = foldUtf8(hA, hB, supPart);
  [hA, hB] = foldUtf8(hA, hB, relPart);
  [hA, hB] = foldUtf8(hA, hB, propsPart);

  const hexA = hA.toString(16).padStart(16, "0");
  const hexB = hB.toString(16).padStart(16, "0");
  return `v2:${hexA}:${hexB}`;
}
