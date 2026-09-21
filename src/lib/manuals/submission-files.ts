// Validation for uploaded manual files.
//
// Every byte here arrived from the internet. Nothing a browser reports —
// the file name, its extension, the Content-Type on the part — is
// evidence of anything: all three are attacker-controlled. The only
// thing that is evidence is the bytes, which is why this module sniffs
// them and treats the declared type as a claim to be checked rather than
// a fact to be trusted.
//
// Kept free of Prisma and of Next so it can be unit tested directly.

export const MAX_FILE_BYTES = 25 * 1024 * 1024

/** What the library will accept, keyed by the type the bytes prove. */
export const ACCEPTED_TYPES = {
  'application/pdf': { extensions: ['pdf'], label: 'PDF' },
  'image/jpeg': { extensions: ['jpg', 'jpeg'], label: 'JPEG image' },
  'image/png': { extensions: ['png'], label: 'PNG image' },
  // DOC and DOCX are both containers that can carry macros. They are
  // accepted because the brief asks for them and because a scanned
  // manual really does turn up as a Word file — but they are never
  // rendered inline anywhere, only downloaded, and the admin queue says
  // so next to the download link.
  'application/msword': { extensions: ['doc'], label: 'Word document (.doc)' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
    label: 'Word document (.docx)',
  },
} as const

export type AcceptedMime = keyof typeof ACCEPTED_TYPES

/** The extensions a file picker should offer. Derived, never hand-listed. */
export const ACCEPTED_EXTENSIONS: string[] = Object.values(ACCEPTED_TYPES)
  .flatMap((entry) => entry.extensions as readonly string[])
  .map((extension) => `.${extension}`)

export type RejectionReason =
  | 'empty'
  | 'too-large'
  | 'unreadable'
  | 'unsupported-type'
  | 'type-mismatch'

export interface FileVerdict {
  ok: boolean
  /** The type the bytes prove, not the one the upload claimed. */
  detectedMime?: AcceptedMime
  reason?: RejectionReason
  message?: string
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => bytes[offset + index] === byte)

/**
 * The file's real type, from its leading bytes, or null.
 *
 * Deliberately a short list of unambiguous signatures. A sniffer that
 * guesses is worse than one that gives up, because a guess here decides
 * what gets stored and served.
 */
export function sniffMime(bytes: Uint8Array): AcceptedMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf' // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // Legacy .doc is an OLE2 compound file.
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'application/msword'
  // .docx is a ZIP. So is every other OOXML file, and so is a plain zip
  // bomb — the signature alone cannot tell them apart, which is why the
  // caller must still check the declared extension agrees (below) and
  // why these are never rendered, only downloaded.
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return null
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0 || dot === filename.length - 1) return ''
  return filename.slice(dot + 1).toLowerCase()
}

/**
 * Whether a file may be stored at all.
 *
 * Order matters: size is checked before the bytes are examined so a
 * hostile 2 GB upload is rejected without being read.
 */
export function validateUpload(input: {
  filename: string
  sizeBytes: number
  head: Uint8Array
}): FileVerdict {
  if (input.sizeBytes <= 0) {
    return { ok: false, reason: 'empty', message: 'That file is empty.' }
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    const limit = Math.round(MAX_FILE_BYTES / (1024 * 1024))
    return {
      ok: false,
      reason: 'too-large',
      message: `That file is larger than the ${limit} MB limit.`,
    }
  }
  if (input.head.length === 0) {
    return { ok: false, reason: 'unreadable', message: 'That file could not be read.' }
  }

  const detected = sniffMime(input.head)
  if (!detected) {
    return {
      ok: false,
      reason: 'unsupported-type',
      message: `That file is not a type Doorlink accepts. Upload a ${ACCEPTED_EXTENSIONS.join(', ')} file.`,
    }
  }

  // The extension must agree with the bytes. This is what stops a .pdf
  // that is really something else, and it is why a renamed file is
  // rejected rather than quietly stored under a type it is not.
  const extension = extensionOf(input.filename)
  const allowed = ACCEPTED_TYPES[detected].extensions as readonly string[]
  if (!allowed.includes(extension)) {
    return {
      ok: false,
      reason: 'type-mismatch',
      message: `That file's contents are a ${ACCEPTED_TYPES[detected].label} but it is named .${extension || '(none)'}. Rename it to match what it is.`,
    }
  }

  return { ok: true, detectedMime: detected }
}

/**
 * A storage key that cannot escape its prefix.
 *
 * The submitted name is never part of the path — it is kept in the
 * database for display and thrown away here. Building a key from user
 * input is how `../` and null bytes end up in a bucket path; building it
 * from an id and a known extension cannot.
 */
export function submissionFileKey(submissionId: string, mime: AcceptedMime): string {
  const extension = ACCEPTED_TYPES[mime].extensions[0]
  const safeId = submissionId.replace(/[^A-Za-z0-9_-]/g, '')
  if (!safeId) throw new Error('submissionFileKey needs an id with at least one safe character')
  return `manual-submissions/${safeId}.${extension}`
}

/**
 * A submitted file name, made safe to show in a page or a filename.
 *
 * Strips directory separators and control characters so a name like
 * `../../etc/passwd` or one carrying a newline cannot be used to forge a
 * path or break a header.
 */
export function safeDisplayFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? ''
  const cleaned = base
    // Replaced with a space rather than removed: deleting them welds the
    // words either side together, so `manual\r\nContent-Type: ...` would
    // read as `manualContent-Type`, which misrepresents the name it is
    // supposed to be showing faithfully.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 200) || 'upload'
}
