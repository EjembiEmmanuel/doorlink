import type { UnitSystem } from './units'

// Measurement instructions, as data.
//
// Content rather than components so the same words can appear in a
// helper card, a tooltip or a printed sheet without being rewritten, and
// so the safety boundary is enforceable: every instruction here is about
// measuring a spring at rest. None of them asks anybody to wind, unwind,
// loosen or remove anything, and the test file asserts that.

export interface MeasurementGuide {
  id: string
  title: string
  /** One line: what is actually being measured. */
  what: string
  /** How to do it, in the order a person does it. */
  how: string[]
  /** A worked example, per unit system, or null where one adds nothing. */
  example: Record<UnitSystem, string> | null
}

export const MEASUREMENT_GUIDES: Record<string, MeasurementGuide> = {
  wireDiameter: {
    id: 'wireDiameter',
    title: 'Wire diameter',
    what: 'The thickness of the wire the spring is wound from.',
    how: [
      'Measure across 10 or 20 coils of the spring, not one.',
      'Divide the total by the number of coils you measured.',
      'Measuring one coil is hard to do squarely, and this number matters more than any other — a small error here changes the result a lot.',
    ],
    example: {
      metric: '10 coils measure 25.0 mm → 25.0 ÷ 10 = 2.50 mm wire',
      imperial: '10 coils measure 2.50 in → 2.50 ÷ 10 = 0.250 in wire',
    },
  },
  insideDiameter: {
    id: 'insideDiameter',
    title: 'Inside diameter',
    what: 'The inside diameter of the coil — the hole the shaft passes through.',
    how: [
      'Measure across the inside of the coil, through the centre.',
      'Do not measure the outside, and do not measure the shaft.',
    ],
    example: {
      metric: 'A common size is 50.8 mm (2 in).',
      imperial: 'A common size is 2 in.',
    },
  },
  bodyLength: {
    id: 'bodyLength',
    title: 'Spring body length',
    what: 'The length of the coiled body only.',
    how: [
      'Measure from where the coils start to where they stop.',
      'Do not include the cones at either end.',
      'Measure the spring as it sits. Do not stretch or compress it.',
    ],
    example: {
      metric: 'A 635 mm body with 50 mm cones at each end measures 635 mm, not 735 mm.',
      imperial: 'A 25 in body with 2 in cones at each end measures 25 in, not 29 in.',
    },
  },
  drumDiameter: {
    id: 'drumDiameter',
    title: 'Cable drum diameter',
    what: 'The diameter of the drum the cable winds onto.',
    how: [
      'Measure across the widest part of the drum, through the centre.',
      'Most residential garage door drums are about 100 mm (4 in).',
      'The size is often cast or printed on the drum itself — check there first.',
    ],
    example: {
      metric: 'A standard drum is about 101.6 mm.',
      imperial: 'A standard drum is 4 in.',
    },
  },
  doorWeight: {
    id: 'doorWeight',
    title: 'Door weight',
    what: 'What the door actually weighs.',
    how: [
      'The most accurate way is to weigh the door with scales while it is fully supported and the springs are disconnected by a professional.',
      'If you cannot weigh it, use the manufacturer’s figure for the door model.',
      'An estimate from panel size and material is a rough starting point only, and every number downstream of it inherits that roughness.',
    ],
    example: null,
  },
  doorHeight: {
    id: 'doorHeight',
    title: 'Door height',
    what: 'The height of the door opening, floor to the top of the door.',
    how: [
      'Measure the door itself, not the opening framing.',
      'This sets how far the cable travels, which is what decides the number of turns.',
    ],
    example: {
      metric: 'A standard single door is about 2100 mm.',
      imperial: 'A standard single door is about 84 in.',
    },
  },
}

export const GUIDE_ORDER = [
  'doorWeight',
  'doorHeight',
  'drumDiameter',
  'wireDiameter',
  'insideDiameter',
  'bodyLength',
] as const

/**
 * The safety notice, in one place.
 *
 * Firm about the one thing that actually hurts people — handling a
 * spring under tension — and quiet about everything else. A warning
 * repeated on every field is a warning nobody reads.
 */
export const SAFETY_NOTICE = {
  title: 'Safety notice',
  body:
    'Garage door springs can store significant energy and can cause serious injury if handled incorrectly. This calculator provides an estimate only. Do not loosen, wind, unwind or remove a spring to obtain measurements. Final spring selection and installation should be verified using manufacturer or supplier data, or by a qualified garage door professional.',
} as const
