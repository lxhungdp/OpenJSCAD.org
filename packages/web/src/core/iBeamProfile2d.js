/**
 * Symmetric I-beam cross-section in XY, then rotated +90° about Z so flanges
 * extend along +Y / −Y (plates top & bottom in the section plane); web along X.
 * H, B = overall out-to-out; tf = flange thickness; tw = web thickness.
 * Sharp corners only: three rectangles, no fillet.
 */
const { primitives, booleans, transforms, maths } = require('@jscad/modeling')
const { rectangle } = primitives
const { union } = booleans
const { rotateZ } = transforms

const { TAU } = maths.constants

const EPS = 1e-9

/**
 * @param {number} H overall height (out-to-out), along local Y before rotation
 * @param {number} B overall flange width (out-to-out), along local X before rotation
 * @param {number} tf flange thickness
 * @param {number} tw web thickness
 * @returns {Object|null} geom2 or null if invalid
 */
const iBeamProfile2d = (H, B, tf, tw) => {
  if (H <= 2 * tf + EPS || B <= tw + EPS || tf <= EPS || tw <= EPS) {
    return null
  }

  const halfH = H / 2
  const topFlange = rectangle({ center: [0, halfH - tf / 2], size: [B, tf] })
  const web = rectangle({ center: [0, 0], size: [tw, H - 2 * tf] })
  const botFlange = rectangle({ center: [0, -halfH + tf / 2], size: [B, tf] })
  const sharp = union(topFlange, web, botFlange)
  return rotateZ(TAU / 4, sharp)
}

module.exports = iBeamProfile2d
