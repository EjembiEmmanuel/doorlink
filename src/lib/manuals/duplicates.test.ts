import { describe, expect, it } from 'vitest'
import { findDuplicate, type DuplicateCandidate } from './duplicates'

const submission = {
  sha256: 'a'.repeat(64),
  manufacturerName: 'B&D',
  modelCode: 'CAD-4',
  productName: 'Controll-A-Door 4',
}

const candidate = (over: Partial<DuplicateCandidate> = {}): DuplicateCandidate => ({
  documentId: 'doc1',
  title: 'Controll-A-Door 4 Installation Manual',
  sha256: null,
  manufacturerName: 'B&D',
  modelCode: 'CAD4',
  ...over,
})

describe('findDuplicate', () => {
  it('calls identical bytes identical', () => {
    const found = findDuplicate(submission, [candidate({ sha256: submission.sha256 })])
    expect(found.confidence).toBe('identical')
    expect(found.documentId).toBe('doc1')
  })

  it('matches a model code across punctuation differences', () => {
    // CAD-4 and CAD4 are the same model written two ways.
    const found = findDuplicate(submission, [candidate()])
    expect(found.confidence).toBe('likely')
  })

  it('matches a manufacturer across an ampersand and the word and', () => {
    const found = findDuplicate(submission, [candidate({ manufacturerName: 'B and D' })])
    expect(found.confidence).toBe('likely')
  })

  // A suspicion must stay a suspicion. Several documents legitimately
  // share a manufacturer and a model.
  it('says likely, never identical, on metadata alone', () => {
    const found = findDuplicate(submission, [candidate()])
    expect(found.confidence).not.toBe('identical')
    expect(found.reason).toContain('not proof')
  })

  it('does not match a different model from the same maker', () => {
    expect(findDuplicate(submission, [candidate({ modelCode: 'CAD-5' })]).confidence).toBe('none')
  })

  it('does not match the same model from a different maker', () => {
    expect(findDuplicate(submission, [candidate({ manufacturerName: 'Merlin' })]).confidence).toBe(
      'none'
    )
  })

  it('finds nothing in an empty library', () => {
    expect(findDuplicate(submission, []).confidence).toBe('none')
  })

  it('ignores candidates missing the fields it compares', () => {
    expect(
      findDuplicate(submission, [candidate({ modelCode: null }), candidate({ manufacturerName: null })])
        .confidence
    ).toBe('none')
  })

  it('does not match on an empty model code', () => {
    const blank = { ...submission, modelCode: '   ' }
    expect(findDuplicate(blank, [candidate({ modelCode: '' })]).confidence).toBe('none')
  })

  it('prefers the identical match when both kinds are present', () => {
    const found = findDuplicate(submission, [
      candidate({ documentId: 'meta' }),
      candidate({ documentId: 'bytes', sha256: submission.sha256, modelCode: 'ZZ99' }),
    ])
    expect(found.confidence).toBe('identical')
    expect(found.documentId).toBe('bytes')
  })
})
