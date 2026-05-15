import { lup, lusolve } from "mathjs";

/** Thin wrapper so tests can `vi.spyOn` without touching non-configurable mathjs exports. */
export function stiffnessLup(reducedSparse: unknown) {
  return lup(reducedSparse as never);
}

export function stiffnessLusolve(lu: unknown, forcesFree: unknown) {
  return lusolve(lu as never, forcesFree as never);
}
