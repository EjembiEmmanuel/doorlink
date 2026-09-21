import { describe, expect, it } from 'vitest'
import { AnswerStatus, AssetType, FindingSeverity, QuestionType } from '@prisma/client'
import { DEFAULT_TEMPLATES, PREVENTATIVE_MAINTENANCE } from './templates'
import { validateTemplate } from './validate'
import { indexAnswers, outstandingRequirements, visibleQuestions } from './engine'
import type { EngineTemplate } from './types'

// The shipped templates are content, and content bugs do not fail to
// compile. These tests are the thing standing between a renamed
// question code and a technician being shown the wrong questions.

function toEngine(seed: (typeof DEFAULT_TEMPLATES)[number]): EngineTemplate {
  return {
    id: seed.slug,
    name: seed.name,
    version: 1,
    assetTypes: seed.assetTypes,
    sections: seed.sections.map((section, i) => ({
      id: `s${i}`,
      title: section.title,
      description: section.description ?? null,
      assetTypes: section.assetTypes ?? [],
      questions: section.questions.map((question) => ({
        id: question.code,
        code: question.code,
        prompt: question.prompt,
        helpText: question.helpText ?? null,
        type: question.type ?? QuestionType.PASS_FAIL_NA,
        required: question.required ?? true,
        options: question.options ?? [],
        unit: question.unit ?? null,
        requirePhoto: question.requirePhoto ?? false,
        recommendPhoto: question.recommendPhoto ?? false,
        showWhen: question.showWhen ?? null,
        rules: (question.rules ?? []).map((rule, ri) => ({
          id: `${question.code}-r${ri}`,
          whenStatus: rule.whenStatus ?? null,
          whenValue: rule.whenValue ?? null,
          severity: rule.severity,
          flag: true,
          requireNote: rule.requireNote ?? false,
          requirePhoto: rule.requirePhoto ?? false,
          recommendation: rule.recommendation ?? null,
          suggestedActionTitle: rule.suggestedActionTitle ?? null,
        })),
      })),
    })),
  }
}

describe.each(DEFAULT_TEMPLATES.map((t) => [t.name, t] as const))('%s', (_name, seed) => {
  it('is structurally valid', () => {
    expect(validateTemplate(seed)).toEqual([])
  })

  it('gives every question a non-empty prompt', () => {
    const blank = seed.sections
      .flatMap((s) => s.questions)
      .filter((q) => q.prompt.trim().length === 0)
    expect(blank).toEqual([])
  })
})

describe('preventative maintenance template applied to an asset', () => {
  const engine = toEngine(PREVENTATIVE_MAINTENANCE)

  it('shows roller shutter configuration to a roller shutter', () => {
    const codes = visibleQuestions(engine, AssetType.ROLLER_SHUTTER, indexAnswers([])).map((q) => q.code)
    expect(codes).toContain('CFG_SHUTTER_DRIVE')
  })

  it('never shows roller shutter configuration on a swing gate', () => {
    const codes = visibleQuestions(engine, AssetType.SWING_GATE, indexAnswers([])).map((q) => q.code)
    expect(codes).not.toContain('CFG_SHUTTER_DRIVE')
    expect(codes).not.toContain('CFG_SECT_SPRING')
    expect(codes).toContain('CFG_GATE_TYPE')
  })

  it('applies the shared safety sections to every asset type', () => {
    for (const assetType of Object.values(AssetType)) {
      const codes = visibleQuestions(engine, assetType, indexAnswers([])).map((q) => q.code)
      expect(codes).toContain('OP_ESTOP_FITTED')
      expect(codes).toContain('PED_UNCONTROLLED')
    }
  })

  it('does not ask whether the emergency stop works until one is fitted', () => {
    const none = visibleQuestions(engine, AssetType.GARAGE_DOOR, indexAnswers([])).map((q) => q.code)
    expect(none).not.toContain('OP_ESTOP_WORKS')

    const fitted = indexAnswers([
      {
        questionCode: 'OP_ESTOP_FITTED',
        status: null,
        valueText: 'YES',
        valueNumber: null,
        valueDate: null,
        valueChoices: [],
        note: null,
        evidenceCount: 0,
      },
    ])
    const shown = visibleQuestions(engine, AssetType.GARAGE_DOOR, fitted).map((q) => q.code)
    expect(shown).toContain('OP_ESTOP_WORKS')
  })

  it('demands a note and a photo for a failed emergency stop', () => {
    const answers = indexAnswers([
      {
        questionCode: 'OP_ESTOP_FITTED',
        status: null,
        valueText: 'YES',
        valueNumber: null,
        valueDate: null,
        valueChoices: [],
        note: null,
        evidenceCount: 0,
      },
      {
        questionCode: 'OP_ESTOP_WORKS',
        status: AnswerStatus.FAIL,
        valueText: null,
        valueNumber: null,
        valueDate: null,
        valueChoices: [],
        note: null,
        evidenceCount: 0,
      },
    ])
    const reasons = outstandingRequirements(engine, AssetType.GARAGE_DOOR, answers)
      .filter((o) => o.questionCode === 'OP_ESTOP_WORKS')
      .map((o) => o.reason)
    expect(reasons).toEqual(['note-required', 'photo-required'])
  })

  it('grades a failed emergency stop as critical', () => {
    const question = engine.sections
      .flatMap((s) => s.questions)
      .find((q) => q.code === 'OP_ESTOP_WORKS')
    const rule = question?.rules.find((r) => r.whenStatus === AnswerStatus.FAIL)
    expect(rule?.severity).toBe(FindingSeverity.CRITICAL)
  })

  it('flags a powered asset recorded as having no protective device', () => {
    const question = engine.sections
      .flatMap((s) => s.questions)
      .find((q) => q.code === 'PED_SAFETY_DEVICE_FITTED')
    const rule = question?.rules.find((r) => r.whenValue === 'None fitted')
    expect(rule?.severity).toBe(FindingSeverity.HIGH)
    // It recommends a review against intended use, rather than asserting
    // the installation is unlawful — that judgement is not this
    // template's to make.
    expect(rule?.recommendation).toMatch(/review/i)
  })
})

describe('regulatory honesty', () => {
  // Brief §36: the template must not fabricate regulations. Citations
  // belong in ComplianceReference, where they carry a jurisdiction and a
  // last-reviewed date. If someone adds "AS/NZS 60335" to a prompt, this
  // fails and points them at the right place to put it.
  const STANDARD_SHAPED = /\b(AS\/NZS|AS\s?\d{4}|ISO\s?\d|EN\s?\d{3}|clause\s+\d|s\.\s?\d+|regulation\s+\d)/i

  it.each(DEFAULT_TEMPLATES.map((t) => [t.name, t] as const))(
    '%s cites no regulation in question text',
    (_name, seed) => {
      const offenders = seed.sections
        .flatMap((s) => s.questions)
        .filter(
          (q) =>
            STANDARD_SHAPED.test(q.prompt) ||
            STANDARD_SHAPED.test(q.helpText ?? '') ||
            (q.rules ?? []).some((r) => STANDARD_SHAPED.test(r.recommendation ?? ''))
        )
        .map((q) => q.code)
      expect(offenders).toEqual([])
    }
  )
})

describe('validateTemplate', () => {
  it('catches a duplicate question code', () => {
    const broken = {
      slug: 'x',
      name: 'X',
      description: '',
      assetTypes: [],
      sections: [
        {
          title: 'S',
          questions: [
            { code: 'DUP', prompt: 'a' },
            { code: 'DUP', prompt: 'b' },
          ],
        },
      ],
    }
    expect(validateTemplate(broken)).toContainEqual({ kind: 'duplicate-code', code: 'DUP' })
  })

  it('catches a condition pointing at a question that does not exist', () => {
    const broken = {
      slug: 'x',
      name: 'X',
      description: '',
      assetTypes: [],
      sections: [
        {
          title: 'S',
          questions: [{ code: 'A', prompt: 'a', showWhen: { questionCode: 'GONE', equals: ['YES'] } }],
        },
      ],
    }
    expect(validateTemplate(broken)).toContainEqual({
      kind: 'unknown-condition-target',
      code: 'A',
      target: 'GONE',
    })
  })

  it('catches a condition cycle', () => {
    const broken = {
      slug: 'x',
      name: 'X',
      description: '',
      assetTypes: [],
      sections: [
        {
          title: 'S',
          questions: [
            { code: 'A', prompt: 'a', showWhen: { questionCode: 'B', equals: ['YES'] } },
            { code: 'B', prompt: 'b', showWhen: { questionCode: 'A', equals: ['YES'] } },
          ],
        },
      ],
    }
    expect(validateTemplate(broken).some((p) => p.kind === 'condition-cycle')).toBe(true)
  })

  it('catches a select question with no options', () => {
    const broken = {
      slug: 'x',
      name: 'X',
      description: '',
      assetTypes: [],
      sections: [
        { title: 'S', questions: [{ code: 'A', prompt: 'a', type: QuestionType.SINGLE_SELECT }] },
      ],
    }
    expect(validateTemplate(broken)).toContainEqual({ kind: 'select-without-options', code: 'A' })
  })
})
