import 'server-only'

import { createHash } from 'node:crypto'
import { AiVerdict, DataSource, NotificationType, Prisma, ScanState, SubmissionStatus } from '@prisma/client'
import { prisma } from '../prisma'
import { notify } from '../notifications'
import { makeReference } from '../reference'
import { canUpload, uploadFile } from '../storage'
import { isConnected } from '../integrations'
import { findDuplicate, type DuplicateCandidate } from './duplicates'
import { decideStatus } from './submission-policy'
import { runAiReview } from './ai-review-run'
import {
  safeDisplayFilename,
  submissionFileKey,
  validateUpload,
  type AcceptedMime,
} from './submission-files'

// Everything that happens between a person choosing a file and an admin
// seeing it in a queue.
//
// The ordering here is deliberate and worth stating: the file is
// validated, then hashed, then checked against the library, and only
// then sent to the AI. Each step is cheaper and more certain than the
// one after it, so the expensive uncertain one runs last and on fewer
// documents.

export interface SubmissionInput {
  submittedById: string
  manufacturerName: string
  productName: string
  modelCode: string
  categorySlug: string
  serialNumber?: string | null
  year?: number | null
  description?: string | null
  filename: string
  bytes: Uint8Array
}

export type SubmissionResult =
  | { ok: true; reference: string; status: SubmissionStatus }
  | { ok: false; message: string }

export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Documents worth comparing a submission against.
 *
 * Narrowed to the submitted manufacturer before comparing, so this stays
 * a bounded query rather than a scan of the library — and widened to
 * include every published document when the hash might match, because a
 * byte-identical file is a duplicate regardless of how it was labelled.
 */
async function duplicateCandidates(sha256: string, manufacturerName: string): Promise<DuplicateCandidate[]> {
  const rows = await prisma.document.findMany({
    where: {
      isPublished: true,
      manufacturer: { name: { contains: manufacturerName.slice(0, 12), mode: 'insensitive' } },
    },
    take: 200,
    select: {
      id: true,
      title: true,
      manufacturer: { select: { name: true } },
      model: { select: { modelCode: true } },
    },
  })

  // The hash check needs the whole published set, but only for rows that
  // actually store a file — a LINK_ONLY document has no bytes to match.
  const hashed = await prisma.manualSubmission.findMany({
    where: { sha256, status: SubmissionStatus.APPROVED, publishedDocumentId: { not: null } },
    select: { publishedDocumentId: true, publishedDocument: { select: { title: true } } },
    take: 5,
  })

  return [
    ...hashed
      .filter((row) => row.publishedDocumentId)
      .map((row) => ({
        documentId: row.publishedDocumentId as string,
        title: row.publishedDocument?.title ?? 'an existing document',
        sha256,
      })),
    ...rows.map((row) => ({
      documentId: row.id,
      title: row.title,
      sha256: null,
      manufacturerName: row.manufacturer?.name ?? null,
      modelCode: row.model?.modelCode ?? null,
    })),
  ]
}

/**
 * Take an upload, store it, check it, and queue it for a human.
 *
 * Returns a message rather than throwing on the ordinary failures — a
 * rejected file type or unavailable storage is something the submitter
 * needs told, not an exception for the page to swallow.
 */
export async function createSubmission(input: SubmissionInput): Promise<SubmissionResult> {
  const verdict = validateUpload({
    filename: input.filename,
    sizeBytes: input.bytes.byteLength,
    head: input.bytes.subarray(0, 16),
  })
  if (!verdict.ok || !verdict.detectedMime) {
    return { ok: false, message: verdict.message ?? 'That file could not be accepted.' }
  }
  const mime: AcceptedMime = verdict.detectedMime

  // Checked before anything is written, so a submitter is told upload is
  // unavailable instead of getting a row that points at no file.
  if (!canUpload()) {
    return {
      ok: false,
      message:
        'Manual uploads need file storage, which is not configured on this deployment. Nothing was saved.',
    }
  }

  const sha256 = sha256Of(input.bytes)
  const reference = makeReference('MAN')

  const submission = await prisma.manualSubmission.create({
    data: {
      reference,
      submittedById: input.submittedById,
      manufacturerName: input.manufacturerName.trim(),
      productName: input.productName.trim(),
      modelCode: input.modelCode.trim(),
      categorySlug: input.categorySlug,
      serialNumber: input.serialNumber?.trim() || null,
      year: input.year ?? null,
      description: input.description?.trim() || null,
      originalFilename: safeDisplayFilename(input.filename),
      mimeType: mime,
      fileSizeBytes: input.bytes.byteLength,
      sha256,
      status: SubmissionStatus.RECEIVED,
      // There is no malware scanner connected. Recorded as unavailable
      // rather than left to read as though a scan passed.
      scanState: ScanState.UNAVAILABLE,
      events: { create: { to: SubmissionStatus.RECEIVED, note: 'Uploaded.' } },
    },
  })

  const fileKey = submissionFileKey(submission.id, mime)

  try {
    await uploadFile({ key: fileKey, body: input.bytes, contentType: mime })
    await prisma.manualSubmission.update({ where: { id: submission.id }, data: { fileKey } })
  } catch {
    // Storage said no after the row existed. The row is kept: a record
    // of an upload that could not be stored is worth more than silence,
    // and the admin queue shows it with no file attached.
    await prisma.manualSubmission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.FLAGGED,
        events: {
          create: {
            from: SubmissionStatus.RECEIVED,
            to: SubmissionStatus.FLAGGED,
            note: 'The file could not be written to storage. No document is attached to this submission.',
          },
        },
      },
    })
    return {
      ok: false,
      message: 'The file could not be stored. Nothing has been published and nobody has been charged.',
    }
  }

  const status = await runChecks({
    submissionId: submission.id,
    sha256,
    bytes: input.bytes,
    mime,
    manufacturerName: input.manufacturerName,
    productName: input.productName,
    modelCode: input.modelCode,
    description: input.description,
  })

  return { ok: true, reference, status }
}

/**
 * The duplicate check and the AI check, and the status they imply.
 *
 * Separated so it can be re-run on a submission later — when an AI
 * provider is configured for the first time, every NOT_RUN row is worth
 * revisiting, and that should not mean re-uploading.
 */
export async function runChecks(input: {
  submissionId: string
  sha256: string
  bytes: Uint8Array
  mime: AcceptedMime
  manufacturerName: string
  productName: string
  modelCode: string
  description?: string | null
}): Promise<SubmissionStatus> {
  await prisma.manualSubmission.update({
    where: { id: input.submissionId },
    data: { status: SubmissionStatus.CHECKING },
  })

  const candidates = await duplicateCandidates(input.sha256, input.manufacturerName)
  const duplicate = findDuplicate(
    {
      sha256: input.sha256,
      manufacturerName: input.manufacturerName,
      modelCode: input.modelCode,
      productName: input.productName,
    },
    candidates
  )

  const outcome = await runAiReview({
    bytes: input.bytes,
    mime: input.mime,
    manufacturerName: input.manufacturerName,
    productName: input.productName,
    modelCode: input.modelCode,
    description: input.description,
  })

  const status = decideStatus({
    verdict: outcome.verdict,
    confidence: outcome.confidence,
    duplicate: duplicate.confidence,
  })

  await prisma.manualSubmission.update({
    where: { id: input.submissionId },
    data: {
      status,
      aiVerdict: outcome.verdict,
      aiConfidence: outcome.confidence,
      aiReasoning: [outcome.reasoning, duplicate.reason].filter(Boolean).join('\n\n'),
      aiCheckedAt: new Date(),
      aiModel: isConnected('ai') && outcome.verdict !== AiVerdict.NOT_RUN ? 'claude-opus-5' : null,
      duplicateOfId: duplicate.documentId ?? null,
      events: {
        create: {
          from: SubmissionStatus.CHECKING,
          to: status,
          note: `Automated check: ${outcome.verdict}. ${outcome.reasoning}`,
        },
      },
    },
  })

  return status
}

export type ReviewDecision = 'approve' | 'reject' | 'request-info'

/**
 * An admin's decision on a submission.
 *
 * Approving is the only path that creates a Document, and it happens in
 * a transaction with the status change so a published document can never
 * exist without the submission that records who approved it.
 */
export async function decideSubmission(input: {
  submissionId: string
  adminId: string
  decision: ReviewDecision
  note: string
}): Promise<{ ok: boolean; message: string }> {
  const submission = await prisma.manualSubmission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      status: true,
      submittedById: true,
      reference: true,
      manufacturerName: true,
      productName: true,
      modelCode: true,
      fileKey: true,
      mimeType: true,
      fileSizeBytes: true,
      originalFilename: true,
      duplicateOfId: true,
    },
  })
  if (!submission) return { ok: false, message: 'That submission no longer exists.' }

  if (input.decision === 'request-info') {
    await prisma.manualSubmission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.INFO_REQUESTED,
        reviewedById: input.adminId,
        reviewedAt: new Date(),
        reviewNote: input.note,
        events: {
          create: {
            from: submission.status,
            to: SubmissionStatus.INFO_REQUESTED,
            note: input.note,
            actorId: input.adminId,
          },
        },
      },
    })
    await notify({
      userId: submission.submittedById,
      type: NotificationType.DOCUMENT_UPDATED,
      title: `More information needed for ${submission.reference}`,
      body: input.note,
      href: '/manuals/submit',
    })
    return { ok: true, message: 'Asked the submitter for more information.' }
  }

  if (input.decision === 'reject') {
    await prisma.manualSubmission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.REJECTED,
        reviewedById: input.adminId,
        reviewedAt: new Date(),
        reviewNote: input.note,
        events: {
          create: {
            from: submission.status,
            to: SubmissionStatus.REJECTED,
            note: input.note,
            actorId: input.adminId,
          },
        },
      },
    })
    await notify({
      userId: submission.submittedById,
      type: NotificationType.DOCUMENT_UPDATED,
      title: `${submission.reference} was not added`,
      body: input.note,
    })
    return { ok: true, message: 'Rejected, and the reason recorded.' }
  }

  // Approve. A submission already tied to an existing document is not
  // published again — the brief asks for the request to be linked to the
  // document that already covers it, not for a second public copy.
  if (submission.duplicateOfId) {
    await prisma.manualSubmission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedById: input.adminId,
        reviewedAt: new Date(),
        reviewNote: input.note,
        publishedDocumentId: null,
        events: {
          create: {
            from: submission.status,
            to: SubmissionStatus.APPROVED,
            note: `Linked to the existing document instead of publishing a second copy. ${input.note}`,
            actorId: input.adminId,
          },
        },
      },
    })
    await notify({
      userId: submission.submittedById,
      type: NotificationType.DOCUMENT_UPDATED,
      title: `${submission.reference}: Doorlink already had this manual`,
      body: 'Thank you — the manual you sent is already in the library, so your submission has been linked to it rather than added twice.',
      href: `/manuals/${submission.duplicateOfId}`,
    })
    return { ok: true, message: 'Linked to the existing document. No second copy was created.' }
  }

  try {
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          slug: `${submission.reference.toLowerCase()}-${submission.modelCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 90),
          kind: 'USER_MANUAL',
          title: `${submission.manufacturerName} ${submission.productName} (${submission.modelCode})`,
          fileKey: submission.fileKey,
          mimeType: submission.mimeType,
          fileSizeBytes: submission.fileSizeBytes,
          originalFilename: submission.originalFilename,
          // Community, not manufacturer. Somebody uploading a manual is
          // not the manufacturer publishing it, and the badge a reader
          // sees must say which.
          origin: 'COMMUNITY_CONTRIBUTED',
          dataSource: DataSource.COMMUNITY_SUBMITTED,
          // Rights are unclear by default on a community upload: the
          // submitter is not in a position to grant redistribution, so
          // an admin records what is actually known.
          rights: 'UNCLEAR',
          rightsNote: 'Uploaded by a Doorlink user. Redistribution rights have not been established.',
          provenanceNote: `Submitted as ${submission.reference} and approved by an administrator. ${input.note}`,
          isPublished: true,
          publishedAt: new Date(),
        },
      })
      await tx.manualSubmission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewedById: input.adminId,
          reviewedAt: new Date(),
          reviewNote: input.note,
          publishedDocumentId: created.id,
          events: {
            create: {
              from: submission.status,
              to: SubmissionStatus.APPROVED,
              note: input.note,
              actorId: input.adminId,
            },
          },
        },
      })
      return created
    })

    await notify({
      userId: submission.submittedById,
      type: NotificationType.DOCUMENT_UPDATED,
      title: `${submission.reference} is now in the Doorlink library`,
      body: 'Thank you — the manual you uploaded has been approved and is searchable.',
      href: `/manuals/${document.slug}`,
    })
    return { ok: true, message: 'Approved and published.' }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, message: 'A document with that reference already exists.' }
    }
    throw error
  }
}
