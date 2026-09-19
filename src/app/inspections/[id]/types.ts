import type { AnswerStatus, QuestionType } from '@prisma/client'

// The shapes the wizard's client components receive. Narrower than the
// engine's types: the client is sent what it needs to render and
// answer, not the rule definitions, which stay on the server where they
// are enforced.

export interface WizardQuestion {
  id: string
  code: string
  prompt: string
  helpText: string | null
  type: QuestionType
  required: boolean
  options: string[]
  requirePhoto: boolean
  recommendPhoto: boolean
  /** Precomputed from the rules so the card can prompt without holding them. */
  requiresNoteWhenFailed: boolean
  requiresPhotoWhenFailed: boolean
}

export interface WizardSection {
  id: string
  title: string
  description: string | null
  questions: WizardQuestion[]
}

export interface WizardAnswer {
  status: AnswerStatus | null
  valueText: string
  valueChoices: string[]
  note: string
  evidenceCount: number
}
