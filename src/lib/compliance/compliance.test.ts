import { describe, expect, it } from 'vitest'
import {
  COMPLIANCE_DOCUMENTS,
  COMPLIANCE_SECTIONS,
  DOCUMENT_COUNT,
  TOTAL_PAGES,
  documentsBySection,
  findDocument,
} from './catalogue'
import { legislationFor, defaultRegulator, isFullySupported } from './jurisdiction'
import { checkLogoDataUri, MAX_LOGO_BYTES } from './logo'
import { completeness, expiryWarnings, isValidAbn, normaliseAbn } from './profile'
import { DEFAULT_COMPLIANCE_PRICE_CENTS, isValidPriceCents, purchaseReference } from './pricing'
import { DOCUMENT_CONTENT, availableCodes, contentFor } from './content'
import { COMPLIANCE_DISCLAIMER } from './catalogue'

describe('catalogue', () => {
  it('holds the fifteen documents the source pack describes', () => {
    expect(DOCUMENT_COUNT).toBe(15)
    expect(COMPLIANCE_SECTIONS).toHaveLength(9)
  })

  it('gives every document a unique code', () => {
    const codes = COMPLIANCE_DOCUMENTS.map((doc) => doc.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('puts every document in a section that exists', () => {
    const numbers = new Set(COMPLIANCE_SECTIONS.map((s) => s.number))
    for (const doc of COMPLIANCE_DOCUMENTS) {
      expect(numbers.has(doc.sectionNumber)).toBe(true)
    }
  })

  it('leaves no section empty', () => {
    for (const { documents } of documentsBySection()) {
      expect(documents.length).toBeGreaterThan(0)
    }
  })

  it('counts a real page total rather than a round number', () => {
    expect(TOTAL_PAGES).toBe(COMPLIANCE_DOCUMENTS.reduce((n, d) => n + d.pages, 0))
    expect(TOTAL_PAGES).toBeGreaterThan(0)
  })

  it('finds a document by code, and returns null for one that does not exist', () => {
    expect(findDocument('DL-WHS-002')?.title).toBe('Health & Safety Management Plan')
    expect(findDocument('DL-NOPE-001')).toBeNull()
  })
})

describe('jurisdiction', () => {
  it('gives the full list for New South Wales, with no gap', () => {
    const list = legislationFor('NSW')
    expect(list.gap).toBeNull()
    expect(list.items).toContain('Work Health and Safety Act 2011 (NSW)')
    expect(list.items).toContain('Fair Work Act 2009 (Cth)')
  })

  it('never presents NSW instruments to another state', () => {
    for (const state of ['VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT']) {
      const list = legislationFor(state)
      expect(list.items.join(' ')).not.toContain('(NSW)')
    }
  })

  it('names what is missing rather than silently shortening the list', () => {
    const list = legislationFor('VIC')
    expect(list.gap).toBeTruthy()
    expect(list.gap).toContain('VIC')
  })

  it('still states the Commonwealth instruments, which do not vary', () => {
    const list = legislationFor('QLD')
    expect(list.items).toContain('Fair Work Act 2009 (Cth)')
  })

  it('treats an unset state as a gap, not as NSW', () => {
    for (const value of [null, undefined, '', '   ']) {
      const list = legislationFor(value)
      expect(list.gap).toBeTruthy()
      expect(list.items.join(' ')).not.toContain('(NSW)')
    }
  })

  it('is case and whitespace tolerant', () => {
    expect(legislationFor(' nsw ').gap).toBeNull()
  })

  it('names a regulator only where one is known', () => {
    expect(defaultRegulator('NSW')).toBe('SafeWork NSW')
    expect(defaultRegulator('VIC')).toBeNull()
    expect(isFullySupported('VIC')).toBe(false)
    expect(isFullySupported('NSW')).toBe(true)
  })
})

describe('logo', () => {
  const png = (bytes: number) => `data:image/png;base64,${Buffer.alloc(bytes, 1).toString('base64')}`

  it('accepts a small PNG', () => {
    const result = checkLogoDataUri(png(1024))
    expect(result.ok).toBe(true)
    expect(result.type).toBe('image/png')
    expect(result.bytes).toBe(1024)
  })

  it('refuses SVG, because an SVG can carry script', () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`
    const result = checkLogoDataUri(svg)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('SVG')
  })

  it('refuses a non-image data URI', () => {
    expect(checkLogoDataUri('data:text/html;base64,PHNjcmlwdD4=').ok).toBe(false)
  })

  it('refuses anything that is not a data URI at all', () => {
    expect(checkLogoDataUri('https://example.com/logo.png').ok).toBe(false)
    expect(checkLogoDataUri('javascript:alert(1)').ok).toBe(false)
  })

  it('refuses an image over the size cap', () => {
    const result = checkLogoDataUri(png(MAX_LOGO_BYTES + 2048))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('too large')
  })

  it('refuses an empty string', () => {
    expect(checkLogoDataUri('').ok).toBe(false)
    expect(checkLogoDataUri('   ').ok).toBe(false)
  })
})

describe('profile completeness', () => {
  const full = {
    businessName: 'Acme Doors',
    abn: '51824753556',
    businessAddress: '1 Example St, Brunswick VIC 3056',
    phone: '0390001234',
    email: 'office@example.com',
    state: 'VIC',
    ownerName: 'A. Person',
    emergencyContactName: 'B. Person',
    emergencyContactNumber: '0400000000',
    approvedByName: 'A. Person',
    approvedByPosition: 'Director',
  }

  it('cannot issue from nothing, and says so field by field', () => {
    const result = completeness(null)
    expect(result.canIssue).toBe(false)
    expect(result.missingRequired.length).toBe(result.total)
    expect(result.filled).toBe(0)
  })

  it('can issue once every required field is present', () => {
    const result = completeness(full)
    expect(result.canIssue).toBe(true)
    expect(result.missingRequired).toEqual([])
  })

  it('treats whitespace as absent', () => {
    expect(completeness({ ...full, businessName: '   ' }).canIssue).toBe(false)
  })

  it('separates recommended from required', () => {
    const result = completeness(full)
    expect(result.canIssue).toBe(true)
    expect(result.missingRecommended).toContain('Company logo')
  })

  it('names the specific missing field', () => {
    const { abn, ...withoutAbn } = full
    expect(completeness(withoutAbn).missingRequired).toContain('ABN')
  })
})

describe('expiry warnings', () => {
  const now = new Date('2026-06-01T00:00:00Z')

  it('says nothing when cover runs well into the future', () => {
    expect(expiryWarnings({ publicLiabilityExpiry: new Date('2027-01-01T00:00:00Z') }, now)).toEqual([])
  })

  it('warns inside thirty days', () => {
    const warnings = expiryWarnings({ publicLiabilityExpiry: new Date('2026-06-20T00:00:00Z') }, now)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].expired).toBe(false)
    expect(warnings[0].daysRemaining).toBe(19)
  })

  it('marks cover that has already lapsed', () => {
    const warnings = expiryWarnings({ workersCompExpiry: new Date('2026-05-01T00:00:00Z') }, now)
    expect(warnings[0].expired).toBe(true)
    expect(warnings[0].daysRemaining).toBeLessThan(0)
  })

  it('ignores dates that were never set', () => {
    expect(expiryWarnings({ publicLiabilityExpiry: null }, now)).toEqual([])
    expect(expiryWarnings(null, now)).toEqual([])
  })
})

describe('abn', () => {
  it('accepts eleven digits, spaced or not', () => {
    expect(isValidAbn('51 824 753 556')).toBe(true)
    expect(isValidAbn('51824753556')).toBe(true)
    expect(normaliseAbn('51 824 753 556')).toBe('51824753556')
  })

  it('refuses the wrong length or non-digits', () => {
    expect(isValidAbn('5182475355')).toBe(false)
    expect(isValidAbn('518247535567')).toBe(false)
    expect(isValidAbn('51824753X56')).toBe(false)
  })
})

describe('pricing', () => {
  it('defaults to $29.99 in minor units', () => {
    expect(DEFAULT_COMPLIANCE_PRICE_CENTS).toBe(2999)
  })

  it('accepts a sane price and refuses a silly one', () => {
    expect(isValidPriceCents(2999)).toBe(true)
    expect(isValidPriceCents(0)).toBe(true)
    expect(isValidPriceCents(-1)).toBe(false)
    expect(isValidPriceCents(29.99)).toBe(false)
    expect(isValidPriceCents(1_000_000)).toBe(false)
    expect(isValidPriceCents('2999')).toBe(false)
  })

  it('makes a distinct reference each time', () => {
    const refs = new Set(Array.from({ length: 200 }, () => purchaseReference()))
    expect(refs.size).toBe(200)
  })

  it('makes a reference that reads as one', () => {
    expect(purchaseReference(new Date('2026-09-19T04:05:06Z'))).toMatch(/^CSP-20260919040506-[A-Z0-9]{6}$/)
  })
})

describe('document content', () => {
  it('has content for every document in the catalogue', () => {
    const missing = COMPLIANCE_DOCUMENTS.filter((doc) => !contentFor(doc.code)).map((d) => d.code)
    expect(missing).toEqual([])
    expect(availableCodes()).toHaveLength(DOCUMENT_COUNT)
  })

  it('has no content for a document the catalogue does not list', () => {
    const codes = new Set(COMPLIANCE_DOCUMENTS.map((d) => d.code))
    for (const code of availableCodes()) expect(codes.has(code)).toBe(true)
  })

  it('gives every document an intro and at least one block', () => {
    for (const doc of Object.values(DOCUMENT_CONTENT)) {
      expect(doc.intro.length).toBeGreaterThan(20)
      expect(doc.blocks.length).toBeGreaterThan(0)
    }
  })

  it('matches each entry key to the code inside it', () => {
    for (const [key, doc] of Object.entries(DOCUMENT_CONTENT)) expect(doc.code).toBe(key)
  })

  it('never hard-codes a state instrument into body text', () => {
    // Jurisdiction-specific law belongs in the `legislation` block, which
    // is rendered per state. A state Act named in a paragraph would reach
    // every buyer regardless of where they work.
    for (const [code, doc] of Object.entries(DOCUMENT_CONTENT)) {
      for (const block of doc.blocks) {
        if (block.kind !== 'para') continue
        expect(block.text, `${code} paragraph names a state instrument`).not.toMatch(
          /\b(NSW|VIC|QLD|WA|SA|TAS|NT|ACT)\)/
        )
      }
    }
  })

  it('keeps the caveats the source pack flags', () => {
    const importants = (code: string) =>
      (DOCUMENT_CONTENT[code]?.blocks ?? []).filter((b) => b.kind === 'important')

    // Each of these is a point the source pack explicitly marks as
    // needing outside confirmation. Losing one in a redesign would be
    // the most damaging possible edit to this feature.
    expect(
      importants('DL-WHS-006').some((b) => b.kind === 'important' && /employment adviser/i.test(b.text))
    ).toBe(true)
    expect(
      importants('DL-JOB-001').some((b) => b.kind === 'important' && /Australian Consumer Law/i.test(b.text))
    ).toBe(true)
    expect(importants('DL-WHS-002').some((b) => b.kind === 'important' && /manufacturer/i.test(b.text))).toBe(
      true
    )
    expect(importants('DL-INC-001').some((b) => b.kind === 'important' && /notifiable/i.test(b.text))).toBe(
      true
    )
    expect(
      importants('DL-SWMS-001').some((b) => b.kind === 'important' && /revised and withdrawn/i.test(b.text))
    ).toBe(true)
    expect(
      importants('DL-RISK-001').some(
        (b) => b.kind === 'important' && /confirm the rating on site/i.test(b.text)
      )
    ).toBe(true)
    expect(
      importants('DL-WHS-007').some((b) => b.kind === 'important' && /Code of Practice/i.test(b.text))
    ).toBe(true)
  })

  it('states a disclaimer that does not claim compliance', () => {
    expect(COMPLIANCE_DISCLAIMER).toContain('does not constitute legal advice')
    expect(COMPLIANCE_DISCLAIMER).toContain('does not independently guarantee compliance')
  })
})
