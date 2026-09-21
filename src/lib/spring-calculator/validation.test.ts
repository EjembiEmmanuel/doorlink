import { describe, expect, it } from 'vitest'
import {
  checkMeasurements,
  missingWeightNotice,
  requirePositive,
  requireSpringCount,
} from './validation'
import { inchFromMm, lbFromKg } from './units'

const codes = (input: Parameters<typeof checkMeasurements>[0]) =>
  checkMeasurements(input).map((w) => w.code)

describe('requirePositive', () => {
  it('accepts a real measurement', () => {
    expect(requirePositive(4, 'drum', 'the drum diameter')).toBeNull()
  })

  it.each([
    [null, 'Enter'],
    [undefined, 'Enter'],
    [Number.NaN, 'Enter'],
    [0, 'greater than zero'],
    [-5, 'greater than zero'],
    [Number.POSITIVE_INFINITY, 'not a number'],
  ])('rejects %s', (value, fragment) => {
    const error = requirePositive(value as number | null, 'f', 'the value')
    expect(error?.message).toContain(fragment)
  })
})

describe('requireSpringCount', () => {
  it('accepts one and two', () => {
    expect(requireSpringCount(1)).toBeNull()
    expect(requireSpringCount(2)).toBeNull()
  })

  it('rejects a fraction of a spring', () => {
    expect(requireSpringCount(1.5)?.message).toContain('whole number')
  })

  it('rejects zero', () => {
    expect(requireSpringCount(0)?.message).toContain('greater than zero')
  })

  it('rejects an implausible count', () => {
    expect(requireSpringCount(12)?.message).toContain('more springs')
  })
})

describe('checkMeasurements', () => {
  // Nothing unusual should be silent. A calculator that warns about
  // ordinary doors is one people stop reading.
  it('says nothing about an ordinary door', () => {
    expect(
      codes({ doorWeightLb: 180, doorHeightIn: 84, drumDiameterIn: 4 })
    ).toEqual([])
  })

  it('says nothing about an ordinary spring', () => {
    expect(codes({ wireDiameterIn: 0.25, insideDiameterIn: 2, bodyLengthIn: 25 })).toEqual([])
  })

  it('flags a door weight that looks like a unit mix-up', () => {
    // 180 kg typed where pounds were expected.
    const warnings = checkMeasurements({ doorWeightLb: lbFromKg(1800) })
    expect(warnings[0].code).toBe('weight-unusual')
    expect(warnings[0].message).toContain('metric/imperial')
  })

  it('flags a drum that is nowhere near 4 inches', () => {
    // 101.6 typed as inches rather than mm.
    expect(codes({ drumDiameterIn: 101.6 })).toContain('drum-unusual')
  })

  it('accepts a normal 4-inch drum entered in mm', () => {
    expect(codes({ drumDiameterIn: inchFromMm(101.6) })).toEqual([])
  })

  it('flags an unusual door height', () => {
    expect(codes({ doorHeightIn: 400 })).toContain('height-unusual')
  })

  // Wire gets its own wording because of the fourth power.
  it('tells the user why wire accuracy matters', () => {
    const warning = checkMeasurements({ wireDiameterIn: 2.5 }).find(
      (w) => w.code === 'wire-unusual'
    )
    expect(warning?.message).toContain('significantly affect')
    expect(warning?.message).toContain('10 or 20 coils')
  })

  it('flags an unusual inside diameter', () => {
    expect(codes({ insideDiameterIn: 20 })).toContain('inside-diameter-unusual')
  })

  it('reminds the user to exclude the cones on an odd body length', () => {
    const warning = checkMeasurements({ bodyLengthIn: 200 }).find(
      (w) => w.code === 'body-length-unusual'
    )
    expect(warning?.message).toContain('cones')
  })

  it('treats impossible geometry as serious', () => {
    // A body shorter than a few coils of its own wire cannot exist.
    const warning = checkMeasurements({ wireDiameterIn: 0.25, bodyLengthIn: 0.5 }).find(
      (w) => w.code === 'body-shorter-than-coils'
    )
    expect(warning?.severity).toBe('serious')
  })

  it('ignores absent fields rather than complaining about them', () => {
    expect(codes({})).toEqual([])
    expect(codes({ doorWeightLb: null, drumDiameterIn: undefined })).toEqual([])
  })

  it('does not flag non-finite values as unusual', () => {
    // Those are errors, handled by requirePositive, not warnings.
    expect(codes({ doorWeightLb: Number.NaN, drumDiameterIn: Number.POSITIVE_INFINITY })).toEqual(
      []
    )
  })
})

describe('missingWeightNotice', () => {
  it('asks for the real weight', () => {
    expect(missingWeightNotice().message).toContain('actual door weight')
  })
})
