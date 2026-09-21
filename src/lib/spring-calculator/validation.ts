import type { SpringWarning } from './engine'
import { kgFromLb, mmFromInch } from './units'

// Sanity checks on what somebody typed and on what came out.
//
// The governing idea: warn, do not block. A technician standing at a
// door knows things this form does not, and a calculator that refuses
// unusual-but-real measurements is one they stop using. Only genuinely
// unusable input — zero, negative, missing — is an error. Everything
// else is a flag with a reason attached, so they can decide.

export interface FieldError {
  field: string
  message: string
}

/** Ranges that cover ordinary residential and light commercial doors. */
const PLAUSIBLE = {
  // Well under a small single panel, well over a large insulated double.
  doorWeightLb: { low: 40, high: 900 },
  doorHeightIn: { low: 60, high: 192 },
  // Garage door drums are essentially always 4" or 6"; 32" exists on
  // high lift. Outside that range something has been mis-measured or
  // mis-converted.
  drumDiameterIn: { low: 2, high: 32 },
  // Garage door torsion wire runs roughly .177" to .625".
  wireDiameterIn: { low: 0.1, high: 0.75 },
  insideDiameterIn: { low: 1, high: 6 },
  bodyLengthIn: { low: 4, high: 60 },
} as const

const positive = (value: number | null | undefined): boolean =>
  value != null && Number.isFinite(value) && value > 0

export function requirePositive(
  value: number | null | undefined,
  field: string,
  label: string
): FieldError | null {
  if (value == null || Number.isNaN(value)) {
    return { field, message: `Enter ${label}.` }
  }
  if (!Number.isFinite(value)) {
    return { field, message: `${label} is not a number this can use.` }
  }
  if (value <= 0) {
    return { field, message: `${label} must be greater than zero.` }
  }
  return null
}

export function requireSpringCount(count: number | null | undefined): FieldError | null {
  const error = requirePositive(count, 'springCount', 'the number of springs')
  if (error) return error
  if (!Number.isInteger(count as number)) {
    return { field: 'springCount', message: 'The number of springs must be a whole number.' }
  }
  if ((count as number) > 6) {
    return { field: 'springCount', message: 'That is more springs than this calculator handles.' }
  }
  return null
}

/**
 * Flags on the measurements themselves, before calculating.
 *
 * Wire diameter gets its own wording because of the fourth power: a
 * small error there moves the answer far more than the same error
 * anywhere else, and the message says so rather than just saying
 * "unusual".
 */
export function checkMeasurements(input: {
  doorWeightLb?: number | null
  doorHeightIn?: number | null
  drumDiameterIn?: number | null
  wireDiameterIn?: number | null
  insideDiameterIn?: number | null
  bodyLengthIn?: number | null
}): SpringWarning[] {
  const warnings: SpringWarning[] = []

  const flag = (code: string, severity: SpringWarning['severity'], message: string) =>
    warnings.push({ code, severity, message })

  if (positive(input.doorWeightLb)) {
    const lb = input.doorWeightLb as number
    if (lb < PLAUSIBLE.doorWeightLb.low || lb > PLAUSIBLE.doorWeightLb.high) {
      flag(
        'weight-unusual',
        'check',
        `A door weight of ${Math.round(kgFromLb(lb))} kg is outside the usual range. Please check this measurement — it may be a metric/imperial mix-up.`
      )
    }
  }

  if (positive(input.drumDiameterIn)) {
    const inch = input.drumDiameterIn as number
    if (inch < PLAUSIBLE.drumDiameterIn.low || inch > PLAUSIBLE.drumDiameterIn.high) {
      flag(
        'drum-unusual',
        'check',
        `A drum diameter of ${Math.round(mmFromInch(inch))} mm is unusual. Most garage door drums are around 100 mm (4").`
      )
    }
  }

  if (positive(input.doorHeightIn)) {
    const inch = input.doorHeightIn as number
    if (inch < PLAUSIBLE.doorHeightIn.low || inch > PLAUSIBLE.doorHeightIn.high) {
      flag(
        'height-unusual',
        'check',
        `A door height of ${Math.round(mmFromInch(inch))} mm is outside the usual range. Please check this measurement.`
      )
    }
  }

  if (positive(input.wireDiameterIn)) {
    const inch = input.wireDiameterIn as number
    if (inch < PLAUSIBLE.wireDiameterIn.low || inch > PLAUSIBLE.wireDiameterIn.high) {
      flag(
        'wire-unusual',
        'check',
        'Double-check your wire measurement. Small measurement errors can significantly affect spring calculations — measure across 10 or 20 coils and divide.'
      )
    }
  }

  if (positive(input.insideDiameterIn)) {
    const inch = input.insideDiameterIn as number
    if (inch < PLAUSIBLE.insideDiameterIn.low || inch > PLAUSIBLE.insideDiameterIn.high) {
      flag(
        'inside-diameter-unusual',
        'check',
        `An inside diameter of ${Math.round(mmFromInch(inch))} mm is unusual for a garage door torsion spring.`
      )
    }
  }

  if (positive(input.bodyLengthIn)) {
    const inch = input.bodyLengthIn as number
    if (inch < PLAUSIBLE.bodyLengthIn.low || inch > PLAUSIBLE.bodyLengthIn.high) {
      flag(
        'body-length-unusual',
        'check',
        `A spring body of ${Math.round(mmFromInch(inch))} mm is unusual. Measure the coiled body only, not the cones.`
      )
    }
  }

  // Geometry that cannot physically be what was described.
  if (positive(input.wireDiameterIn) && positive(input.bodyLengthIn)) {
    if ((input.bodyLengthIn as number) < (input.wireDiameterIn as number) * 3) {
      flag(
        'body-shorter-than-coils',
        'serious',
        'The spring body is too short for the wire diameter given — one of the two has been measured or converted wrongly.',
      )
    }
  }

  return warnings
}

/**
 * A missing door weight is worth saying out loud.
 *
 * Everything downstream of it is an assumption, and the honest move is
 * to say the weight is the measurement that matters most rather than
 * quietly producing a confident-looking number.
 */
export function missingWeightNotice(): SpringWarning {
  return {
    code: 'weight-missing',
    severity: 'check',
    message:
      'Enter the actual door weight if available. Weighing the door gives a far better result than estimating it from size and material.',
  }
}
