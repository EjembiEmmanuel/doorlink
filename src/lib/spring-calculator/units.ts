// Unit handling for the spring calculator.
//
// One rule decides the whole design: the engine works in pounds and
// inches, always. Not because Doorlink is imperial — it is Australian
// and the UI defaults to kg and mm — but because the unit the trade
// actually orders springs in is IPPT, inch-pounds per turn. Converting
// the answer would produce a number nobody can buy a spring with.
//
// So metric is a boundary concern: values are converted on the way in
// and presented on the way out, and nothing in between ever sees a
// millimetre.

export type UnitSystem = 'metric' | 'imperial'

export const KG_PER_LB = 0.45359237
export const MM_PER_INCH = 25.4

export const lbFromKg = (kg: number): number => kg / KG_PER_LB
export const kgFromLb = (lb: number): number => lb * KG_PER_LB
export const inchFromMm = (mm: number): number => mm / MM_PER_INCH
export const mmFromInch = (inch: number): number => inch * MM_PER_INCH
export const inchFromMetres = (m: number): number => (m * 1000) / MM_PER_INCH

/** A weight the user typed, in whichever system they are using. */
export function weightToLb(value: number, system: UnitSystem): number {
  return system === 'metric' ? lbFromKg(value) : value
}

/** A length the user typed (mm in metric, inches in imperial). */
export function lengthToInch(value: number, system: UnitSystem): number {
  return system === 'metric' ? inchFromMm(value) : value
}

export function weightFromLb(lb: number, system: UnitSystem): number {
  return system === 'metric' ? kgFromLb(lb) : lb
}

export function lengthFromInch(inch: number, system: UnitSystem): number {
  return system === 'metric' ? mmFromInch(inch) : inch
}

export const weightUnit = (system: UnitSystem): string => (system === 'metric' ? 'kg' : 'lb')
export const lengthUnit = (system: UnitSystem): string => (system === 'metric' ? 'mm' : 'in')

/**
 * Round for display without lying about precision.
 *
 * Returns null for anything that is not a real number, so a caller
 * cannot accidentally render NaN or Infinity — the UI shows a dash and
 * an explanation instead. Every formatted number in this feature goes
 * through here for that reason.
 */
export function round(value: number, places = 2): number | null {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * Convert a typed value when the user flips the unit toggle.
 *
 * Deliberately converts rather than clearing: somebody who has measured
 * a drum and typed 101.6 should not lose it because they wanted to see
 * the answer in inches. Returns the input untouched when it is not a
 * usable number, so an in-progress "12." does not become NaN mid-typing.
 */
export function convertForDisplay(
  raw: string,
  from: UnitSystem,
  to: UnitSystem,
  kind: 'weight' | 'length'
): string {
  if (from === to) return raw

  // Must be a *complete* number, not merely one parseFloat tolerates.
  // parseFloat('12.') is 12, so converting on that would rewrite the
  // field to '0.47' while somebody is still typing '12.5'. Requiring
  // digits after the point leaves in-progress input alone.
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(raw.trim())) return raw
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return raw

  const asBase = kind === 'weight' ? weightToLb(value, from) : lengthToInch(value, from)
  const converted = kind === 'weight' ? weightFromLb(asBase, to) : lengthFromInch(asBase, to)
  const rounded = round(converted, kind === 'weight' ? 1 : 2)
  return rounded === null ? raw : String(rounded)
}
