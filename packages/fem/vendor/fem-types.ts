/**
 * Minimal mesh types for the frame solver (derived from Awatif data-model, MIT).
 * Avoids vanjs State / full Components model.
 */

export type Mesh = {
  nodes: { val: number[][] }
  elements: { val: number[][] }
  loads: { val: Map<number, [number, number, number, number, number, number]> }
  supports: { val: Map<number, [boolean, boolean, boolean, boolean, boolean, boolean]> }
  releases: { val: Map<number, [boolean, boolean]> }
  elementsProps: {
    val: Map<
      number,
      {
        elasticity: number
        area: number
        momentInertia?: number
        momentInertiaY?: number
        momentInertiaZ?: number
        shearModulus?: number
        torsionalConstant?: number
      }
    >
  }
  positions: { val: number[] }
  displacements: { val: number[] }
  reactions: { val: number[][] }
  internalForces: {
    val: Map<
      number,
      {
        N: [number, number]
        Vy: [number, number]
        Vz: [number, number]
        Mx: [number, number]
        My: [number, number]
        Mz: [number, number]
      }
    >
  }
}
