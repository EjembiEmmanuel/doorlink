import { AnswerStatus, FindingSeverity, QuestionType } from '@prisma/client'
import type { AssetType } from '@prisma/client'
import type {
  AnswerMap,
  DerivedFinding,
  EngineAnswer,
  EngineQuestion,
  EngineRule,
  EngineSection,
  EngineTemplate,
  OutstandingRequirement,
} from './types'

// The inspection engine.
//
// Everything here is a pure function of a template plus the answers
// recorded so far. Nothing reads the database, nothing reads the clock,
// and nothing here decides anything about the law — severity is a
// technician's assessment of how serious a condition is, and it is kept
// separate from the sourced regulatory citations attached to a question
// (brief §13).

// ---------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------

/** Empty assetTypes means "applies to every asset this template covers". */
function appliesToAsset(assetTypes: AssetType[], assetType: AssetType): boolean {
  return assetTypes.length === 0 || assetTypes.includes(assetType)
}

export function visibleSections(template: EngineTemplate, assetType: AssetType): EngineSection[] {
  return template.sections.filter((section) => appliesToAsset(section.assetTypes, assetType))
}

/**
 * Does this answer satisfy a `showWhen.equals` entry?
 *
 * Matched against the status name first ("FAIL"), then the free-text
 * value, then any selected choice — so one condition shape works for a
 * pass/fail question and a dropdown alike without the template author
 * having to know which they are pointing at.
 */
function answerMatches(answer: EngineAnswer | undefined, equals: string[]): boolean {
  if (!answer) return false
  return equals.some(
    (want) =>
      answer.status === want ||
      answer.valueText === want ||
      answer.valueChoices.includes(want)
  )
}

/**
 * Whether a question should be shown, following `showWhen` through any
 * chain of dependencies.
 *
 * A question whose controlling question is itself hidden is hidden too:
 * "is the safety edge undamaged?" must not appear because a stale answer
 * says a safety edge is fitted, when the question that asked whether one
 * is fitted no longer applies to this asset.
 *
 * `seen` breaks cycles. A template that makes A depend on B and B on A
 * is a template-builder bug, but it must not hang the wizard, so a cycle
 * resolves to hidden and the template validator reports it separately.
 */
export function isQuestionVisible(
  question: EngineQuestion,
  questions: ReadonlyMap<string, EngineQuestion>,
  answers: AnswerMap,
  seen: ReadonlySet<string> = new Set()
): boolean {
  if (!question.showWhen) return true
  if (seen.has(question.code)) return false

  const controller = questions.get(question.showWhen.questionCode)
  // Pointing at a question that is not in this template is a broken
  // condition. Showing the question is the safe failure: a technician
  // seeing one question too many is recoverable, silently dropping a
  // safety question is not.
  if (!controller) return true

  const nextSeen = new Set(seen)
  nextSeen.add(question.code)
  if (!isQuestionVisible(controller, questions, answers, nextSeen)) return false

  return answerMatches(answers.get(question.showWhen.questionCode), question.showWhen.equals)
}

export function indexQuestions(template: EngineTemplate): Map<string, EngineQuestion> {
  const map = new Map<string, EngineQuestion>()
  for (const section of template.sections) {
    for (const question of section.questions) map.set(question.code, question)
  }
  return map
}

export function indexAnswers(answers: readonly EngineAnswer[]): Map<string, EngineAnswer> {
  return new Map(answers.map((answer) => [answer.questionCode, answer]))
}

/** Sections and questions a technician should actually see right now. */
export function visibleQuestions(
  template: EngineTemplate,
  assetType: AssetType,
  answers: AnswerMap
): EngineQuestion[] {
  const index = indexQuestions(template)
  return visibleSections(template, assetType).flatMap((section) =>
    section.questions.filter((question) => isQuestionVisible(question, index, answers))
  )
}

// ---------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------

/**
 * Has this question been answered at all?
 *
 * NOT_TESTED counts as answered: "I could not test this" is a real
 * finding a technician is entitled to record, and refusing to accept it
 * would push them toward recording a PASS they did not verify.
 */
export function isAnswered(question: EngineQuestion, answer: EngineAnswer | undefined): boolean {
  if (!answer) return false
  if (answer.status !== null) return true
  if (answer.valueText !== null && answer.valueText.trim().length > 0) return true
  if (answer.valueNumber !== null) return true
  if (answer.valueDate !== null) return true
  if (answer.valueChoices.length > 0) return true
  // A photo question is answered by the photo itself.
  if (question.requirePhoto && answer.evidenceCount > 0) return true
  return false
}

// ---------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------

function ruleFires(rule: EngineRule, answer: EngineAnswer): boolean {
  // A rule with neither condition set would fire on every answer,
  // including an unanswered one. That is a template-builder mistake
  // rather than an intention, so it never fires.
  if (rule.whenStatus === null && rule.whenValue === null) return false
  if (rule.whenStatus !== null && answer.status !== rule.whenStatus) return false
  if (
    rule.whenValue !== null &&
    answer.valueText !== rule.whenValue &&
    !answer.valueChoices.includes(rule.whenValue)
  ) {
    return false
  }
  return true
}

export function firedRules(question: EngineQuestion, answer: EngineAnswer | undefined): EngineRule[] {
  if (!answer) return []
  return question.rules.filter((rule) => ruleFires(rule, answer))
}

/**
 * The findings the rules raise for one answer. These are a starting
 * point shown to the technician in the review step — they are persisted
 * as `ruleGenerated` findings the technician can edit or dismiss with a
 * reason, never as conclusions the report states on their behalf.
 */
export function derivedFindings(
  question: EngineQuestion,
  answer: EngineAnswer | undefined
): DerivedFinding[] {
  return firedRules(question, answer)
    .filter((rule) => rule.flag)
    .map((rule) => ({
      questionCode: question.code,
      ruleId: rule.id,
      title: question.prompt,
      severity: rule.severity,
      recommendation: rule.recommendation,
      suggestedActionTitle: rule.suggestedActionTitle,
    }))
}

// ---------------------------------------------------------------------
// Completion requirements
// ---------------------------------------------------------------------

export interface EngineOptions {
  /**
   * False when the storage backend cannot accept uploads.
   *
   * A photo requirement is then unsatisfiable through no fault of the
   * technician, and enforcing it would mean no inspection on that
   * deployment could ever be completed — the feature would not be
   * degraded, it would be unusable. So the requirement relaxes, and the
   * report states plainly that photographic evidence could not be
   * captured. What is never done is the other resolution: marking the
   * requirement met, which would imply a photo exists.
   */
  photoCaptureAvailable: boolean
}

const DEFAULT_OPTIONS: EngineOptions = { photoCaptureAvailable: true }

function isEvidenceQuestion(question: EngineQuestion): boolean {
  return question.type === QuestionType.PHOTO || question.type === QuestionType.VIDEO
}

/**
 * What is still missing before this inspection can be submitted.
 *
 * Evaluated on the server from the template, not from the form, so a
 * photo requirement cannot be skipped by posting the form without it.
 * Only visible questions are considered: a question the asset never had
 * to answer can never block it.
 */
export function outstandingRequirements(
  template: EngineTemplate,
  assetType: AssetType,
  answers: AnswerMap,
  options: EngineOptions = DEFAULT_OPTIONS
): OutstandingRequirement[] {
  const index = indexQuestions(template)
  const out: OutstandingRequirement[] = []

  for (const section of visibleSections(template, assetType)) {
    for (const question of section.questions) {
      if (!isQuestionVisible(question, index, answers)) continue

      // A question whose only possible answer is a file cannot be
      // answered at all without somewhere to put the file.
      if (isEvidenceQuestion(question) && !options.photoCaptureAvailable) continue

      const answer = answers.get(question.code)
      if (!isAnswered(question, answer)) {
        if (question.required) {
          out.push({ questionCode: question.code, prompt: question.prompt, reason: 'unanswered' })
        }
        // An unanswered question cannot owe a note or a photo yet.
        continue
      }

      const rules = firedRules(question, answer)
      const needsNote = rules.some((rule) => rule.requireNote)
      const needsPhoto =
        options.photoCaptureAvailable &&
        (question.requirePhoto || rules.some((rule) => rule.requirePhoto))

      if (needsNote && (answer?.note ?? '').trim().length === 0) {
        out.push({ questionCode: question.code, prompt: question.prompt, reason: 'note-required' })
      }
      if (needsPhoto && (answer?.evidenceCount ?? 0) === 0) {
        out.push({ questionCode: question.code, prompt: question.prompt, reason: 'photo-required' })
      }
    }
  }

  return out
}

/**
 * Questions that asked for a photograph but could not be given one
 * because the deployment has no file storage. Printed on the report so
 * a reader knows what evidence is missing and why, rather than being
 * left to assume none was thought necessary.
 */
export function unmetPhotoRequirements(
  template: EngineTemplate,
  assetType: AssetType,
  answers: AnswerMap,
  options: EngineOptions = DEFAULT_OPTIONS
): string[] {
  if (options.photoCaptureAvailable) return []
  const index = indexQuestions(template)

  return visibleSections(template, assetType)
    .flatMap((section) => section.questions)
    .filter((question) => isQuestionVisible(question, index, answers))
    .filter((question) => {
      if (isEvidenceQuestion(question)) return true
      if (question.requirePhoto) return true
      return firedRules(question, answers.get(question.code)).some((rule) => rule.requirePhoto)
    })
    .map((question) => question.prompt)
}

export interface InspectionProgress {
  visible: number
  answered: number
  /** 0–100, for the progress bar only — never presented as a safety score. */
  percent: number
}

export function inspectionProgress(
  template: EngineTemplate,
  assetType: AssetType,
  answers: AnswerMap
): InspectionProgress {
  const questions = visibleQuestions(template, assetType, answers)
  const answered = questions.filter((question) => isAnswered(question, answers.get(question.code))).length
  return {
    visible: questions.length,
    answered,
    percent: questions.length === 0 ? 0 : Math.round((answered / questions.length) * 100),
  }
}

// ---------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  INFO: 0,
  OBSERVATION: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  CRITICAL: 5,
}

export function severityRank(severity: FindingSeverity): number {
  return SEVERITY_RANK[severity]
}

export function highestSeverity(severities: readonly FindingSeverity[]): FindingSeverity | null {
  return severities.reduce<FindingSeverity | null>(
    (worst, severity) =>
      worst === null || SEVERITY_RANK[severity] > SEVERITY_RANK[worst] ? severity : worst,
    null
  )
}

/**
 * How severity maps to the headline result.
 *
 * Exported because brief §17 requires the methodology to be visible: the
 * inspection page states these thresholds in words rather than
 * presenting a verdict the reader cannot account for.
 */
export const RESULT_POLICY = {
  failedAtOrAbove: FindingSeverity.HIGH,
  attentionAtOrAbove: FindingSeverity.LOW,
} as const

export interface ResultInput {
  /** Findings that survived review — dismissed ones are excluded by the caller. */
  severities: readonly FindingSeverity[]
  outstanding: readonly OutstandingRequirement[]
  /** Answers recorded as FAIL, counted even where no rule was configured. */
  failedAnswers: number
}

/**
 * The headline outcome.
 *
 * Deliberately a status, not a percentage: a door with a dead emergency
 * stop is not "92% safe", and a number invites exactly that reading. The
 * counts that back this up (passed, failed, flagged, actions) are shown
 * beside it so the reader can check the conclusion rather than trust it.
 */
export function deriveResult(input: ResultInput): 'PASS' | 'ATTENTION_REQUIRED' | 'FAILED' | 'INCOMPLETE' {
  // A failure is reportable even from a part-finished inspection —
  // it does not become less true because the technician was called away.
  const worst = highestSeverity(input.severities)
  if (worst !== null && SEVERITY_RANK[worst] >= SEVERITY_RANK[RESULT_POLICY.failedAtOrAbove]) {
    return 'FAILED'
  }
  if (input.outstanding.length > 0) return 'INCOMPLETE'
  if (worst !== null && SEVERITY_RANK[worst] >= SEVERITY_RANK[RESULT_POLICY.attentionAtOrAbove]) {
    return 'ATTENTION_REQUIRED'
  }
  if (input.failedAnswers > 0) return 'ATTENTION_REQUIRED'
  return 'PASS'
}

export interface InspectionTally {
  passed: number
  failed: number
  notApplicable: number
  notTested: number
}

export function tallyAnswers(
  template: EngineTemplate,
  assetType: AssetType,
  answers: AnswerMap
): InspectionTally {
  const tally: InspectionTally = { passed: 0, failed: 0, notApplicable: 0, notTested: 0 }
  for (const question of visibleQuestions(template, assetType, answers)) {
    const status = answers.get(question.code)?.status
    if (status === AnswerStatus.PASS) tally.passed += 1
    else if (status === AnswerStatus.FAIL) tally.failed += 1
    else if (status === AnswerStatus.NOT_APPLICABLE) tally.notApplicable += 1
    else if (status === AnswerStatus.NOT_TESTED) tally.notTested += 1
  }
  return tally
}
