'use server'

import { DocumentKind, ManualSubmissionStatus } from '@prisma/client'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { requireSession, RbacError } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { canUpload, uploadFile } from '@/lib/storage'
import {
  manualSubmissionFileKey,
  manualSubmissionMetadataSchema,
  normalizePublicSourceUrl,
  sha256File,
  verifyManualSubmissionMetadata,
} from '@/lib/manual-submissions'

export type ManualSubmissionState = { error?: string }

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : undefined
}

function uploadedFile(value: FormDataEntryValue | null): File | undefined {
  if (!value || typeof value === 'string' || typeof value.arrayBuffer !== 'function') return undefined
  if (value.size === 0) return undefined
  return value
}

export async function submitManualAction(
  _previous: ManualSubmissionState,
  formData: FormData
): Promise<ManualSubmissionState> {
  let session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: 'Sign in before submitting a manual.' }
    throw error
  }

  let sourceUrl: string | undefined
  try {
    sourceUrl = normalizePublicSourceUrl(optionalString(formData.get('sourceUrl')))
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Enter a valid public document link.' }
  }

  const file = uploadedFile(formData.get('file'))
  if (file && !canUpload()) {
    return {
      error:
        'File uploads are not connected yet. Use a public source link, or ask an administrator to configure document storage.',
    }
  }

  const parsed = manualSubmissionMetadataSchema.safeParse({
    title: optionalString(formData.get('title')),
    kind: formData.get('kind'),
    manufacturer: optionalString(formData.get('manufacturer')),
    productName: optionalString(formData.get('productName')),
    productType: optionalString(formData.get('productType')),
    modelCode: optionalString(formData.get('modelCode')),
    description: optionalString(formData.get('description')),
    notes: optionalString(formData.get('notes')),
    sourceUrl,
    rightsAcknowledged: formData.get('rightsAcknowledged') === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  if (!sourceUrl && !file) {
    return { error: 'Add a public source link or choose a document file.' }
  }

  let fileHash: string | undefined
  try {
    fileHash = file ? await sha256File(file) : undefined

    const duplicateDocument = await prisma.document.findFirst({
      where: {
        OR: [
          ...(sourceUrl
            ? [
                { sourceUrl },
                { altSources: { some: { url: sourceUrl } } },
              ]
            : []),
          ...(fileHash ? [{ fileKey: { not: null } }] : []),
        ],
      },
      select: { id: true, title: true, sourceUrl: true, fileKey: true },
    })

    const duplicateSubmission = await prisma.manualSubmission.findFirst({
      where: {
        OR: [
          ...(sourceUrl ? [{ sourceUrl }] : []),
          ...(fileHash ? [{ fileHash }] : []),
        ],
        status: { not: ManualSubmissionStatus.REJECTED },
      },
      select: { id: true, title: true, documentId: true },
      orderBy: { createdAt: 'desc' },
    })

    // A file hash can only be compared with previous submissions until
    // imported documents carry an ingest hash. Do not pretend a filename
    // is a content duplicate.
    const duplicate = duplicateDocument && sourceUrl ? duplicateDocument : duplicateSubmission
    const verification = verifyManualSubmissionMetadata({
      sourceUrl,
      hasFile: Boolean(file),
      fileName: file?.name,
      mimeType: file?.type,
      duplicateFound: Boolean(duplicate),
    })

    const submission = await prisma.manualSubmission.create({
      data: {
        userId: session.userId,
        title: parsed.data.title,
        kind: parsed.data.kind as DocumentKind,
        manufacturer: parsed.data.manufacturer,
        productName: parsed.data.productName,
        productType: parsed.data.productType,
        modelCode: parsed.data.modelCode,
        description: parsed.data.description,
        notes: parsed.data.notes,
        sourceUrl,
        originalFilename: file?.name,
        mimeType: file?.type || undefined,
        fileSizeBytes: file?.size,
        fileHash,
        status: ManualSubmissionStatus.AWAITING_ADMIN_REVIEW,
        verificationResult: verification.result,
        verificationScore: verification.score,
        verificationNotes: verification.notes.join(' '),
        rightsAcknowledged: parsed.data.rightsAcknowledged,
        duplicateOfId: duplicate?.documentId ?? (duplicate && 'id' in duplicate ? duplicate.id : undefined),
      },
    })

    if (file) {
      try {
        const stored = await uploadFile(file, manualSubmissionFileKey(submission.id, file.name))
        await prisma.manualSubmission.update({
          where: { id: submission.id },
          data: { fileKey: stored.key },
        })
      } catch (error) {
        await prisma.manualSubmission.delete({ where: { id: submission.id } }).catch(() => undefined)
        return { error: error instanceof Error ? error.message : 'The document could not be uploaded.' }
      }
    }

    redirect(`/manuals/submissions/${submission.id}`)
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The submission database is not reachable right now.' }
    throw error
  }
}