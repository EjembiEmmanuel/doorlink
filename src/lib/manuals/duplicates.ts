import { normaliseModel } from './normalise'

// Duplicate detection for submitted manuals.
//
// Two questions, answered separately because they have different
// certainties. Identical bytes are proof. Similar metadata is a
// suspicion — strong enough to put in front of a reviewer, never strong
// enough to reject on its own, because the same model legitimately has
// several different documents (install, user, parts, wiring) and several
// editions of each.
//
// Pure: candidates are passed in, so this is testable without a database
// and the caller decides how wide to cast the net.

export interface DuplicateCandidate {
  documentId: string
  title: string
  /** SHA-256 of the stored file, when Doorlink hosts one. */
  sha256?: string | null
  manufacturerName?: string | null
  modelCode?: string | null
}

export interface SubmissionFingerprint {
  sha256: string
  manufacturerName: string
  modelCode: string
  productName: string
}

export type DuplicateConfidence = 'identical' | 'likely' | 'none'

export interface DuplicateFinding {
  confidence: DuplicateConfidence
  documentId?: string
  /** Why, in words a reviewer can check rather than a bare score. */
  reason?: string
}

const simplify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Manufacturer names match loosely — "B&D" and "B and D" are one brand. */
function sameManufacturer(a: string, b: string): boolean {
  const left = simplify(a).replace(/\band\b/g, '')
  const right = simplify(b).replace(/\band\b/g, '')
  const squash = (value: string) => value.replace(/\s+/g, '')
  return squash(left) === squash(right) && squash(left).length > 0
}

/**
 * The strongest duplicate signal present.
 *
 * Byte-identical beats everything and is reported as `identical`. Short
 * of that, the same manufacturer and the same normalised model code is
 * `likely` — which routes to a human, because it is exactly as
 * consistent with "second edition" or "the parts list as well as the
 * manual" as it is with "we already have this".
 */
export function findDuplicate(
  submission: SubmissionFingerprint,
  candidates: readonly DuplicateCandidate[]
): DuplicateFinding {
  const identical = candidates.find(
    (candidate) => !!candidate.sha256 && candidate.sha256 === submission.sha256
  )
  if (identical) {
    return {
      confidence: 'identical',
      documentId: identical.documentId,
      reason: `Byte-for-byte identical to an existing document (${identical.title}).`,
    }
  }

  const submittedModel = normaliseModel(submission.modelCode)
  if (submittedModel.length > 0) {
    const likely = candidates.find((candidate) => {
      if (!candidate.modelCode || !candidate.manufacturerName) return false
      if (normaliseModel(candidate.modelCode) !== submittedModel) return false
      return sameManufacturer(candidate.manufacturerName, submission.manufacturerName)
    })
    if (likely) {
      return {
        confidence: 'likely',
        documentId: likely.documentId,
        reason:
          `Same manufacturer and model as an existing document (${likely.title}). ` +
          'That is not proof — a model can have several documents and several editions — so a person should compare them.',
      }
    }
  }

  return { confidence: 'none' }
}
