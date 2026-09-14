import { JobStatus, LeadStatus, Prisma, QuoteStatus } from '@prisma/client'
import { prisma } from './prisma'
import { calculateSplit } from './commission'
import { currentCommissionBps } from './commission-settings'
import { makeReference } from './reference'

/**
 * The marketplace's state transitions, kept in one place so the rules
 * live somewhere a reader can check them rather than being spread across
 * the actions that happen to trigger them.
 */

/** Statuses where a lead is still genuinely open to new quotes. */
export const QUOTABLE_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.OPEN_FOR_QUOTES,
  LeadStatus.QUOTED,
]

export function isQuotable(status: LeadStatus): boolean {
  return QUOTABLE_LEAD_STATUSES.includes(status)
}

/** Jobs a customer can still be asked to review. */
export function isReviewable(status: JobStatus): boolean {
  return status === JobStatus.COMPLETED
}

export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.REQUESTED,
  JobStatus.ACCEPTED,
  JobStatus.AWAITING_PAYMENT,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
]

/**
 * Which status a given actor is allowed to move a job to.
 *
 * Deliberately asymmetric: a worker can say "I've started" and "I'm
 * done", but only a customer can cancel outright, and neither side can
 * unilaterally declare a dispute resolved. Encoding this as data rather
 * than scattered `if` statements means the job page can render exactly
 * the buttons a person is allowed to press.
 */
export type JobActor = 'customer' | 'worker' | 'admin'

const TRANSITIONS: Record<JobActor, Partial<Record<JobStatus, JobStatus[]>>> = {
  worker: {
    [JobStatus.ACCEPTED]: [JobStatus.SCHEDULED],
    [JobStatus.SCHEDULED]: [JobStatus.IN_PROGRESS],
    [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED],
  },
  customer: {
    [JobStatus.ACCEPTED]: [JobStatus.CANCELLED, JobStatus.DISPUTED],
    [JobStatus.SCHEDULED]: [JobStatus.CANCELLED, JobStatus.DISPUTED],
    [JobStatus.IN_PROGRESS]: [JobStatus.DISPUTED],
    [JobStatus.COMPLETED]: [JobStatus.DISPUTED],
  },
  admin: {
    [JobStatus.ACCEPTED]: [JobStatus.SCHEDULED, JobStatus.CANCELLED, JobStatus.DISPUTED],
    [JobStatus.SCHEDULED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED, JobStatus.DISPUTED],
    [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.DISPUTED],
    [JobStatus.COMPLETED]: [JobStatus.DISPUTED],
    [JobStatus.DISPUTED]: [JobStatus.COMPLETED, JobStatus.CANCELLED],
  },
}

export function allowedTransitions(actor: JobActor, from: JobStatus): JobStatus[] {
  return TRANSITIONS[actor][from] ?? []
}

export function canTransition(actor: JobActor, from: JobStatus, to: JobStatus): boolean {
  return allowedTransitions(actor, from).includes(to)
}

export function jobActorFor(
  job: { customerId: string | null; workerId: string | null },
  userId: string,
  isAdmin: boolean
): JobActor | null {
  if (job.customerId === userId) return 'customer'
  if (job.workerId === userId) return 'worker'
  if (isAdmin) return 'admin'
  return null
}

/**
 * Accepting a quote — the single most consequential action in the
 * marketplace, so it happens in one transaction:
 *
 *  1. the accepted quote is marked ACCEPTED
 *  2. every other quote on that lead is DECLINED (a customer cannot
 *     accidentally hire two people for one job)
 *  3. the lead moves to ASSIGNED and stops accepting quotes
 *  4. a Job is created
 *  5. a Transaction records the agreed split, with the commission rate
 *     snapshotted so a later rate change cannot rewrite this job's terms
 *
 * If any step fails, none of them happened.
 */
export async function acceptQuote(quoteId: string, acceptingUserId: string) {
  const commissionRateBps = await currentCommissionBps()

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { lead: true },
    })

    if (!quote) return { error: 'Quote not found.' as const }
    if (quote.lead.customerId !== acceptingUserId) return { error: 'Quote not found.' as const }
    if (quote.status !== QuoteStatus.PENDING) return { error: 'That quote is no longer open.' as const }
    if (!isQuotable(quote.lead.status)) return { error: 'This request is no longer accepting quotes.' as const }

    await tx.quote.update({
      where: { id: quote.id },
      data: { status: QuoteStatus.ACCEPTED, respondedAt: new Date() },
    })

    await tx.quote.updateMany({
      where: { leadId: quote.leadId, id: { not: quote.id }, status: QuoteStatus.PENDING },
      data: { status: QuoteStatus.DECLINED, respondedAt: new Date() },
    })

    await tx.lead.update({
      where: { id: quote.leadId },
      data: { status: LeadStatus.ASSIGNED, assignedUserId: quote.workerId },
    })

    const job = await tx.job.create({
      data: {
        reference: makeReference('JOB'),
        leadId: quote.leadId,
        quoteId: quote.id,
        customerId: quote.lead.customerId,
        workerId: quote.workerId,
        modelId: quote.lead.modelId,
        description: quote.lead.message,
        status: JobStatus.ACCEPTED,
        agreedPriceCents: quote.amountCents,
        currency: quote.currency,
      },
    })

    await tx.jobStatusEvent.create({
      data: {
        jobId: job.id,
        fromStatus: null,
        toStatus: JobStatus.ACCEPTED,
        actorId: acceptingUserId,
        note: 'Quote accepted by the customer.',
      },
    })

    const split = calculateSplit(quote.amountCents, commissionRateBps)
    await tx.transaction.create({
      data: {
        reference: makeReference('TXN'),
        jobId: job.id,
        customerId: quote.lead.customerId,
        workerId: quote.workerId,
        grossCents: split.grossCents,
        commissionRateBps: split.commissionRateBps,
        commissionCents: split.commissionCents,
        workerPayoutCents: split.workerPayoutCents,
        currency: quote.currency,
        // No payment provider is connected, so this records the agreed
        // split and stops. It is never marked PAID by anything other
        // than a real provider webhook.
        status: 'PENDING',
      },
    })

    return { job }
  })
}

/**
 * Recomputes a worker's cached rating from their reviews. Called after
 * a review is written rather than trusted to drift — the cache exists
 * for list performance, so it has to be derived, never incremented by
 * hand.
 */
export async function recomputeWorkerRating(workerUserId: string, tx: Prisma.TransactionClient = prisma) {
  const aggregate = await tx.workerReview.aggregate({
    where: { workerId: workerUserId },
    _avg: { rating: true },
    _count: true,
  })

  const completed = await tx.job.count({
    where: { workerId: workerUserId, status: JobStatus.COMPLETED },
  })

  await tx.technicianProfile.updateMany({
    where: { userId: workerUserId },
    data: {
      ratingAvg: aggregate._avg.rating,
      ratingCount: aggregate._count,
      jobsCompleted: completed,
    },
  })
}
