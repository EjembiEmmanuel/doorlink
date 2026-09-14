import 'server-only'

import { NotificationType, PayoutStatus, Prisma, TransactionStatus } from '@prisma/client'
import { prisma } from '../prisma'
import { notify } from '../notifications'
import { formatMoney } from '../money'

/**
 * The transaction ledger.
 *
 * Money in Doorlink moves in exactly one direction through this file:
 * a provider tells us something happened, and we record it. There is no
 * function here that marks a transaction PAID on anyone's say-so — the
 * only caller of `applyPaymentSucceeded` is the verified-webhook handler,
 * and that is deliberate.
 *
 * Every state change also writes a TransactionEvent, so the history of a
 * payment is reconstructable from the database rather than inferred from
 * its current status.
 */

export interface LedgerEvent {
  transactionId: string
  status: TransactionStatus
  note: string
  providerRef?: string | null
  amountCents?: number | null
}

async function recordEvent(tx: Prisma.TransactionClient, event: LedgerEvent) {
  await tx.transactionEvent.create({
    data: {
      transactionId: event.transactionId,
      type: event.status,
      note: event.note,
      amountCents: event.amountCents ?? null,
      payload: event.providerRef ? { providerRef: event.providerRef } : undefined,
    },
  })
}

/**
 * Records that a payment attempt has been started with the provider.
 * This is not money moving — it is us having asked.
 */
export async function markPaymentStarted(transactionId: string, providerIntentId: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.REQUIRES_ACTION, provider: 'stripe', providerRef: providerIntentId },
    })
    await recordEvent(tx, {
      transactionId,
      status: TransactionStatus.REQUIRES_ACTION,
      note: 'Payment started with the provider.',
      providerRef: providerIntentId,
    })
    return updated
  })
}

/**
 * The provider has confirmed the customer's money arrived.
 *
 * Idempotent on purpose: providers retry webhooks, and a retry must not
 * produce a second payout record or a second notification.
 */
export async function applyPaymentSucceeded(providerIntentId: string, paidAt: Date) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { providerRef: providerIntentId },
      include: { job: { select: { id: true, reference: true } } },
    })
    if (!transaction) return { ok: false as const, reason: 'unknown_intent' as const }
    if (transaction.status === TransactionStatus.PAID) {
      return { ok: true as const, alreadyApplied: true as const, transaction }
    }

    const updated = await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.PAID, paidAt },
    })

    await recordEvent(tx, {
      transactionId: transaction.id,
      status: TransactionStatus.PAID,
      note: 'Provider confirmed payment.',
      providerRef: providerIntentId,
      amountCents: transaction.grossCents,
    })

    // The worker's share becomes owed at this moment. It is scheduled,
    // not paid — money leaving Doorlink is its own event, recorded when
    // the provider confirms that too.
    //
    // `workerId` is nullable on the model because a Transaction can in
    // principle exist without one (a platform fee, a subscription). A
    // payout without a recipient is not something to invent a default
    // for, so it is simply not created.
    if (transaction.workerId) {
      await tx.payout.create({
        data: {
          workerId: transaction.workerId,
          transactionId: transaction.id,
          amountCents: transaction.workerPayoutCents,
          currency: transaction.currency,
          status: PayoutStatus.PENDING,
        },
      })

      await notify(
        {
          userId: transaction.workerId,
          type: NotificationType.PAYMENT_STATUS,
          title: 'The customer has paid',
          body: `${formatMoney(transaction.workerPayoutCents, transaction.currency)} is owed to you for job ${transaction.job?.reference ?? ''}.`,
          href: '/earnings',
        },
        tx
      )
    }

    if (transaction.customerId) {
      await notify(
        {
          userId: transaction.customerId,
          type: NotificationType.PAYMENT_STATUS,
          title: 'Payment received',
          body: `Your payment of ${formatMoney(transaction.grossCents, transaction.currency)} for job ${transaction.job?.reference ?? ''} has gone through.`,
          href: transaction.job ? `/jobs/${transaction.job.id}` : '/jobs',
        },
        tx
      )
    }

    return { ok: true as const, alreadyApplied: false as const, transaction: updated }
  })
}

export async function applyPaymentFailed(providerIntentId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({ where: { providerRef: providerIntentId } })
    if (!transaction) return { ok: false as const, reason: 'unknown_intent' as const }

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.FAILED, failureReason: reason },
    })
    await recordEvent(tx, {
      transactionId: transaction.id,
      status: TransactionStatus.FAILED,
      note: reason,
      providerRef: providerIntentId,
    })
    return { ok: true as const }
  })
}

/**
 * A refund the provider has confirmed. Partial refunds are tracked by
 * accumulating `refundedCents`, so a job refunded twice in parts ends up
 * correctly marked fully refunded rather than being overwritten by
 * whichever webhook arrived last.
 */
export async function applyRefund(providerIntentId: string, amountCents: number, reason: string) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({ where: { providerRef: providerIntentId } })
    if (!transaction) return { ok: false as const, reason: 'unknown_intent' as const }

    const refunded = transaction.refundedCents + amountCents
    const status =
      refunded >= transaction.grossCents ? TransactionStatus.REFUNDED : TransactionStatus.PARTIALLY_REFUNDED

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { refundedCents: refunded, status },
    })
    await recordEvent(tx, {
      transactionId: transaction.id,
      status,
      note: reason,
      providerRef: providerIntentId,
      amountCents,
    })
    return { ok: true as const, status }
  })
}

export async function applyPayoutStatus(providerPayoutId: string, status: PayoutStatus, paidAt: Date | null) {
  const payout = await prisma.payout.findFirst({ where: { providerRef: providerPayoutId } })
  if (!payout) return { ok: false as const }

  await prisma.payout.update({
    where: { id: payout.id },
    data: { status, paidAt },
  })
  return { ok: true as const }
}

/**
 * What a worker is owed and has been paid. Computed from payouts and
 * transactions rather than kept as a running balance, because a balance
 * that drifts is worse than one that takes a moment to add up.
 */
export async function workerEarnings(workerUserId: string) {
  const [paidOut, scheduled, pendingPayment, lifetimeCommission] = await Promise.all([
    prisma.payout.aggregate({
      where: { workerId: workerUserId, status: PayoutStatus.PAID },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.payout.aggregate({
      where: { workerId: workerUserId, status: { in: [PayoutStatus.PENDING, PayoutStatus.SCHEDULED] } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        workerId: workerUserId,
        status: { in: [TransactionStatus.PENDING, TransactionStatus.REQUIRES_ACTION] },
      },
      _sum: { workerPayoutCents: true, grossCents: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { workerId: workerUserId, status: TransactionStatus.PAID },
      _sum: { commissionCents: true, grossCents: true },
    }),
  ])

  return {
    paidOutCents: paidOut._sum.amountCents ?? 0,
    paidOutCount: paidOut._count,
    scheduledCents: scheduled._sum.amountCents ?? 0,
    scheduledCount: scheduled._count,
    awaitingPaymentCents: pendingPayment._sum.workerPayoutCents ?? 0,
    awaitingPaymentGrossCents: pendingPayment._sum.grossCents ?? 0,
    awaitingPaymentCount: pendingPayment._count,
    commissionPaidCents: lifetimeCommission._sum.commissionCents ?? 0,
    grossEarnedCents: lifetimeCommission._sum.grossCents ?? 0,
  }
}
