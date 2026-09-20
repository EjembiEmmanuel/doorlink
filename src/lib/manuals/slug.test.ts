import { describe, expect, it } from 'vitest'
import { documentSlug, slugify } from './slug'

describe('slugify', () => {
  it('lowercases and joins on single hyphens', () => {
    expect(slugify('SD800 Sectional Opener')).toBe('sd800-sectional-opener')
  })

  it('collapses runs of punctuation', () => {
    expect(slugify('RAM-30 / UL — Class I')).toBe('ram-30-ul-class-i')
  })

  it('does not leave a leading or trailing hyphen', () => {
    expect(slugify('  (Rev. C)  ')).toBe('rev-c')
  })
})

describe('documentSlug', () => {
  const READABLE =
    'steel-line-SD800-INSTALL_MANUAL-SD800 Sectional Garage Door Opener Installation and Operating Instructions'

  // The regression this exists for. Two editions of one manual whose
  // titles differ only past the readable cut used to collide on the
  // unique index.
  it('separates documents whose readable parts are identical', () => {
    const v8 = documentSlug(`${READABLE} (V8 08/20)`, 'https://example.com/sd800-v8-0820.pdf')
    const v6 = documentSlug(`${READABLE} (V6 05/19)`, 'https://example.com/sd800-v6-0519.pdf')
    expect(v8).not.toBe(v6)
  })

  it('is stable across runs, so a published URL keeps working', () => {
    const once = documentSlug(READABLE, 'https://example.com/a.pdf')
    const twice = documentSlug(READABLE, 'https://example.com/a.pdf')
    expect(once).toBe(twice)
  })

  it('depends on the URL, not on where the document is listed', () => {
    expect(documentSlug('one title', 'https://example.com/a.pdf')).not.toBe(
      documentSlug('one title', 'https://example.com/b.pdf')
    )
  })

  it('keeps the readable stem legible', () => {
    expect(documentSlug(READABLE, 'https://example.com/a.pdf')).toContain(
      'steel-line-sd800-install-manual'
    )
  })

  it('ends in an eight-character hex digest', () => {
    expect(documentSlug(READABLE, 'https://example.com/a.pdf')).toMatch(/-[0-9a-f]{8}$/)
  })

  it('bounds the length regardless of how long the title runs', () => {
    const slug = documentSlug('x'.repeat(500), 'https://example.com/a.pdf')
    expect(slug.length).toBeLessThanOrEqual(89)
  })

  it('does not double the hyphen when the stem is cut at one', () => {
    // 'a'.repeat(80) + '-b' cuts to exactly 80 chars ending in 'a', but a
    // title that lands a hyphen on the boundary must not produce '--'.
    const slug = documentSlug(`${'a'.repeat(79)} b`, 'https://example.com/a.pdf')
    expect(slug).not.toContain('--')
  })
})
