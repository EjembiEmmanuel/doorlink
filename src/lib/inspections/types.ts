import type { AnswerStatus, AssetType, FindingSeverity, QuestionType } from '@prisma/client'

// The engine's own view of a template and its answers.
//
// These types are deliberately not Prisma models. The rules that decide
// what a technician is asked, what they must supply before they can
// finish, and what the inspection concluded are the part of this feature
// most worth testing — and they are testable in isolation only while
// they depend on plain data rather than on a database row. Callers map
// Prisma rows into these shapes at the edge (see `fromTemplate` in
// `load.ts`); everything below is pure.

/**
 * Shows a question only when another question in the same template
 * carries one of the listed answers. Matched against the other
 * question's `status` first, then its text/choice values, so the same
 * condition works for both pass/fail questions and select questions.
 */
export interface ShowWhen {
  questionCode: string
  equals: string[]
}

export interface EngineRule {
  id: string
  /** Fires on this answer status. Null means "any status". */
  whenStatus: AnswerStatus | null
  /** Fires on this recorded value. Null means "any value". */
  whenValue: string | null
  severity: FindingSeverity
  flag: boolean
  requireNote: boolean
  requirePhoto: boolean
  recommendation: string | null
  suggestedActionTitle: string | null
}

export interface EngineQuestion {
  id: string
  code: string
  prompt: string
  helpText: string | null
  type: QuestionType
  required: boolean
  options: string[]
  unit: string | null
  requirePhoto: boolean
  recommendPhoto: boolean
  showWhen: ShowWhen | null
  rules: EngineRule[]
}

export interface EngineSection {
  id: string
  title: string
  description: string | null
  /** Empty means "every asset this template covers". */
  assetTypes: AssetType[]
  questions: EngineQuestion[]
}

export interface EngineTemplate {
  id: string
  name: string
  version: number
  assetTypes: AssetType[]
  sections: EngineSection[]
}

/**
 * A recorded answer. `evidenceCount` is how many files are actually
 * stored against it — not how many the technician meant to attach, which
 * is why a photo requirement can never be satisfied by an upload that
 * failed.
 */
export interface EngineAnswer {
  questionCode: string
  status: AnswerStatus | null
  valueText: string | null
  valueNumber: number | null
  valueDate: Date | null
  valueChoices: string[]
  note: string | null
  evidenceCount: number
}

export type AnswerMap = ReadonlyMap<string, EngineAnswer>

/** Something that must be supplied before the inspection can be submitted. */
export interface OutstandingRequirement {
  questionCode: string
  prompt: string
  reason: 'unanswered' | 'note-required' | 'photo-required'
}

/** A finding the rules produced, before it is persisted or edited. */
export interface DerivedFinding {
  questionCode: string
  ruleId: string
  title: string
  severity: FindingSeverity
  recommendation: string | null
  suggestedActionTitle: string | null
}
