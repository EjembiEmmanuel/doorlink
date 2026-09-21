import { describe, expect, it } from 'vitest'
import { GUIDE_ORDER, MEASUREMENT_GUIDES, SAFETY_NOTICE } from './measuring'

const ALL = Object.values(MEASUREMENT_GUIDES)

describe('measurement guides', () => {
  it('covers every measurement the calculator asks for', () => {
    for (const id of GUIDE_ORDER) {
      expect(MEASUREMENT_GUIDES[id]).toBeDefined()
    }
  })

  it('gives each guide a what and a how', () => {
    for (const guide of ALL) {
      expect(guide.what.length).toBeGreaterThan(0)
      expect(guide.how.length).toBeGreaterThan(0)
    }
  })

  it('offers a worked example in both unit systems where it has one', () => {
    for (const guide of ALL) {
      if (guide.example) {
        expect(guide.example.metric.length).toBeGreaterThan(0)
        expect(guide.example.imperial.length).toBeGreaterThan(0)
      }
    }
  })

  it('shows the 10-coil arithmetic for wire diameter', () => {
    expect(MEASUREMENT_GUIDES.wireDiameter.example?.metric).toContain('25.0 ÷ 10 = 2.50')
  })

  it('tells the user to exclude the cones', () => {
    expect(MEASUREMENT_GUIDES.bodyLength.how.join(' ')).toContain('cones')
  })
})

// The safety boundary, enforced rather than trusted. No instruction here
// may tell somebody to handle a spring under tension.
describe('no guide gives dangerous instructions', () => {
  const FORBIDDEN = [
    /\bwind the spring/i,
    /\bunwind\b/i,
    /\bwinding bar/i,
    /\bloosen the set screw/i,
    /\bremove the spring/i,
    /\badjust the tension/i,
  ]

  it.each(ALL)('$id says nothing about handling a wound spring', (guide) => {
    const text = [guide.what, ...guide.how, guide.example?.metric ?? ''].join(' ')
    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern)
    }
  })

  it('only ever asks for a spring to be measured as it sits', () => {
    expect(MEASUREMENT_GUIDES.bodyLength.how.join(' ')).toContain('as it sits')
  })

  it('routes door weighing through a professional', () => {
    expect(MEASUREMENT_GUIDES.doorWeight.how.join(' ')).toContain('professional')
  })
})

describe('safety notice', () => {
  it('names the four things not to do', () => {
    for (const verb of ['loosen', 'wind', 'unwind', 'remove']) {
      expect(SAFETY_NOTICE.body).toContain(verb)
    }
  })

  it('calls the output an estimate', () => {
    expect(SAFETY_NOTICE.body).toContain('estimate only')
  })

  it('points at manufacturer data or a professional', () => {
    expect(SAFETY_NOTICE.body).toMatch(/manufacturer|professional/)
  })
})
