import type { SeedTemplate } from './templates'

// Structural checks on a template.
//
// A template is data, which means the ways it can be wrong are data
// bugs, not type errors: a condition pointing at a question that was
// renamed, two questions sharing a code, a pair of questions that
// depend on each other. None of those fail to compile, and all of them
// change what a technician is asked. They are checked here so a broken
// template is caught in the test run rather than discovered by someone
// standing at a roller shutter.

export type TemplateProblem =
  | { kind: 'duplicate-code'; code: string }
  | { kind: 'unknown-condition-target'; code: string; target: string }
  | { kind: 'condition-cycle'; code: string }
  | { kind: 'rule-without-condition'; code: string }
  | { kind: 'select-without-options'; code: string }

const SELECT_TYPES = new Set(['SINGLE_SELECT', 'MULTI_SELECT', 'DROPDOWN', 'SEARCHABLE_DROPDOWN'])

export function validateTemplate(template: SeedTemplate): TemplateProblem[] {
  const problems: TemplateProblem[] = []
  const questions = template.sections.flatMap((section) => section.questions)

  const seen = new Set<string>()
  for (const question of questions) {
    if (seen.has(question.code)) problems.push({ kind: 'duplicate-code', code: question.code })
    seen.add(question.code)
  }

  const byCode = new Map(questions.map((question) => [question.code, question]))

  for (const question of questions) {
    if (question.showWhen && !byCode.has(question.showWhen.questionCode)) {
      problems.push({
        kind: 'unknown-condition-target',
        code: question.code,
        target: question.showWhen.questionCode,
      })
    }

    for (const rule of question.rules ?? []) {
      // A rule with neither condition would match every answer. The
      // engine refuses to fire it, so this is dead configuration rather
      // than a hazard — but it is always a mistake.
      if (rule.whenStatus === undefined && rule.whenValue === undefined) {
        problems.push({ kind: 'rule-without-condition', code: question.code })
      }
    }

    if (SELECT_TYPES.has(question.type ?? '') && (question.options ?? []).length === 0) {
      problems.push({ kind: 'select-without-options', code: question.code })
    }
  }

  for (const question of questions) {
    const seenInWalk = new Set<string>()
    let current = question
    while (current.showWhen) {
      if (seenInWalk.has(current.code)) {
        problems.push({ kind: 'condition-cycle', code: question.code })
        break
      }
      seenInWalk.add(current.code)
      const next = byCode.get(current.showWhen.questionCode)
      if (!next) break
      current = next
    }
  }

  return problems
}
