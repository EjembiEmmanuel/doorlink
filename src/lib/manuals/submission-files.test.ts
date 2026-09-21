import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  extensionOf,
  safeDisplayFilename,
  sniffMime,
  submissionFileKey,
  validateUpload,
} from './submission-files'

const head = (...bytes: number[]) => new Uint8Array([...bytes, ...Array(16).fill(0)])
const PDF = head(0x25, 0x50, 0x44, 0x46)
const PNG = head(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const JPEG = head(0xff, 0xd8, 0xff)
const DOC = head(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
const ZIP = head(0x50, 0x4b, 0x03, 0x04)

describe('sniffMime', () => {
  it.each([
    [PDF, 'application/pdf'],
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
    [DOC, 'application/msword'],
    [ZIP, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ])('reads the leading bytes', (bytes, expected) => {
    expect(sniffMime(bytes)).toBe(expected)
  })

  it('gives up rather than guessing', () => {
    expect(sniffMime(head(0x00, 0x01, 0x02, 0x03))).toBeNull()
    expect(sniffMime(new Uint8Array())).toBeNull()
  })
})

describe('validateUpload', () => {
  it('accepts a PDF named as one', () => {
    const verdict = validateUpload({ filename: 'manual.pdf', sizeBytes: 1024, head: PDF })
    expect(verdict.ok).toBe(true)
    expect(verdict.detectedMime).toBe('application/pdf')
  })

  it('accepts either spelling of a JPEG extension', () => {
    for (const filename of ['scan.jpg', 'scan.jpeg', 'SCAN.JPG']) {
      expect(validateUpload({ filename, sizeBytes: 1024, head: JPEG }).ok).toBe(true)
    }
  })

  // The refusals are the point of this module.
  it('rejects an executable renamed to .pdf', () => {
    const verdict = validateUpload({
      filename: 'totally-a-manual.pdf',
      sizeBytes: 1024,
      head: head(0x4d, 0x5a), // MZ, a Windows executable
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('unsupported-type')
  })

  it('rejects a real PNG wearing a .pdf extension', () => {
    const verdict = validateUpload({ filename: 'manual.pdf', sizeBytes: 1024, head: PNG })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toBe('type-mismatch')
    expect(verdict.message).toContain('PNG')
  })

  it('rejects a file with no extension at all', () => {
    expect(validateUpload({ filename: 'manual', sizeBytes: 1024, head: PDF }).reason).toBe(
      'type-mismatch'
    )
  })

  it('rejects an empty file', () => {
    expect(validateUpload({ filename: 'a.pdf', sizeBytes: 0, head: PDF }).reason).toBe('empty')
  })

  it('rejects an oversized file before reading its bytes', () => {
    const verdict = validateUpload({
      filename: 'a.pdf',
      sizeBytes: MAX_FILE_BYTES + 1,
      head: new Uint8Array(),
    })
    expect(verdict.reason).toBe('too-large')
  })

  it('rejects a file whose bytes could not be read', () => {
    expect(
      validateUpload({ filename: 'a.pdf', sizeBytes: 10, head: new Uint8Array() }).reason
    ).toBe('unreadable')
  })
})

describe('submissionFileKey', () => {
  it('builds a key from the id and the proven type', () => {
    expect(submissionFileKey('abc123', 'application/pdf')).toBe('manual-submissions/abc123.pdf')
  })

  // A key is a path. User input must never reach it.
  it('strips anything that could escape the prefix', () => {
    expect(submissionFileKey('../../etc/passwd', 'application/pdf')).toBe(
      'manual-submissions/etcpasswd.pdf'
    )
  })

  it('refuses an id with nothing safe left in it', () => {
    expect(() => submissionFileKey('../', 'application/pdf')).toThrow()
  })

  it('never lands under the publicly servable manuals prefix', () => {
    expect(submissionFileKey('abc', 'application/pdf').startsWith('manuals/')).toBe(false)
  })
})

describe('safeDisplayFilename', () => {
  it('keeps an ordinary name', () => {
    expect(safeDisplayFilename('B&D Controll-A-Door.pdf')).toBe('B&D Controll-A-Door.pdf')
  })

  it('drops directory parts', () => {
    expect(safeDisplayFilename('../../etc/passwd')).toBe('passwd')
    expect(safeDisplayFilename('C:\\Users\\bob\\manual.pdf')).toBe('manual.pdf')
  })

  it('neutralises control characters that could forge a header', () => {
    // No slash in this input on purpose: directory-stripping runs first
    // and would otherwise be what the assertion actually tested.
    expect(safeDisplayFilename('manual\r\nContent-Disposition: attachment.pdf')).toBe(
      'manual Content-Disposition: attachment.pdf'
    )
  })

  it('still takes the last segment when a control character hides a slash', () => {
    expect(safeDisplayFilename('manual\r\n/etc/passwd')).toBe('passwd')
  })

  it('always returns something', () => {
    expect(safeDisplayFilename('')).toBe('upload')
    expect(safeDisplayFilename('///')).toBe('upload')
  })

  it('bounds the length', () => {
    expect(safeDisplayFilename(`${'a'.repeat(500)}.pdf`).length).toBeLessThanOrEqual(200)
  })
})

describe('extensionOf', () => {
  it.each([
    ['a.pdf', 'pdf'],
    ['A.PDF', 'pdf'],
    ['a.b.docx', 'docx'],
    ['noext', ''],
    ['.hidden', ''],
    ['trailing.', ''],
  ])('reads %s as %s', (name, expected) => {
    expect(extensionOf(name)).toBe(expected)
  })
})

describe('ACCEPTED_EXTENSIONS', () => {
  it('covers every format the brief asks for', () => {
    expect(ACCEPTED_EXTENSIONS).toEqual(
      expect.arrayContaining(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'])
    )
  })
})
