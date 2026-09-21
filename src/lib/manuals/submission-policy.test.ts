import { describe, expect, it } from 'vitest'
import { AiVerdict, SubmissionStatus } from '@prisma/client'
import { MIN_VERIFIED_CONFIDENCE, decideStatus, isReviewable } from './submission-policy'
import type { DuplicateConfidence } from './duplicates'

const decide = (
  verdict: AiVerdict,
  confidence: number | null = 95,
  duplicate: DuplicateConfidence = 'none'
) => decideStatus({ verdict, confidence, duplicate })

describe('decideStatus', () => {
  // The guarantee the whole feature rests on.
  it('never publishes, whatever the AI says', () => {
    const verdicts = Object.values(AiVerdict)
    const confidences: Array<number | null> = [null, 0, 50, 69, 70, 99, 100]
    const duplicates: DuplicateConfidence[] = ['identical', 'likely', 'none']

    for (const verdict of verdicts) {
      for (const confidence of confidences) {
        for (const duplicate of duplicates) {
          expect(decideStatus({ verdict, confidence, duplicate })).not.toBe(
            SubmissionStatus.APPROVED
          )
        }
      }
    }
  })

  it('sends a confident pass to a human, not to the library', () => {
    expect(decide(AiVerdict.VERIFIED, 100)).toBe(SubmissionStatus.AWAITING_REVIEW)
  })

  it('treats a low-confidence pass as no pass at all', () => {
    expect(decide(AiVerdict.VERIFIED, MIN_VERIFIED_CONFIDENCE - 1)).toBe(
      SubmissionStatus.AWAITING_REVIEW
    )
    expect(decide(AiVerdict.VERIFIED, null)).toBe(SubmissionStatus.AWAITING_REVIEW)
  })

  it('flags rather than deletes what the AI rejects', () => {
    expect(decide(AiVerdict.REJECTED)).toBe(SubmissionStatus.FLAGGED)
  })

  it('routes the AI duplicate verdict to the duplicate queue', () => {
    expect(decide(AiVerdict.POSSIBLE_DUPLICATE)).toBe(SubmissionStatus.POSSIBLE_DUPLICATE)
  })

  // Byte-identical is proof; a verdict is an opinion.
  it('lets an identical file outrank any verdict', () => {
    for (const verdict of Object.values(AiVerdict)) {
      expect(decide(verdict, 100, 'identical')).toBe(SubmissionStatus.POSSIBLE_DUPLICATE)
    }
  })

  it('downgrades a pass when metadata looks like a duplicate', () => {
    expect(decide(AiVerdict.VERIFIED, 100, 'likely')).toBe(SubmissionStatus.POSSIBLE_DUPLICATE)
  })

  // A check that did not happen must not be quieter than one that passed.
  it('sends an unchecked submission to a human', () => {
    expect(decide(AiVerdict.NOT_RUN, null)).toBe(SubmissionStatus.AWAITING_REVIEW)
  })

  it('sends a failed check to a human too', () => {
    expect(decide(AiVerdict.ERRORED, null)).toBe(SubmissionStatus.AWAITING_REVIEW)
  })

  it('still notices a likely duplicate when no check ran', () => {
    expect(decide(AiVerdict.NOT_RUN, null, 'likely')).toBe(SubmissionStatus.POSSIBLE_DUPLICATE)
  })

  it('returns a real status for every verdict the schema allows', () => {
    for (const verdict of Object.values(AiVerdict)) {
      expect(Object.values(SubmissionStatus)).toContain(decide(verdict))
    }
  })
})

describe('isReviewable', () => {
  it('lets an admin act on everything still open', () => {
    expect(isReviewable(SubmissionStatus.AWAITING_REVIEW)).toBe(true)
    expect(isReviewable(SubmissionStatus.FLAGGED)).toBe(true)
    expect(isReviewable(SubmissionStatus.POSSIBLE_DUPLICATE)).toBe(true)
    expect(isReviewable(SubmissionStatus.INFO_REQUESTED)).toBe(true)
  })

  it('closes the terminal states', () => {
    expect(isReviewable(SubmissionStatus.APPROVED)).toBe(false)
    expect(isReviewable(SubmissionStatus.REJECTED)).toBe(false)
    expect(isReviewable(SubmissionStatus.WITHDRAWN)).toBe(false)
  })
})
