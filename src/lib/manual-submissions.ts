import { createHash } from 'node:crypto'
import { DocumentKind, ManualSubmissionStatus, ManualVerificationResult } from '@prisma/client'
import { z } from 'zod'

export const manualSubmissionKinds = Object.values(DocumentKind) as [DocumentKind, ...DocumentKind[]]

export const manualSubmissionMetadataSchema = z.object({
  title: z.string().trim().min(1, 'Enter the document title.').max(160),
  kind: z.nativeEnum(DocumentKind),
  manufacturer: z.string().trim().max(120).optional(),
  productName: z.string().trim().max(160).optional(),
  productType: z.string().trim().max(120).optional(),
  modelCode: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  sourceUrl: z.string().trim().optional(),
  rightsAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that you have permission to share this document.' }),
  }),
})

export type ManualSubmissionMetadata = z.infer<typeof manualSubmissionMetadataSchema>

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return true
  }

  const octets = host.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  )
}

export function normalizePublicSourceUrl(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Enter a valid public document link.')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || isPrivateHostname(url.hostname)) {
    throw new Error('Use a public http or https document link without a login or private hostname.')
  }

  url.hash = ''
  return url.toString()
}

export function verifyManualSubmissionMetadata(input: {
  sourceUrl?: string
  hasFile: boolean
  fileName?: string
  mimeType?: string
  duplicateFound?: boolean
}): {
  result: ManualVerificationResult
  score: number
  notes: string[]
} {
  const notes: string[] = []
  let score = 100

  if (!input.sourceUrl && !input.hasFile) {
    return {
      result: ManualVerificationResult.REJECTED,
      score: 0,
      notes: ['A public source link or an uploaded document is required.'],
    }
  }

  if (input.sourceUrl) {
    try {
      normalizePublicSourceUrl(input.sourceUrl)
    } catch {
      score -= 45
      notes.push('The source link needs human review.')
    }
  }

  if (input.hasFile && !input.fileName) {
    score -= 30
    notes.push('The uploaded file has no filename.')
  }

  if (input.duplicateFound) {
    score -= 40
    notes.push('A matching document or submission already exists. Check it before publishing.')
  }

  if (input.sourceUrl && !input.hasFile) {
    notes.push('The link was recorded, but its contents and redistribution rights still need human review.')
  }

  if (input.hasFile) {
    notes.push('The file metadata was checked. Its contents still need human review.')
  }

  return {
    result:
      score < 50
        ? ManualVerificationResult.REVIEW_REQUIRED
        : input.duplicateFound
          ? ManualVerificationResult.REVIEW_REQUIRED
          : ManualVerificationResult.PASS,
    score,
    notes,
  }
}

export async function sha256File(file: File): Promise<string> {
  return createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex')
}

export function safeManualFilename(name: string): string {
  const base = name.trim().replace(/\\/g, '/').split('/').pop() ?? 'manual'
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe.slice(0, 120) || 'manual'
}

export function manualSubmissionFileKey(submissionId: string, originalFilename: string): string {
  return `manual-submissions/${submissionId}/${safeManualFilename(originalFilename)}`
}

export const MANUAL_SUBMISSION_STATUS_LABELS: Record<ManualSubmissionStatus, string> = {
  PENDING_REVIEW: 'Submitted',
  AI_VERIFICATION: 'Checking metadata',
  AWAITING_ADMIN_REVIEW: 'Waiting for review',
  NEEDS_CHANGES: 'Needs changes',
  APPROVED: 'Published',
  REJECTED: 'Rejected',
}