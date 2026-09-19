import { AnswerStatus } from '@prisma/client'
import type { EngineAnswer } from './types'

// Comparing one inspection of an asset against the one before it.
//
// This is the whole point of holding history against the asset rather
// than the visit: it is what lets a report say "this was also recorded
// in June" from stored answers instead of a technician's memory.
//
// It reports repetition and nothing else. It does not say why something
// recurred, whether a repair failed, or whether anyone is at fault —
// those need a person looking at the equipment, and a system that
// guesses at them produces confident nonsense in a document a customer
// may rely on (brief §25).

export interface ComparableInspection {
  id: string
  reference: string
  submittedAt: Date | null
  answers: readonly EngineAnswer[]
}

export type ComparisonState = 'new' | 'recurring' | 'resolved' | 'unchanged'

export interface QuestionComparison {
  questionCode: string
  state: ComparisonState
  currentStatus: AnswerStatus | null
  previousStatus: AnswerStatus | null
}

function isFail(status: AnswerStatus | null | undefined): boolean {
  return status === AnswerStatus.FAIL
}

/**
 * Compare the current answers against the previous inspection's.
 *
 * Keyed on `questionCode`, which is stable across template versions —
 * the row id is not, so comparing on it would report every question as
 * new the first time a template is republished.
 *
 * Questions the previous inspection never asked are reported as `new`
 * when they fail, and skipped otherwise: a template that gained a
 * question should not claim the last inspection resolved something it
 * was never asked about.
 */
export function compareInspections(
  current: readonly EngineAnswer[],
  previous: readonly EngineAnswer[]
): QuestionComparison[] {
  const previousByCode = new Map(previous.map((answer) => [answer.questionCode, answer]))
  const out: QuestionComparison[] = []

  for (const answer of current) {
    const before = previousByCode.get(answer.questionCode)
    const nowFailing = isFail(answer.status)
    const wasFailing = isFail(before?.status)

    if (nowFailing && wasFailing) {
      out.push({
        questionCode: answer.questionCode,
        state: 'recurring',
        currentStatus: answer.status,
        previousStatus: before?.status ?? null,
      })
    } else if (nowFailing && !wasFailing) {
      out.push({
        questionCode: answer.questionCode,
        state: 'new',
        currentStatus: answer.status,
        previousStatus: before?.status ?? null,
      })
    } else if (!nowFailing && wasFailing) {
      out.push({
        questionCode: answer.questionCode,
        state: 'resolved',
        currentStatus: answer.status,
        previousStatus: before?.status ?? null,
      })
    }
  }

  // A question the previous inspection failed that this one never
  // reached is not resolved — it is unanswered, and reporting it as
  // fixed would be the most damaging thing this function could do.
  const currentCodes = new Set(current.map((answer) => answer.questionCode))
  for (const answer of previous) {
    if (isFail(answer.status) && !currentCodes.has(answer.questionCode)) {
      out.push({
        questionCode: answer.questionCode,
        state: 'unchanged',
        currentStatus: null,
        previousStatus: answer.status,
      })
    }
  }

  return out
}

export function recurringCodes(comparisons: readonly QuestionComparison[]): string[] {
  return comparisons.filter((c) => c.state === 'recurring').map((c) => c.questionCode)
}
