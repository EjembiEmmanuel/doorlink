import { describe, expect, it } from 'vitest'
import { AiVerdict } from '@prisma/client'
import {
  buildUserPrompt,
  errored,
  interpretReview,
  notRun,
  reviewSchema,
  type AiReview,
} from './ai-review'

const clean = (over: Partial<AiReview> = {}): AiReview => ({
  is_manual: true,
  in_scope: true,
  has_technical_content: true,
  manufacturer_in_document: 'B&D',
  model_in_document: 'CAD-4',
  metadata_matches: true,
  appears_malicious_or_corrupt: false,
  confidence: 95,
  reasoning: 'Installation manual for a B&D Controll-A-Door 4.',
  ...over,
})

describe('interpretReview', () => {
  it('verifies a clean in-scope manual', () => {
    expect(interpretReview(clean()).verdict).toBe(AiVerdict.VERIFIED)
  })

  it.each([
    ['not a manual', { is_manual: false }],
    ['out of scope', { in_scope: false }],
    ['no technical content', { has_technical_content: false }],
    ['malicious or corrupt', { appears_malicious_or_corrupt: true }],
  ])('rejects when %s', (_label, over) => {
    expect(interpretReview(clean(over)).verdict).toBe(AiVerdict.REJECTED)
  })

  // A typo in a model number is the submitter's mistake, not grounds to
  // throw away a real manual.
  it('sends a metadata mismatch to review rather than rejecting it', () => {
    expect(interpretReview(clean({ metadata_matches: false })).verdict).toBe(
      AiVerdict.NEEDS_REVIEW
    )
  })

  it('reports the most serious finding when several apply', () => {
    const outcome = interpretReview(
      clean({ appears_malicious_or_corrupt: true, is_manual: false, metadata_matches: false })
    )
    expect(outcome.verdict).toBe(AiVerdict.REJECTED)
  })

  it('carries the confidence and reasoning through unchanged', () => {
    const outcome = interpretReview(clean({ confidence: 42, reasoning: 'Blurry scan.' }))
    expect(outcome.confidence).toBe(42)
    expect(outcome.reasoning).toBe('Blurry scan.')
  })

  it('never returns a verdict the schema does not have', () => {
    expect(Object.values(AiVerdict)).toContain(interpretReview(clean()).verdict)
  })
})

describe('not-run and errored outcomes', () => {
  // These must be distinguishable from a pass. A check that did not
  // happen is not a check that found nothing wrong.
  it('records no confidence when nothing ran', () => {
    const outcome = notRun('No AI provider is configured.')
    expect(outcome.verdict).toBe(AiVerdict.NOT_RUN)
    expect(outcome.confidence).toBeNull()
    expect(outcome.reasoning).toContain('No AI provider')
  })

  it('records a failure as its own verdict, not as a pass', () => {
    const outcome = errored('Timed out.')
    expect(outcome.verdict).toBe(AiVerdict.ERRORED)
    expect(outcome.verdict).not.toBe(AiVerdict.VERIFIED)
    expect(outcome.confidence).toBeNull()
  })
})

describe('reviewSchema', () => {
  it('accepts a well-formed review', () => {
    expect(reviewSchema.safeParse(clean()).success).toBe(true)
  })

  it('rejects a confidence outside 0-100', () => {
    expect(reviewSchema.safeParse(clean({ confidence: 101 })).success).toBe(false)
    expect(reviewSchema.safeParse(clean({ confidence: -1 })).success).toBe(false)
  })

  it('rejects a missing field rather than defaulting it', () => {
    const { is_manual: _omitted, ...rest } = clean()
    expect(reviewSchema.safeParse(rest).success).toBe(false)
  })
})

describe('buildUserPrompt', () => {
  const base = { manufacturerName: 'B&D', productName: 'Controll-A-Door 4', modelCode: 'CAD-4' }

  it('states what the submitter claimed', () => {
    const prompt = buildUserPrompt(base)
    expect(prompt).toContain('B&D')
    expect(prompt).toContain('CAD-4')
  })

  it('omits the description line when there is none', () => {
    expect(buildUserPrompt(base)).not.toContain('Their description')
    expect(buildUserPrompt({ ...base, description: 'Found in the garage.' })).toContain(
      'Their description'
    )
  })
})
