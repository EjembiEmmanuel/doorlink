import { describe, expect, it } from 'vitest'
import {
  convertForDisplay,
  inchFromMm,
  kgFromLb,
  lbFromKg,
  lengthFromInch,
  lengthToInch,
  mmFromInch,
  round,
  weightFromLb,
  weightToLb,
} from './units'

describe('conversions', () => {
  it('round-trips weight', () => {
    expect(kgFromLb(lbFromKg(81.6))).toBeCloseTo(81.6, 9)
  })

  it('round-trips length', () => {
    expect(mmFromInch(inchFromMm(101.6))).toBeCloseTo(101.6, 9)
  })

  it('uses the exact definitions', () => {
    expect(mmFromInch(1)).toBe(25.4)
    expect(lbFromKg(0.45359237)).toBeCloseTo(1, 9)
  })

  it('passes imperial values through untouched', () => {
    expect(weightToLb(180, 'imperial')).toBe(180)
    expect(lengthToInch(4, 'imperial')).toBe(4)
  })

  it('converts metric values on the way in', () => {
    expect(weightToLb(81.6, 'metric')).toBeCloseTo(179.9, 1)
    expect(lengthToInch(101.6, 'metric')).toBeCloseTo(4, 6)
  })

  it('converts back on the way out', () => {
    expect(weightFromLb(180, 'metric')).toBeCloseTo(81.6, 1)
    expect(lengthFromInch(4, 'metric')).toBeCloseTo(101.6, 6)
  })
})

describe('round', () => {
  it('rounds to the places asked for', () => {
    expect(round(7.4345, 2)).toBe(7.43)
    expect(round(24.211, 1)).toBe(24.2)
  })

  // The single guard that keeps NaN and Infinity off the screen.
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'returns null for %s',
    (value) => {
      expect(round(value)).toBeNull()
    }
  )
})

describe('convertForDisplay', () => {
  it('converts a typed value when the toggle flips', () => {
    expect(convertForDisplay('101.6', 'metric', 'imperial', 'length')).toBe('4')
    expect(convertForDisplay('81.6', 'metric', 'imperial', 'weight')).toBe('179.9')
  })

  it('does nothing when the system has not changed', () => {
    expect(convertForDisplay('101.6', 'metric', 'metric', 'length')).toBe('101.6')
  })

  // Converting rather than clearing: somebody who measured a drum should
  // not lose it because they wanted to see inches.
  it('keeps the value rather than blanking it', () => {
    expect(convertForDisplay('4', 'imperial', 'metric', 'length')).toBe('101.6')
  })

  it('leaves half-typed input alone', () => {
    expect(convertForDisplay('12.', 'metric', 'imperial', 'length')).toBe('12.')
    expect(convertForDisplay('', 'metric', 'imperial', 'length')).toBe('')
    expect(convertForDisplay('-', 'metric', 'imperial', 'length')).toBe('-')
  })
})
