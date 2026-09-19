import { describe, expect, it } from 'vitest'
import { AnswerStatus, AssetType, FindingSeverity, QuestionType } from '@prisma/client'
import {
  derivedFindings,
  deriveResult,
  indexAnswers,
  indexQuestions,
  inspectionProgress,
  isQuestionVisible,
  outstandingRequirements,
  tallyAnswers,
  visibleQuestions,
  visibleSections,
} from './engine'
import { compareInspections, recurringCodes } from './history'
import type { EngineAnswer, EngineQuestion, EngineRule, EngineTemplate } from './types'

function question(overrides: Partial<EngineQuestion> & { code: string }): EngineQuestion {
  return {
    id: `q-${overrides.code}`,
    prompt: `Prompt for ${overrides.code}`,
    helpText: null,
    type: QuestionType.PASS_FAIL_NA,
    required: true,
    options: [],
    unit: null,
    requirePhoto: false,
    recommendPhoto: false,
    showWhen: null,
    rules: [],
    ...overrides,
  }
}

function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  return {
    id: 'r1',
    whenStatus: AnswerStatus.FAIL,
    whenValue: null,
    severity: FindingSeverity.HIGH,
    flag: true,
    requireNote: true,
    requirePhoto: false,
    recommendation: null,
    suggestedActionTitle: null,
    ...overrides,
  }
}

function answer(overrides: Partial<EngineAnswer> & { questionCode: string }): EngineAnswer {
  return {
    status: null,
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueChoices: [],
    note: null,
    evidenceCount: 0,
    ...overrides,
  }
}

function template(questions: EngineQuestion[], assetTypes: AssetType[] = []): EngineTemplate {
  return {
    id: 't1',
    name: 'Test template',
    version: 1,
    assetTypes,
    sections: [
      { id: 's1', title: 'Section', description: null, assetTypes, questions },
    ],
  }
}

describe('section visibility by asset type', () => {
  const shutterOnly: EngineTemplate = {
    id: 't',
    name: 'Mixed',
    version: 1,
    assetTypes: [],
    sections: [
      {
        id: 'generic',
        title: 'Generic',
        description: null,
        assetTypes: [],
        questions: [question({ code: 'GENERIC' })],
      },
      {
        id: 'shutter',
        title: 'Roller shutter',
        description: null,
        assetTypes: [AssetType.ROLLER_SHUTTER],
        questions: [question({ code: 'CURTAIN' })],
      },
    ],
  }

  it('includes a section with no asset types for every asset', () => {
    const titles = visibleSections(shutterOnly, AssetType.AUTOMATIC_GATE).map((s) => s.title)
    expect(titles).toEqual(['Generic'])
  })

  it('includes an asset-specific section only for that asset', () => {
    const titles = visibleSections(shutterOnly, AssetType.ROLLER_SHUTTER).map((s) => s.title)
    expect(titles).toEqual(['Generic', 'Roller shutter'])
  })
})

describe('conditional questions', () => {
  const fitted = question({ code: 'EDGE_FITTED', type: QuestionType.YES_NO })
  const condition = question({
    code: 'EDGE_OK',
    showWhen: { questionCode: 'EDGE_FITTED', equals: ['YES'] },
  })
  const tpl = template([fitted, condition])
  const index = indexQuestions(tpl)

  it('hides a dependent question until the controlling answer matches', () => {
    const answers = indexAnswers([])
    expect(isQuestionVisible(condition, index, answers)).toBe(false)
  })

  it('shows it once the controlling answer matches', () => {
    const answers = indexAnswers([answer({ questionCode: 'EDGE_FITTED', valueText: 'YES' })])
    expect(isQuestionVisible(condition, index, answers)).toBe(true)
  })

  it('keeps it hidden when the controlling answer is something else', () => {
    const answers = indexAnswers([answer({ questionCode: 'EDGE_FITTED', valueText: 'NO' })])
    expect(isQuestionVisible(condition, index, answers)).toBe(false)
  })

  it('matches on answer status as well as free text', () => {
    const onStatus = question({
      code: 'WHY_FAILED',
      showWhen: { questionCode: 'EDGE_FITTED', equals: ['FAIL'] },
    })
    const withStatus = template([fitted, onStatus])
    const answers = indexAnswers([answer({ questionCode: 'EDGE_FITTED', status: AnswerStatus.FAIL })])
    expect(isQuestionVisible(onStatus, indexQuestions(withStatus), answers)).toBe(true)
  })

  it('hides a question whose controlling question is itself hidden', () => {
    // A depends on B, B depends on C, and C was never answered. A stale
    // answer to B must not resurrect A.
    const c = question({ code: 'C', type: QuestionType.YES_NO })
    const b = question({ code: 'B', showWhen: { questionCode: 'C', equals: ['YES'] } })
    const a = question({ code: 'A', showWhen: { questionCode: 'B', equals: ['PASS'] } })
    const chained = template([c, b, a])
    const answers = indexAnswers([answer({ questionCode: 'B', status: AnswerStatus.PASS })])
    expect(isQuestionVisible(a, indexQuestions(chained), answers)).toBe(false)
  })

  it('resolves a dependency cycle to hidden rather than hanging', () => {
    const a = question({ code: 'A', showWhen: { questionCode: 'B', equals: ['PASS'] } })
    const b = question({ code: 'B', showWhen: { questionCode: 'A', equals: ['PASS'] } })
    const cyclic = template([a, b])
    const answers = indexAnswers([
      answer({ questionCode: 'A', status: AnswerStatus.PASS }),
      answer({ questionCode: 'B', status: AnswerStatus.PASS }),
    ])
    expect(isQuestionVisible(a, indexQuestions(cyclic), answers)).toBe(false)
  })

  it('shows a question pointing at a code that is not in the template', () => {
    const orphan = question({ code: 'X', showWhen: { questionCode: 'GONE', equals: ['YES'] } })
    const tplOrphan = template([orphan])
    expect(isQuestionVisible(orphan, indexQuestions(tplOrphan), indexAnswers([]))).toBe(true)
  })
})

describe('rules', () => {
  it('fires on a matching status and produces a finding', () => {
    const q = question({ code: 'ESTOP', rules: [rule({ severity: FindingSeverity.CRITICAL })] })
    const found = derivedFindings(q, answer({ questionCode: 'ESTOP', status: AnswerStatus.FAIL }))
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe(FindingSeverity.CRITICAL)
  })

  it('does not fire on a different status', () => {
    const q = question({ code: 'ESTOP', rules: [rule()] })
    expect(derivedFindings(q, answer({ questionCode: 'ESTOP', status: AnswerStatus.PASS }))).toEqual([])
  })

  it('does not fire on an unanswered question', () => {
    const q = question({ code: 'ESTOP', rules: [rule()] })
    expect(derivedFindings(q, undefined)).toEqual([])
  })

  it('never fires a rule with no condition set', () => {
    const q = question({ code: 'ESTOP', rules: [rule({ whenStatus: null, whenValue: null })] })
    expect(derivedFindings(q, answer({ questionCode: 'ESTOP', status: AnswerStatus.PASS }))).toEqual([])
  })

  it('fires on a selected choice value', () => {
    const q = question({
      code: 'DRIVE',
      type: QuestionType.MULTI_SELECT,
      rules: [rule({ whenStatus: null, whenValue: 'None fitted' })],
    })
    const found = derivedFindings(
      q,
      answer({ questionCode: 'DRIVE', valueChoices: ['None fitted', 'Chain'] })
    )
    expect(found).toHaveLength(1)
  })

  it('omits a non-flagging rule from findings', () => {
    const q = question({ code: 'ESTOP', rules: [rule({ flag: false })] })
    expect(derivedFindings(q, answer({ questionCode: 'ESTOP', status: AnswerStatus.FAIL }))).toEqual([])
  })
})

describe('outstanding requirements', () => {
  it('reports an unanswered required question', () => {
    const tpl = template([question({ code: 'A' })])
    const out = outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, indexAnswers([]))
    expect(out).toEqual([{ questionCode: 'A', prompt: 'Prompt for A', reason: 'unanswered' }])
  })

  it('ignores an unanswered optional question', () => {
    const tpl = template([question({ code: 'A', required: false })])
    expect(outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, indexAnswers([]))).toEqual([])
  })

  it('ignores a required question that is not visible', () => {
    const tpl = template([
      question({ code: 'GATE', type: QuestionType.YES_NO }),
      question({ code: 'DEEP', showWhen: { questionCode: 'GATE', equals: ['YES'] } }),
    ])
    const answers = indexAnswers([answer({ questionCode: 'GATE', valueText: 'NO' })])
    const codes = outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers).map((o) => o.questionCode)
    expect(codes).toEqual([])
  })

  it('demands a note when a fired rule requires one', () => {
    const tpl = template([question({ code: 'A', rules: [rule({ requireNote: true })] })])
    const answers = indexAnswers([answer({ questionCode: 'A', status: AnswerStatus.FAIL })])
    const out = outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers)
    expect(out).toEqual([{ questionCode: 'A', prompt: 'Prompt for A', reason: 'note-required' }])
  })

  it('accepts a supplied note', () => {
    const tpl = template([question({ code: 'A', rules: [rule({ requireNote: true })] })])
    const answers = indexAnswers([
      answer({ questionCode: 'A', status: AnswerStatus.FAIL, note: 'Guide rail bent at 1.2m.' }),
    ])
    expect(outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers)).toEqual([])
  })

  it('treats a whitespace-only note as missing', () => {
    const tpl = template([question({ code: 'A', rules: [rule({ requireNote: true })] })])
    const answers = indexAnswers([answer({ questionCode: 'A', status: AnswerStatus.FAIL, note: '   ' })])
    expect(outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers)[0].reason).toBe('note-required')
  })

  it('demands a photo only when one is genuinely required', () => {
    const tpl = template([question({ code: 'A', requirePhoto: true, rules: [] })])
    const answers = indexAnswers([answer({ questionCode: 'A', status: AnswerStatus.PASS })])
    expect(outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers)[0].reason).toBe('photo-required')
  })

  it('counts stored evidence, not intent, as satisfying a photo requirement', () => {
    const tpl = template([question({ code: 'A', requirePhoto: true })])
    const answers = indexAnswers([
      answer({ questionCode: 'A', status: AnswerStatus.PASS, evidenceCount: 1 }),
    ])
    expect(outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers)).toEqual([])
  })

  it('does not ask for a note on a question that is not yet answered', () => {
    const tpl = template([question({ code: 'A', rules: [rule({ requireNote: true })] })])
    const out = outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, indexAnswers([]))
    expect(out.map((o) => o.reason)).toEqual(['unanswered'])
  })

  it('recommending a photo never blocks submission', () => {
    const tpl = template([question({ code: 'A', recommendPhoto: true })])
    const answers = indexAnswers([answer({ questionCode: 'A', status: AnswerStatus.PASS })])
    expect(outstandingRequirements(tpl, AssetType.ROLLER_SHUTTER, answers)).toEqual([])
  })
})

describe('progress and tally', () => {
  it('counts only visible questions', () => {
    const tpl = template([
      question({ code: 'GATE', type: QuestionType.YES_NO }),
      question({ code: 'DEEP', showWhen: { questionCode: 'GATE', equals: ['YES'] } }),
    ])
    const answers = indexAnswers([answer({ questionCode: 'GATE', valueText: 'NO' })])
    expect(inspectionProgress(tpl, AssetType.ROLLER_SHUTTER, answers)).toEqual({
      visible: 1,
      answered: 1,
      percent: 100,
    })
  })

  it('treats NOT_TESTED as answered', () => {
    const tpl = template([question({ code: 'A' })])
    const answers = indexAnswers([answer({ questionCode: 'A', status: AnswerStatus.NOT_TESTED })])
    expect(inspectionProgress(tpl, AssetType.ROLLER_SHUTTER, answers).answered).toBe(1)
  })

  it('separates not-applicable from not-tested in the tally', () => {
    const tpl = template([question({ code: 'A' }), question({ code: 'B' })])
    const answers = indexAnswers([
      answer({ questionCode: 'A', status: AnswerStatus.NOT_APPLICABLE }),
      answer({ questionCode: 'B', status: AnswerStatus.NOT_TESTED }),
    ])
    expect(tallyAnswers(tpl, AssetType.ROLLER_SHUTTER, answers)).toEqual({
      passed: 0,
      failed: 0,
      notApplicable: 1,
      notTested: 1,
    })
  })

  it('reports 0 percent for an empty template rather than dividing by zero', () => {
    expect(inspectionProgress(template([]), AssetType.OTHER, indexAnswers([])).percent).toBe(0)
  })
})

describe('result derivation', () => {
  it('passes a clean inspection', () => {
    expect(deriveResult({ severities: [], outstanding: [], failedAnswers: 0 })).toBe('PASS')
  })

  it('reports incomplete when something required is missing', () => {
    const outstanding = [{ questionCode: 'A', prompt: 'A', reason: 'unanswered' as const }]
    expect(deriveResult({ severities: [], outstanding, failedAnswers: 0 })).toBe('INCOMPLETE')
  })

  it('fails on a critical finding even while incomplete', () => {
    const outstanding = [{ questionCode: 'A', prompt: 'A', reason: 'unanswered' as const }]
    expect(
      deriveResult({ severities: [FindingSeverity.CRITICAL], outstanding, failedAnswers: 1 })
    ).toBe('FAILED')
  })

  it('fails at the HIGH threshold', () => {
    expect(deriveResult({ severities: [FindingSeverity.HIGH], outstanding: [], failedAnswers: 1 })).toBe(
      'FAILED'
    )
  })

  it('asks for attention at MEDIUM', () => {
    expect(
      deriveResult({ severities: [FindingSeverity.MEDIUM], outstanding: [], failedAnswers: 1 })
    ).toBe('ATTENTION_REQUIRED')
  })

  it('still passes when the only finding is informational', () => {
    expect(deriveResult({ severities: [FindingSeverity.INFO], outstanding: [], failedAnswers: 0 })).toBe(
      'PASS'
    )
  })

  it('asks for attention on a failed answer that raised no finding', () => {
    expect(deriveResult({ severities: [], outstanding: [], failedAnswers: 2 })).toBe(
      'ATTENTION_REQUIRED'
    )
  })
})

describe('comparison against the previous inspection', () => {
  it('marks a repeated failure as recurring', () => {
    const now = [answer({ questionCode: 'GUIDE', status: AnswerStatus.FAIL })]
    const before = [answer({ questionCode: 'GUIDE', status: AnswerStatus.FAIL })]
    expect(recurringCodes(compareInspections(now, before))).toEqual(['GUIDE'])
  })

  it('marks a first-time failure as new', () => {
    const now = [answer({ questionCode: 'GUIDE', status: AnswerStatus.FAIL })]
    const before = [answer({ questionCode: 'GUIDE', status: AnswerStatus.PASS })]
    expect(compareInspections(now, before)[0].state).toBe('new')
  })

  it('marks a fixed failure as resolved', () => {
    const now = [answer({ questionCode: 'GUIDE', status: AnswerStatus.PASS })]
    const before = [answer({ questionCode: 'GUIDE', status: AnswerStatus.FAIL })]
    expect(compareInspections(now, before)[0].state).toBe('resolved')
  })

  it('never reports an unasked question as resolved', () => {
    const now: EngineAnswer[] = []
    const before = [answer({ questionCode: 'GUIDE', status: AnswerStatus.FAIL })]
    const result = compareInspections(now, before)
    expect(result).toEqual([
      {
        questionCode: 'GUIDE',
        state: 'unchanged',
        currentStatus: null,
        previousStatus: AnswerStatus.FAIL,
      },
    ])
  })

  it('says nothing about questions that passed both times', () => {
    const now = [answer({ questionCode: 'GUIDE', status: AnswerStatus.PASS })]
    const before = [answer({ questionCode: 'GUIDE', status: AnswerStatus.PASS })]
    expect(compareInspections(now, before)).toEqual([])
  })

  it('treats a question the previous inspection never asked as new', () => {
    const now = [answer({ questionCode: 'NEWQ', status: AnswerStatus.FAIL })]
    expect(compareInspections(now, [])[0].state).toBe('new')
  })
})

describe('visibleQuestions', () => {
  it('returns only what the technician should be shown', () => {
    const tpl: EngineTemplate = {
      id: 't',
      name: 'T',
      version: 1,
      assetTypes: [],
      sections: [
        {
          id: 'a',
          title: 'A',
          description: null,
          assetTypes: [AssetType.ROLLER_SHUTTER],
          questions: [question({ code: 'SHUTTER_ONLY' })],
        },
        {
          id: 'b',
          title: 'B',
          description: null,
          assetTypes: [],
          questions: [question({ code: 'ALWAYS' })],
        },
      ],
    }
    expect(visibleQuestions(tpl, AssetType.SWING_GATE, indexAnswers([])).map((q) => q.code)).toEqual([
      'ALWAYS',
    ])
  })
})
