/**
 * Convert geometric section definition to FEM stiffness props (steel-girder convention).
 * Local member axes: z along beam; y = weak bending; z = strong bending (Iy/Iz naming matches Awatif).
 */
const EPS = 1e-12

const sectionToFemProps = (section) => {
  if (!section || !section.type) return null
  const type = section.type
  const b = Math.max(EPS, Number(section.b) || 0)
  const H = Math.max(EPS, Number(section.H) || 0)
  const tw = Math.max(EPS, Number(section.tw) || 0)
  const tf = Math.max(EPS, Number(section.tf) || 0)
  const r = Math.max(EPS, Number(section.r) || 0)

  if (type === 'rec') {
    const area = b * H
    const momentInertiaY = (H * Math.pow(b, 3)) / 12
    const momentInertiaZ = (b * Math.pow(H, 3)) / 12
    const torsionalConstant = area * (Math.pow(b, 2) + Math.pow(H, 2)) / 12
    return { area, momentInertiaY, momentInertiaZ, torsionalConstant }
  }

  if (type === 'circle') {
    const area = Math.PI * r * r
    const I = (Math.PI * Math.pow(r, 4)) / 4
    return {
      area,
      momentInertiaY: I,
      momentInertiaZ: I,
      torsionalConstant: (Math.PI * Math.pow(r, 4)) / 2
    }
  }

  if (type === 'I_Shape') {
    if (H <= 2 * tf + EPS || b <= tw + EPS) return null
    const webH = H - 2 * tf
    const area = 2 * b * tf + webH * tw
    const Iz = (b * Math.pow(H, 3) - (b - tw) * Math.pow(webH, 3)) / 12
    const Iy = (2 * tf * Math.pow(b, 3) + webH * Math.pow(tw, 3)) / 12
    const bf = b
    const hw = webH
    const tfv = tf
    const twv = tw
    const xo = (bf * hw * (hw + tfv) / 2 + (twv * Math.pow(tfv, 2)) / 2) / (bf * hw + tfv * twv)
    const h = hw + tfv
    const Ay = bf * hw
    const Az = tfv * twv
    const IyFlange = (bf * Math.pow(tfv, 3)) / 12 + Ay * Math.pow(h / 2 - xo, 2)
    const IzWeb = (twv * Math.pow(hw, 3)) / 12
    const IyWeb = IzWeb
    const IyTotal = 2 * IyFlange + IyWeb
    const torsionalConstant = (bf * Math.pow(tfv, 3) * hw * hw) / (3 * (hw + tfv)) +
      (twv * Math.pow(tfv, 3)) / 3
    return {
      area,
      momentInertiaY: IyTotal > EPS ? IyTotal : Iy,
      momentInertiaZ: Iz,
      torsionalConstant: Math.max(EPS, torsionalConstant)
    }
  }

  return null
}

/** Map section type to legacy trussMembers profile key */
const sectionTypeToProfile = (type) => {
  if (type === 'circle') return 'circle'
  if (type === 'I_Shape') return 'i'
  return 'rect'
}

module.exports = { sectionToFemProps, sectionTypeToProfile }
