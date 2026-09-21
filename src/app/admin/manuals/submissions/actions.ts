'use server'

import { DocumentOrigin, DocumentRights, DataSource, ManualSubmissionStatus, ManualVerificationResult } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable, isRecordNotFound } from '@/lib/db-errors'
import { requirePermission, RbacError } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { documentSlug } from '@/lib/manuals/slug'

export type ManualReviewState = { error?: string; ok?: boolean }

const reviewSchema = z.object({
  submissionId: z.string().trim().min(1),
  decision: z.enum(['APPROVE', 'REJECT', 'NEEDS_CHANGES']),
  note: z.string().trim().max(2000).optional(),
  rights: z.nativeEnum(DocumentRights),
})

export async function decideManualSubmissionAction(
  _previous: ManualReviewState,
  formData: FormData
): Promise<ManualReviewState> {
  let actorId: string
  try {
    actorId = requirePermission(await getSession(), 'admin:settings').userId
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const note = String(formData.get('note') ?? '').trim()
  const parsed = reviewSchema.safeParse({
    submissionId: formData.get('submissionId'),
    decision: formData.get('decision'),
    note: note || undefined,
    rights: formData.get('rights') || DocumentRights.LINK_ONLY,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the review form.' }

  if (parsed.data.decision !== 'APPROVE' && !parsed.data.note) {
    return { error: 'Add a note explaining the decision. The contributor needs a useful review record.' }
  }
  if (parsed.data.decision === 'APPROVE' && parsed.data.rights === DocumentRights.UNCLEAR) {
    return { error: 'Choose a clear hosting-rights decision before publishing.' }
  }

  try {
    const submission = await prisma.manualSubmission.findUnique({
      where: { id: parsed.data.submissionId },
      include: { duplicateOf: { select: { id: true, slug: true, title: true } } },
    })
    if (!submission) return { error: 'That submission no longer exists.' }
    if (submission.status === ManualSubmissionStatus.APPROVED) return { error: 'That submission is already published.' }
    if (
      parsed.data.decision === 'APPROVE' &&
      submission.fileKey &&
      !submission.sourceUrl &&
      parsed.data.rights === DocumentRights.LINK_ONLY
    ) {
      return { error: 'An uploaded-only document needs redistribution permission before it can be published.' }
    }

    await prisma.$transaction(async (tx) => {
      let documentId: string | undefined
      if (parsed.data.decision === 'APPROVE') {
        if (!submission.rightsAcknowledged) {
          throw new Error('The contributor did not confirm sharing permission.')
        }
        if (submission.verificationResult === ManualVerificationResult.REJECTED) {
          throw new Error('This submission failed its metadata checks and cannot be approved.')
        }

        const manufacturer = submission.manufacturer
          ? await tx.manufacturer.findFirst({
              where: { name: { equals: submission.manufacturer, mode: 'insensitive' } },
              select: { id: true },
            })
          : null
        const sourceKey = `${submission.sourceUrl ?? 'submission'}:${submission.id}`
        const document = await tx.document.create({
          data: {
            slug: documentSlug(submission.title, sourceKey),
            title: submission.title,
            kind: submission.kind,
            description: submission.description,
            manufacturerId: manufacturer?.id,
            fileKey: submission.fileKey,
            version: submission.version ?? '1',
            revision: submission.version,
            documentCode: submission.modelCode,
            language: 'en',
            fileSizeBytes: submission.fileSizeBytes,
            mimeType: submission.mimeType ?? 'application/pdf',
            originalFilename: submission.originalFilename,
            origin: DocumentOrigin.COMMUNITY_CONTRIBUTED,
            publisher: submission.manufacturer,
            sourceUrl: submission.sourceUrl,
            provenanceNote: `Submitted by a Doorlink community contributor and approved by an administrator on ${new Date().toISOString().slice(0, 10)}.`,
            dataSource: DataSource.COMMUNITY_SUBMITTED,
            isPublished: true,
            publishedAt: new Date(),
            rights: parsed.data.rights,
            rightsNote: parsed.data.note ?? null,
            verification: 'UNVERIFIED',
          },
          select: { id: true },
        })
        documentId = document.id
      }

      await tx.manualSubmission.update({
        where: { id: submission.id },
        data: {
          status:
            parsed.data.decision === 'APPROVE'
              ? ManualSubmissionStatus.APPROVED
              : parsed.data.decision === 'REJECT'
                ? ManualSubmissionStatus.REJECTED
                : ManualSubmissionStatus.NEEDS_CHANGES,
          rights: parsed.data.rights,
          adminNote: parsed.data.note ?? null,
          reviewerId: actorId,
          reviewedAt: new Date(),
          documentId,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'manual_submission.decide',
          entityType: 'ManualSubmission',
          entityId: submission.id,
          metadata: {
            from: submission.status,
            to: parsed.data.decision,
            rights: parsed.data.rights,
            duplicateOfId: submission.duplicateOfId,
            note: parsed.data.note ?? null,
          },
        },
      })
    })
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'That submission no longer exists.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    if (error instanceof Error && error.message.includes('permission')) return { error: error.message }
    if (error instanceof Error && error.message.includes('failed its metadata')) return { error: error.message }
    throw error
  }

  revalidatePath('/admin/manuals')
  revalidatePath('/admin/manuals/submissions')
  revalidatePath('/manuals/submissions')
  revalidatePath(`/manuals/submissions/${parsed.data.submissionId}`)
  if (parsed.data.decision === 'APPROVE') revalidatePath('/manuals')
  return { ok: true }
}

export async function returnManualSubmissionAction(
  _previous: ManualReviewState,
  formData: FormData
): Promise<ManualReviewState> {
  const next = new FormData()
  next.set('submissionId', String(formData.get('submissionId') ?? ''))
  next.set('decision', 'NEEDS_CHANGES')
  next.set('rights', String(formData.get('rights') ?? DocumentRights.LINK_ONLY))
  next.set('note', String(formData.get('note') ?? ''))
  return decideManualSubmissionAction({}, next)
}