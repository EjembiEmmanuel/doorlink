'use server'

import { revalidatePath } from 'next/cache'
import { JobStatus, NotificationType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession, type Session } from '@/lib/auth'
import { can, requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable, isRecordNotFound } from '@/lib/db-errors'
import { canTransition, jobActorFor, isReviewable, recomputeWorkerRating } from '@/lib/marketplace'
import { notify } from '@/lib/notifications'
import { JOB_STATUS_LABELS } from '@/lib/labels'

export type JobActionState = { error?: string; ok?: boolean }

const STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'AWAITING_PAYMENT',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const

const transitionSchema = z.object({
  jobId: z.string().trim().min(1),
  toStatus: z.enum(STATUSES),
  note: z.string().trim().max(500).optional(),
  scheduledAt: z.string().trim().optional(),
})

export async function transitionJobAction(
  _prevState: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  let session: Session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const note = String(formData.get('note') ?? '').trim()
  const scheduledAt = String(formData.get('scheduledAt') ?? '').trim()

  const parsed = transitionSchema.safeParse({
    jobId: formData.get('jobId'),
    toStatus: formData.get('toStatus'),
    note: note.length > 0 ? note : undefined,
    scheduledAt: scheduledAt.length > 0 ? scheduledAt : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  try {
    const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId } })
    if (!job) return { error: 'Job not found.' }

    const actor = jobActorFor(job, session.userId, can(session.role, 'job:write:any'))
    // Neither party to the job, and not an admin — indistinguishable
    // from the job not existing.
    if (!actor) return { error: 'Job not found.' }

    const next = JobStatus[parsed.data.toStatus]
    if (!canTransition(actor, job.status, next)) {
      return { error: `You can't move this job from ${job.status} to ${next}.` }
    }

    const timestamps: Record<string, Date | null> = {}
    if (next === JobStatus.IN_PROGRESS) timestamps.startedAt = new Date()
    if (next === JobStatus.COMPLETED) timestamps.completedAt = new Date()
    if (next === JobStatus.CANCELLED) timestamps.cancelledAt = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: next,
          ...timestamps,
          ...(parsed.data.scheduledAt ? { scheduledAt: new Date(parsed.data.scheduledAt) } : {}),
          ...(next === JobStatus.CANCELLED && parsed.data.note
            ? { cancellationReason: parsed.data.note }
            : {}),
        },
      })

      await tx.jobStatusEvent.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: next,
          actorId: session.userId,
          note: parsed.data.note ?? null,
        },
      })

      // A completed job changes a worker's public record, so the cached
      // counts are recomputed from source rather than incremented.
      if (next === JobStatus.COMPLETED && job.workerId) {
        await recomputeWorkerRating(job.workerId, tx)
      }

      // Whoever did not press the button is the one who needs telling.
      const otherId = session.userId === job.customerId ? job.workerId : job.customerId
      if (otherId) {
        await notify(
          {
            userId: otherId,
            type:
              next === JobStatus.SCHEDULED
                ? NotificationType.JOB_SCHEDULED
                : next === JobStatus.COMPLETED
                  ? NotificationType.JOB_COMPLETED
                  : NotificationType.ORDER_UPDATE,
            title: `Job ${job.reference} is now ${JOB_STATUS_LABELS[next].toLowerCase()}`,
            body: parsed.data.note ?? `Moved from ${JOB_STATUS_LABELS[job.status].toLowerCase()}.`,
            href: `/jobs/${job.id}`,
          },
          tx
        )
      }
    })
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'Job not found.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath(`/jobs/${parsed.data.jobId}`)
  revalidatePath('/jobs')
  return { ok: true }
}

const reviewSchema = z.object({
  jobId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  body: z.string().trim().max(2000).optional(),
})

export async function reviewJobAction(
  _prevState: JobActionState,
  formData: FormData
): Promise<JobActionState> {
  let session: Session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const body = String(formData.get('body') ?? '').trim()
  const parsed = reviewSchema.safeParse({
    jobId: formData.get('jobId'),
    rating: formData.get('rating'),
    body: body.length > 0 ? body : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  try {
    const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId } })
    if (!job || job.customerId !== session.userId) return { error: 'Job not found.' }
    if (!job.workerId) return { error: 'This job has no technician to review.' }

    // The rule that keeps ratings meaningful: a review can only exist
    // for work that actually reached COMPLETED. Without this, ratings
    // are just opinions about jobs that may never have happened.
    if (!isReviewable(job.status)) {
      return { error: 'You can only review a job once it has been completed.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.workerReview.upsert({
        where: { jobId: job.id },
        update: { rating: parsed.data.rating, body: parsed.data.body ?? null },
        create: {
          jobId: job.id,
          authorId: session.userId,
          workerId: job.workerId!,
          rating: parsed.data.rating,
          body: parsed.data.body ?? null,
        },
      })
      await recomputeWorkerRating(job.workerId!, tx)

      await notify(
        {
          userId: job.workerId!,
          type: NotificationType.REVIEW_RECEIVED,
          title: `${parsed.data.rating}-star review on job ${job.reference}`,
          body: parsed.data.body ?? 'No comment was left.',
          href: `/jobs/${job.id}`,
        },
        tx
      )
    })
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'Job not found.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath(`/jobs/${parsed.data.jobId}`)
  return { ok: true }
}
