import { describe, expect, it } from 'vitest'
import { STATUS_LINE, buildSummary } from './summary'
import { calculateExtension, calculateTorsionByWeight } from './engine'

const torsion = calculateTorsionByWeight({
  doorWeightLb: 180,
  doorHeightIn: 84,
  drumDiameterIn: 4,
  springCount: 2,
  liftType: 'standard',
  preloadTurns: 0.75,
})

describe('buildSummary', () => {
  it('reports the reference door in metric', () => {
    const text = buildSummary(torsion, { system: 'metric', springType: 'torsion' })!
    expect(text).toContain('DOORLINK')
    expect(text).toContain('81.6 kg')
    expect(text).toContain('24.2 in-lb/turn')
    expect(text).toContain('7.43')
    expect(text).toContain('Springs: 2')
  })

  it('reports the same door in imperial', () => {
    const text = buildSummary(torsion, { system: 'imperial', springType: 'torsion' })!
    expect(text).toContain('180 lb')
  })

  // Every summary carries the caveat. A figure pasted into a quote
  // without it is the thing worth designing against.
  it('always ends with the estimate status', () => {
    expect(buildSummary(torsion, { system: 'metric', springType: 'torsion' })).toContain(
      STATUS_LINE
    )
  })

  it('keeps engineering detail out unless asked', () => {
    const plain = buildSummary(torsion, { system: 'metric', springType: 'torsion' })!
    expect(plain).not.toContain('Total moment')

    const advanced = buildSummary(torsion, {
      system: 'metric',
      springType: 'torsion',
      advanced: true,
    })!
    expect(advanced).toContain('Total moment')
    expect(advanced).toContain('Drum diameter')
  })

  it('names the door when one was given', () => {
    const text = buildSummary(torsion, {
      system: 'metric',
      springType: 'torsion',
      doorLabel: 'Residential Garage Door',
    })!
    expect(text).toContain('Door: Residential Garage Door')
  })

  it('lists warnings under a Check heading', () => {
    const highLift = calculateTorsionByWeight({
      doorWeightLb: 180,
      doorHeightIn: 84,
      drumDiameterIn: 4,
      springCount: 2,
      liftType: 'high',
    })
    const text = buildSummary(highLift, { system: 'metric', springType: 'torsion' })!
    expect(text).toContain('Check:')
    expect(text).toContain('cannot reliably')
  })

  it('summarises an extension spring in the user’s units', () => {
    const text = buildSummary(
      calculateExtension({ doorWeightLb: 180, springCount: 2, ratedCycles: 10_000, cyclesPerDay: 4 }),
      { system: 'metric', springType: 'extension' }
    )!
    expect(text).toContain('Estimated pull per spring: 40.8 kg')
    expect(text).toContain('Estimated service life: 6.8 years')
  })

  // The guard that stops NaN reaching a clipboard.
  it('returns null rather than summarising an unusable result', () => {
    const broken = calculateTorsionByWeight({
      doorWeightLb: 180,
      doorHeightIn: 84,
      drumDiameterIn: 0,
      springCount: 2,
      liftType: 'standard',
    })
    expect(buildSummary(broken, { system: 'metric', springType: 'torsion' })).toBeNull()
  })

  it('never emits NaN, undefined, Infinity or null', () => {
    for (const system of ['metric', 'imperial'] as const) {
      const text = buildSummary(torsion, { system, springType: 'torsion', advanced: true })!
      expect(text).not.toMatch(/NaN|undefined|Infinity|null/)
    }
  })
})
