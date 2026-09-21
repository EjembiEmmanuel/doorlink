import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRELOAD_TURNS,
  calculateExtension,
  calculateTorsionByMeasurement,
  calculateTorsionByWeight,
  estimateLifeYears,
  estimateTurns,
  isUsableResult,
  springRateIpptFromGeometry,
  wireDiameterFromCoils,
} from './engine'
import { inchFromMm, lbFromKg, lengthToInch, weightToLb } from './units'

describe('the reference example', () => {
  // 180 lb, 84 in, 4 in drum, 2 springs, 0.75 preload
  // -> 7.43 turns, 24.2 IPPT per spring.
  const result = calculateTorsionByWeight({
    doorWeightLb: 180,
    doorHeightIn: 84,
    drumDiameterIn: 4,
    springCount: 2,
    liftType: 'standard',
    preloadTurns: 0.75,
  })

  it('produces 7.43 turns', () => {
    expect(result.turns).toBeCloseTo(7.43, 2)
  })

  it('produces 24.2 IPPT per spring', () => {
    expect(result.ipptPerSpring).toBeCloseTo(24.2, 1)
  })

  it('lands on the same answer entered in metric', () => {
    // The same door as a technician in Australia would type it.
    const metric = calculateTorsionByWeight({
      doorWeightLb: weightToLb(81.65, 'metric'),
      doorHeightIn: lengthToInch(2133.6, 'metric'),
      drumDiameterIn: lengthToInch(101.6, 'metric'),
      springCount: 2,
      liftType: 'standard',
      preloadTurns: 0.75,
    })
    expect(metric.turns).toBeCloseTo(7.43, 2)
    expect(metric.ipptPerSpring).toBeCloseTo(24.2, 1)
  })
})

describe('estimateTurns', () => {
  it('is cable travel over drum circumference, plus preload', () => {
    expect(estimateTurns(84, 4, 0)).toBeCloseTo(84 / (Math.PI * 4), 6)
    expect(estimateTurns(84, 4, 0.75) - estimateTurns(84, 4, 0)).toBeCloseTo(0.75, 6)
  })

  it('defaults preload to the shop standard', () => {
    expect(estimateTurns(84, 4)).toBeCloseTo(estimateTurns(84, 4, DEFAULT_PRELOAD_TURNS), 6)
  })

  it('refuses to divide by a zero drum', () => {
    expect(Number.isNaN(estimateTurns(84, 0))).toBe(true)
  })
})

describe('spring count', () => {
  const base = {
    doorWeightLb: 180,
    doorHeightIn: 84,
    drumDiameterIn: 4,
    liftType: 'standard' as const,
    preloadTurns: 0.75,
  }

  it('one spring carries the whole door', () => {
    const one = calculateTorsionByWeight({ ...base, springCount: 1 })
    expect(one.ipptPerSpring).toBeCloseTo(48.4, 1)
  })

  it('two springs each carry half', () => {
    const one = calculateTorsionByWeight({ ...base, springCount: 1 })
    const two = calculateTorsionByWeight({ ...base, springCount: 2 })
    expect(two.ipptPerSpring).toBeCloseTo(one.ipptPerSpring / 2, 6)
  })

  it('turns do not change with spring count', () => {
    expect(calculateTorsionByWeight({ ...base, springCount: 1 }).turns).toBeCloseTo(
      calculateTorsionByWeight({ ...base, springCount: 2 }).turns,
      6
    )
  })
})

describe('lift type', () => {
  const base = {
    doorWeightLb: 180,
    doorHeightIn: 84,
    drumDiameterIn: 4,
    springCount: 2,
    preloadTurns: 0.75,
  }

  it('says nothing extra about a standard lift', () => {
    expect(calculateTorsionByWeight({ ...base, liftType: 'standard' }).warnings).toHaveLength(0)
  })

  it.each(['high', 'vertical', 'custom'] as const)('warns seriously about %s lift', (liftType) => {
    const result = calculateTorsionByWeight({ ...base, liftType })
    const warning = result.warnings.find((w) => w.code === 'non-standard-lift')
    expect(warning?.severity).toBe('serious')
    expect(warning?.message).toContain('cannot reliably')
  })

  it('still returns the arithmetic alongside the warning', () => {
    // Warning, not refusal — the number is useful as a starting point.
    const result = calculateTorsionByWeight({ ...base, liftType: 'high' })
    expect(result.ipptPerSpring).toBeGreaterThan(0)
  })
})

describe('spring rate from measurements', () => {
  // Checked against published manufacturer tables.
  it.each([
    [0.25, 2.0, 25.0, 45.8],
    [0.2188, 1.75, 24.0, 28.0],
  ])('a %s" wire, %s" ID, %s" body spring rates near %s', (d, id, body, expected) => {
    const { ippt } = springRateIpptFromGeometry(d, id, body)
    expect(ippt).toBeCloseTo(expected, 0)
  })

  it('uses mean diameter, not inside diameter', () => {
    const { meanDiameterIn } = springRateIpptFromGeometry(0.25, 2.0, 25)
    expect(meanDiameterIn).toBeCloseTo(2.25, 6)
  })

  it('counts active coils as body over wire', () => {
    expect(springRateIpptFromGeometry(0.25, 2.0, 25).activeCoils).toBeCloseTo(100, 6)
  })

  // The fourth power is the whole reason the UI nags about measuring.
  it('moves roughly 22% on a 5% wire error', () => {
    const right = springRateIpptFromGeometry(0.25, 2.0, 25).ippt
    const wrong = springRateIpptFromGeometry(0.2625, 2.0, 25).ippt
    expect(wrong / right).toBeGreaterThan(1.15)
  })

  it('returns NaN rather than nonsense for a zero wire', () => {
    expect(Number.isNaN(springRateIpptFromGeometry(0, 2, 25).ippt)).toBe(true)
  })
})

describe('torsion by measurement', () => {
  const spring = { wireDiameterIn: 0.25, insideDiameterIn: 2.0, bodyLengthIn: 25, springCount: 2 }

  it('reports what the measured spring delivers', () => {
    expect(calculateTorsionByMeasurement(spring).ipptPerSpring).toBeCloseTo(45.8, 0)
  })

  // Without the door side there is nothing to compare against, and
  // inventing a requirement would look like a comparison.
  it('leaves the requirement null when the door is unknown', () => {
    const result = calculateTorsionByMeasurement(spring)
    expect(result.requiredIpptPerSpring).toBeNull()
    expect(result.turns).toBeNull()
  })

  it('works out the requirement once the door is known', () => {
    const result = calculateTorsionByMeasurement({
      ...spring,
      doorWeightLb: 180,
      doorHeightIn: 84,
      drumDiameterIn: 4,
    })
    expect(result.requiredIpptPerSpring).toBeCloseTo(24.2, 1)
    expect(result.turns).toBeCloseTo(7.43, 2)
  })
})

describe('extension springs', () => {
  it('shares the door weight between the springs', () => {
    expect(calculateExtension({ doorWeightLb: 180, springCount: 2 }).pullPerSpringLb).toBeCloseTo(
      90,
      6
    )
  })

  it('gives one spring the whole door', () => {
    expect(calculateExtension({ doorWeightLb: 180, springCount: 1 }).pullPerSpringLb).toBeCloseTo(
      180,
      6
    )
  })

  it('always says the pulley arrangement matters', () => {
    const result = calculateExtension({ doorWeightLb: 180, springCount: 2 })
    expect(result.warnings.map((w) => w.code)).toContain('extension-estimate')
  })

  it('handles a metric door weight', () => {
    const result = calculateExtension({ doorWeightLb: lbFromKg(81.65), springCount: 2 })
    expect(result.pullPerSpringLb).toBeCloseTo(90, 0)
  })
})

describe('service life', () => {
  it('is rated cycles over daily cycles times 365', () => {
    expect(estimateLifeYears(10_000, 4)).toBeCloseTo(10_000 / (4 * 365), 6)
  })

  it('is about 6.8 years for a 10,000-cycle spring at 4 a day', () => {
    expect(estimateLifeYears(10_000, 4)).toBeCloseTo(6.85, 1)
  })

  // A life figure built on a guess is worse than no figure.
  it.each([
    [null, 4],
    [10_000, null],
    [0, 4],
    [10_000, 0],
    [-1, 4],
    [Number.NaN, 4],
    [10_000, Number.POSITIVE_INFINITY],
  ])('returns null for (%s, %s)', (rated, daily) => {
    expect(estimateLifeYears(rated as number | null, daily as number | null)).toBeNull()
  })
})

describe('wire diameter from coils', () => {
  it('divides the span by the coil count', () => {
    // The worked example the UI shows: 25.0 mm over 10 coils.
    expect(wireDiameterFromCoils(25.0, 10)).toBeCloseTo(2.5, 6)
  })

  it('works across 20 coils too', () => {
    expect(wireDiameterFromCoils(50.0, 20)).toBeCloseTo(2.5, 6)
  })

  it('works in inches', () => {
    expect(wireDiameterFromCoils(2.5, 10)).toBeCloseTo(0.25, 6)
  })

  it.each([
    [0, 10],
    [25, 0],
    [-25, 10],
    [Number.NaN, 10],
    [25, Number.NaN],
  ])('returns null for (%s, %s)', (total, coils) => {
    expect(wireDiameterFromCoils(total, coils)).toBeNull()
  })
})

describe('isUsableResult', () => {
  it('passes a real torsion result', () => {
    expect(
      isUsableResult(
        calculateTorsionByWeight({
          doorWeightLb: 180,
          doorHeightIn: 84,
          drumDiameterIn: 4,
          springCount: 2,
          liftType: 'standard',
        })
      )
    ).toBe(true)
  })

  // The guard that keeps NaN and Infinity off the screen.
  it('rejects a divide-by-zero drum', () => {
    expect(
      isUsableResult(
        calculateTorsionByWeight({
          doorWeightLb: 180,
          doorHeightIn: 84,
          drumDiameterIn: 0,
          springCount: 2,
          liftType: 'standard',
        })
      )
    ).toBe(false)
  })

  it('rejects a zero spring count', () => {
    expect(
      isUsableResult(
        calculateTorsionByWeight({
          doorWeightLb: 180,
          doorHeightIn: 84,
          drumDiameterIn: 4,
          springCount: 0,
          liftType: 'standard',
        })
      )
    ).toBe(false)
  })

  it('rejects an unmeasurable spring', () => {
    expect(
      isUsableResult(
        calculateTorsionByMeasurement({
          wireDiameterIn: 0,
          insideDiameterIn: 2,
          bodyLengthIn: 25,
          springCount: 2,
        })
      )
    ).toBe(false)
  })
})

describe('imperial and metric agree', () => {
  it('gives the same rate for a spring measured either way', () => {
    const imperial = springRateIpptFromGeometry(0.25, 2.0, 25)
    const metric = springRateIpptFromGeometry(
      inchFromMm(6.35),
      inchFromMm(50.8),
      inchFromMm(635)
    )
    expect(metric.ippt).toBeCloseTo(imperial.ippt, 1)
  })
})
