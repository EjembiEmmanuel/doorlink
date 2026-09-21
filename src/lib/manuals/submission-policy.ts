import { AiVerdict, SubmissionStatus } from '@prisma/client'
import type { DuplicateConfidence } from './duplicates'

// What an AI verdict is allowed to do to a submission.
//
// This is the rule the brief cares most about: the model never publishes
// anything. Every path out of here lands on a state that still needs a
// person, and APPROVED is not reachable from this function at all — it
// only exists as the result of an admin action.
//
// Pure and exhaustive so the guarantee is testable rather than asserted.

export interface PolicyInput {
  verdict: AiVerdict
  /** 0-100, or null when no check produced one. */
  confidence: number | null
  duplicate: DuplicateConfidence
}

/**
 * Below this, a VERIFIED verdict is not treated as verified.
 *
 * A model that says "this is fine" while reporting low confidence is
 * telling you two things, and the second one is the one that matters.
 */
export const MIN_VERIFIED_CONFIDENCE = 70

export function decideStatus(input: PolicyInput): SubmissionStatus {
  // An exact byte match outranks anything the model said. There is
  // nothing to verify about a file Doorlink already has.
  if (input.duplicate === 'identical') return SubmissionStatus.POSSIBLE_DUPLICATE

  switch (input.verdict) {
    case AiVerdict.REJECTED:
      return SubmissionStatus.FLAGGED

    case AiVerdict.POSSIBLE_DUPLICATE:
      return SubmissionStatus.POSSIBLE_DUPLICATE

    case AiVerdict.VERIFIED:
      if (input.duplicate === 'likely') return SubmissionStatus.POSSIBLE_DUPLICATE
      if (input.confidence === null || input.confidence < MIN_VERIFIED_CONFIDENCE) {
        return SubmissionStatus.AWAITING_REVIEW
      }
      // Still AWAITING_REVIEW, not APPROVED. A confident pass moves a
      // submission to the front of a human's queue; it does not publish
      // it. This line is the whole point of the module.
      return SubmissionStatus.AWAITING_REVIEW

    case AiVerdict.NEEDS_REVIEW:
      return SubmissionStatus.AWAITING_REVIEW

    // No check ran, or the check itself failed. Neither is evidence the
    // document is good, so both go to a person — and a failed check must
    // never be quieter than a passed one.
    case AiVerdict.NOT_RUN:
    case AiVerdict.ERRORED:
      return input.duplicate === 'likely'
        ? SubmissionStatus.POSSIBLE_DUPLICATE
        : SubmissionStatus.AWAITING_REVIEW
  }
}

/** States an admin may still act on. Terminal states are excluded. */
export const REVIEWABLE_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.RECEIVED,
  SubmissionStatus.CHECKING,
  SubmissionStatus.AWAITING_REVIEW,
  SubmissionStatus.FLAGGED,
  SubmissionStatus.POSSIBLE_DUPLICATE,
  SubmissionStatus.INFO_REQUESTED,
]

export function isReviewable(status: SubmissionStatus): boolean {
  return REVIEWABLE_STATUSES.includes(status)
}
