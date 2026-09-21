import { round } from './units'

// The garage door spring calculation engine.
//
// Pure functions, imperial throughout (pounds, inches, in-lb/turn). No
// React, no Prisma, no formatting — those belong to the caller. The
// point of keeping it here is that the arithmetic can be tested against
// known springs, and it is.
//
// WHAT THIS IS NOT: a specification. Every result is an estimate from a
// handful of measurements, and real spring selection depends on drum
// charts, track geometry, cable drop and the manufacturer's own tables.
// The types below carry that uncertainty explicitly — `warnings` is not
// an afterthought bolted onto the result, it is part of it.

export type LiftType = 'standard' | 'high' | 'vertical' | 'custom'

/**
 * Young's modulus for oil-tempered spring steel, psi.
 *
 * The usual figure for the wire garage door torsion springs are wound
 * from. Galvanised and stainless wire differ, which is one reason Mode B
 * results are an estimate rather than a lookup.
 */
export const STEEL_MODULUS_PSI = 28_500_000

/**
 * Divisor in the torsion spring rate equation.
 *
 * k = (d⁴ · E) / (10.8 · Dm · Na) is the standard industry form, derived
 * from the per-radian rate with the 2π-per-turn conversion folded in.
 * Checked against published tables: a .250" wire, 2.0" ID, 25" body
 * spring computes 45.8 in-lb/turn against a published 45-46.
 */
const RATE_DIVISOR = 10.8

export interface SpringWarning {
  /** Stable id so the UI can key and test can assert without matching prose. */
  code: string
  severity: 'info' | 'check' | 'serious'
  message: string
}

export interface TorsionByWeightInput {
  /** Door weight, pounds. */
  doorWeightLb: number
  /** Door height, inches. */
  doorHeightIn: number
  /** Cable drum diameter, inches. */
  drumDiameterIn: number
  springCount: number
  liftType: LiftType
  /** Extra turns beyond cable wrap. 0.75 is the common shop default. */
  preloadTurns?: number
}

export interface TorsionByWeightResult {
  kind: 'torsion-weight'
  /** Total turns the spring is wound, including preload. */
  turns: number
  /** Inch-pounds per turn required, per spring. This is what gets ordered. */
  ipptPerSpring: number
  /** Total moment the door presents at the shaft, in-lb. */
  totalMomentInLb: number
  drumRadiusIn: number
  springCount: number
  doorWeightLb: number
  warnings: SpringWarning[]
}

export const DEFAULT_PRELOAD_TURNS = 0.75

/**
 * Turns required to lift the door, plus preload.
 *
 * H / (π·D) is simply how many times the drum must rotate to wind the
 * cable in — cable travel over drum circumference. Preload is the extra
 * tension left in the spring at rest so the door stays down and the
 * cable stays seated.
 */
export function estimateTurns(
  doorHeightIn: number,
  drumDiameterIn: number,
  preloadTurns: number = DEFAULT_PRELOAD_TURNS
): number {
  if (drumDiameterIn <= 0) return Number.NaN
  return doorHeightIn / (Math.PI * drumDiameterIn) + preloadTurns
}

export function calculateTorsionByWeight(input: TorsionByWeightInput): TorsionByWeightResult {
  const preload = input.preloadTurns ?? DEFAULT_PRELOAD_TURNS
  const turns = estimateTurns(input.doorHeightIn, input.drumDiameterIn, preload)
  const drumRadiusIn = input.drumDiameterIn / 2

  // M = W · r. The door hanging on the cable presents this moment at the
  // shaft; the springs have to give it back over the turns available.
  const totalMomentInLb = input.doorWeightLb * drumRadiusIn
  const ipptPerSpring = totalMomentInLb / (input.springCount * turns)

  const warnings: SpringWarning[] = []
  if (input.liftType !== 'standard') {
    warnings.push({
      code: 'non-standard-lift',
      severity: 'serious',
      message:
        'This calculator cannot reliably determine final spring sizing for this lift configuration without additional system data. High lift, vertical lift and custom systems change the drum profile and cable travel, and the turns figure above assumes neither.',
    })
  }
  return {
    kind: 'torsion-weight',
    turns,
    ipptPerSpring,
    totalMomentInLb,
    drumRadiusIn,
    springCount: input.springCount,
    doorWeightLb: input.doorWeightLb,
    warnings,
  }
}

export interface TorsionByMeasurementInput {
  /** Wire diameter, inches. */
  wireDiameterIn: number
  /** Inside diameter of the coil, inches. */
  insideDiameterIn: number
  /** Coiled body length only, inches — cones excluded. */
  bodyLengthIn: number
  springCount: number
  /** Optional: lets the result say how many turns this spring would need. */
  doorWeightLb?: number | null
  drumDiameterIn?: number | null
  doorHeightIn?: number | null
  /**
   * Fraction of the body treated as active coils. 1 is the honest
   * default — the cones take up a little, but how much varies by
   * manufacturer and guessing at it moves the answer more than it helps.
   */
  activeCoilFactor?: number
}

export interface TorsionByMeasurementResult {
  kind: 'torsion-measurement'
  /** What the measured spring actually delivers, in-lb/turn. */
  ipptPerSpring: number
  meanDiameterIn: number
  activeCoils: number
  springCount: number
  /** Present only when enough was known to work out the door's demand. */
  requiredIpptPerSpring: number | null
  turns: number | null
  warnings: SpringWarning[]
}

/**
 * The rate of a spring from its measurements.
 *
 * Wire diameter is to the fourth power, which is the single most
 * important thing about this calculation: a 5% measuring error in wire
 * becomes a 22% error in the answer. That is why the UI pushes the
 * measure-ten-coils method and why `validateMeasurements` is loud about
 * unusual wire values.
 */
export function springRateIpptFromGeometry(
  wireDiameterIn: number,
  insideDiameterIn: number,
  bodyLengthIn: number,
  activeCoilFactor = 1
): { ippt: number; meanDiameterIn: number; activeCoils: number } {
  const meanDiameterIn = insideDiameterIn + wireDiameterIn
  const activeCoils = (bodyLengthIn / wireDiameterIn) * activeCoilFactor
  if (wireDiameterIn <= 0 || meanDiameterIn <= 0 || activeCoils <= 0) {
    return { ippt: Number.NaN, meanDiameterIn, activeCoils }
  }
  const ippt =
    (wireDiameterIn ** 4 * STEEL_MODULUS_PSI) / (RATE_DIVISOR * meanDiameterIn * activeCoils)
  return { ippt, meanDiameterIn, activeCoils }
}

export function calculateTorsionByMeasurement(
  input: TorsionByMeasurementInput
): TorsionByMeasurementResult {
  const { ippt, meanDiameterIn, activeCoils } = springRateIpptFromGeometry(
    input.wireDiameterIn,
    input.insideDiameterIn,
    input.bodyLengthIn,
    input.activeCoilFactor ?? 1
  )

  // Only worked out when the door side is actually known. A required
  // rate invented from a missing weight would look like a comparison and
  // be nothing of the kind.
  let requiredIpptPerSpring: number | null = null
  let turns: number | null = null
  if (
    input.doorWeightLb != null &&
    input.drumDiameterIn != null &&
    input.doorHeightIn != null &&
    input.drumDiameterIn > 0
  ) {
    turns = estimateTurns(input.doorHeightIn, input.drumDiameterIn)
    requiredIpptPerSpring =
      (input.doorWeightLb * (input.drumDiameterIn / 2)) / (input.springCount * turns)
  }

  return {
    kind: 'torsion-measurement',
    ipptPerSpring: ippt,
    meanDiameterIn,
    activeCoils,
    springCount: input.springCount,
    requiredIpptPerSpring,
    turns,
    warnings: [],
  }
}

export interface ExtensionInput {
  doorWeightLb: number
  springCount: number
  ratedCycles?: number | null
  cyclesPerDay?: number | null
}

export interface ExtensionResult {
  kind: 'extension'
  /** Estimated pull each spring must provide, pounds. */
  pullPerSpringLb: number
  springCount: number
  doorWeightLb: number
  estimatedLifeYears: number | null
  warnings: SpringWarning[]
}

/**
 * Extension springs, kept deliberately simple.
 *
 * The door's weight shared between the springs. Real selection also
 * depends on the pulley arrangement, the drop and the stretched length,
 * none of which this asks for — so the result is labelled an estimated
 * pull, never a replacement specification.
 */
export function calculateExtension(input: ExtensionInput): ExtensionResult {
  const pullPerSpringLb = input.doorWeightLb / input.springCount
  return {
    kind: 'extension',
    pullPerSpringLb,
    springCount: input.springCount,
    doorWeightLb: input.doorWeightLb,
    estimatedLifeYears: estimateLifeYears(input.ratedCycles, input.cyclesPerDay),
    warnings: [
      {
        code: 'extension-estimate',
        severity: 'info',
        message:
          'Extension spring selection also depends on the pulley arrangement and the door drop. Use this as a starting figure and confirm against the supplier’s chart.',
      },
    ],
  }
}

/**
 * Service life in years. Null unless both figures are usable, because a
 * life estimate from a guessed cycle count is worse than none.
 */
export function estimateLifeYears(
  ratedCycles?: number | null,
  cyclesPerDay?: number | null
): number | null {
  if (ratedCycles == null || cyclesPerDay == null) return null
  if (!Number.isFinite(ratedCycles) || !Number.isFinite(cyclesPerDay)) return null
  if (ratedCycles <= 0 || cyclesPerDay <= 0) return null
  return ratedCycles / (cyclesPerDay * 365)
}

/**
 * Wire diameter from the measure-across-coils method.
 *
 * The reason the UI leads with this: a caliper on one coil is hard to
 * hold square and the error goes to the fourth power. Ten coils divides
 * the error by ten.
 */
export function wireDiameterFromCoils(totalMeasurement: number, coilCount: number): number | null {
  if (!Number.isFinite(totalMeasurement) || !Number.isFinite(coilCount)) return null
  if (totalMeasurement <= 0 || coilCount <= 0) return null
  const result = totalMeasurement / coilCount
  return Number.isFinite(result) ? result : null
}

export type SpringResult = TorsionByWeightResult | TorsionByMeasurementResult | ExtensionResult

/** Guard used before anything is rendered. Keeps NaN out of the UI. */
export function isUsableResult(result: SpringResult): boolean {
  const numbers =
    result.kind === 'extension'
      ? [result.pullPerSpringLb]
      : result.kind === 'torsion-weight'
        ? [result.turns, result.ipptPerSpring]
        : [result.ipptPerSpring]
  return numbers.every((n) => Number.isFinite(n) && n > 0)
}

export { round }
