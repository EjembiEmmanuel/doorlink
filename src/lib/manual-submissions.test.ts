import { describe, expect, it } from 'vitest'
import { ManualVerificationResult } from '@prisma/client'
import {
  normalizePublicSourceUrl,
  safeManualFilename,
  verifyManualSubmissionMetadata,
} from './manual-submissions'

describe('manual submission checks', () => {
  it('normalizes public source links without fragments', () => {
    expect(normalizePublicSourceUrl('https://example.com/manual.pdf#page=4')).toBe('https://example.com/manual.pdf')
  })

  it('rejects private and authenticated source links', () => {
    expect(() => normalizePublicSourceUrl('http://localhost:5000/manual.pdf')).toThrow()
    expect(() => normalizePublicSourceUrl('https://user:pass@example.com/manual.pdf')).toThrow()
    expect(() => normalizePublicSourceUrl('ftp://example.com/manual.pdf')).toThrow()
  })

  it('flags a duplicate for human review rather than approving it', () => {
    const result = verifyManualSubmissionMetadata({
      sourceUrl: 'https://example.com/manual.pdf',
      hasFile: false,
      duplicateFound: true,
    })
    expect(result.result).toBe(ManualVerificationResult.REVIEW_REQUIRED)
    expect(result.notes.join(' ')).toContain('matching document')
  })

  it('does not invent a source when neither source nor file is present', () => {
    const result = verifyManualSubmissionMetadata({ hasFile: false })
    expect(result.result).toBe(ManualVerificationResult.REJECTED)
    expect(result.score).toBe(0)
  })

  it('keeps uploaded paths safe and bounded', () => {
    const filename = safeManualFilename('../../a manual?.pdf')
    expect(filename).toBe('a-manual-.pdf')
    expect(safeManualFilename('////')).toBe('manual')
  })
})