import type { DoorLook } from '@/components/three/GarageDoorScene'
import { colourHex, hardwareHex, type DoorSpec } from './options'

/**
 * Turns a saved spec into the handful of numbers the 3D scene needs.
 *
 * Kept separate from both so the option vocabulary can grow without the
 * renderer knowing, and the renderer can change without the option list
 * caring. Finishes map to roughness/metalness because that is the only
 * honest way to show "gloss" versus "matte" — not a different colour.
 */
const FINISH_MATERIAL: Record<string, { roughness: number; metalness: number }> = {
  matte: { roughness: 0.82, metalness: 0.04 },
  satin: { roughness: 0.55, metalness: 0.16 },
  gloss: { roughness: 0.18, metalness: 0.3 },
  woodgrain: { roughness: 0.74, metalness: 0.02 },
}

export function lookFromSpec(spec: DoorSpec): DoorLook {
  const material = FINISH_MATERIAL[spec.finish] ?? FINISH_MATERIAL.satin

  // A roller door is one continuous curtain, so it is drawn as many thin
  // slats rather than a few tall panels — the same geometry, counted
  // differently, which is why it needs no separate renderer.
  const panelCount =
    spec.productType === 'roller' ? 12 : spec.productType === 'tilt' ? 1 : Number(spec.panelCount) || 4

  return {
    color: colourHex(spec.colour),
    hardwareColor: hardwareHex(spec.hardware),
    panelCount,
    profile: spec.productType === 'roller' ? 'ribbed' : spec.panelProfile,
    windows: spec.productType === 'roller' ? 'none' : spec.windows,
    roughness: material.roughness,
    metalness: material.metalness,
  }
}
