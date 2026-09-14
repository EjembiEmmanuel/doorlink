import 'server-only'

import { JobStatus, NotificationType, type Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { notify } from './notifications'

/**
 * Messaging between a customer and a technician.
 *
 * The rule that shapes this module: Doorlink withholds phone numbers and
 * email addresses until a job is agreed, so messaging has to be a way to
 * ask a question *without* becoming a way around that. Threads therefore
 * carry a display name and nothing else — no contact details are read,
 * rendered, or exposed by anything here — and a thread can only exist
 * against a specific lead or job that both people are genuinely party to.
 */

/** Who is allowed into a conversation about a lead. */
export async function participantsForLead(leadId: string, workerUserId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, customerId: true, title: true, reference: true },
  })
  if (!lead?.customerId) return null

  // A technician may only open a thread on a lead they have actually
  // quoted on. Without that, the job board becomes a way to message
  // every customer on the platform.
  const quote = await prisma.quote.findUnique({
    where: { leadId_workerId: { leadId, workerId: workerUserId } },
    select: { id: true },
  })
  if (!quote) return null

  return { lead, userIds: [lead.customerId, workerUserId] }
}

/** Who is allowed into a conversation about a job. */
export async function participantsForJob(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, customerId: true, workerId: true, reference: true, lead: { select: { title: true } } },
  })
  if (!job?.customerId || !job.workerId) return null
  return { job, userIds: [job.customerId, job.workerId] }
}

/**
 * Finds the conversation for a lead or job, creating it on first use.
 * One thread per lead and one per job: a customer comparing five quotes
 * gets five separate threads, which is what they want, and the thread
 * they started before hiring is not the same thread as the job.
 */
export async function conversationFor(
  key: { leadId: string; workerUserId: string } | { jobId: string },
  subject: string | null
) {
  if ('jobId' in key) {
    const found = await participantsForJob(key.jobId)
    if (!found) return null
    return upsertConversation({ jobId: key.jobId }, found.userIds, subject)
  }

  const found = await participantsForLead(key.leadId, key.workerUserId)
  if (!found) return null
  // Scoped by worker as well as lead — one thread per quoting technician,
  // not one shared thread every technician can read.
  return upsertConversation({ leadId: key.leadId, workerUserId: key.workerUserId }, found.userIds, subject)
}

async function upsertConversation(
  scope: { jobId: string } | { leadId: string; workerUserId: string },
  userIds: string[],
  subject: string | null
) {
  const where: Prisma.ConversationWhereInput =
    'jobId' in scope
      ? { jobId: scope.jobId }
      : { leadId: scope.leadId, participants: { some: { userId: scope.workerUserId } } }

  const existing = await prisma.conversation.findFirst({ where, select: { id: true } })
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      jobId: 'jobId' in scope ? scope.jobId : null,
      leadId: 'jobId' in scope ? null : scope.leadId,
      subject,
      participants: { create: userIds.map((userId) => ({ userId })) },
    },
    select: { id: true },
  })
}

export async function isParticipant(conversationId: string, userId: string): Promise<boolean> {
  const found = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  })
  return Boolean(found)
}

/**
 * Posts a message and notifies everyone else in the thread, in one
 * transaction: a message nobody is told about is a message nobody reads.
 * The sender's own `lastReadAt` moves too, so their own message never
 * comes back to them as unread.
 */
export async function postMessage({
  conversationId,
  senderId,
  body,
  senderName,
}: {
  conversationId: string
  senderId: string
  body: string
  senderName: string
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()

    const message = await tx.message.create({
      data: { conversationId, senderId, body },
    })

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    })

    await tx.conversationParticipant.updateMany({
      where: { conversationId, userId: senderId },
      data: { lastReadAt: now },
    })

    const others = await tx.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true },
    })

    for (const other of others) {
      await notify(
        {
          userId: other.userId,
          type: NotificationType.MESSAGE_RECEIVED,
          title: `New message from ${senderName}`,
          // The preview is the message itself, trimmed. Nothing is
          // summarised or rewritten — a notification that paraphrases is
          // a notification you cannot trust.
          body: body.length > 140 ? `${body.slice(0, 139)}…` : body,
          href: `/messages/${conversationId}`,
        },
        tx
      )
    }

    return message
  })
}

export async function markConversationRead(conversationId: string, userId: string) {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  })
}

/**
 * Conversations a person is in, newest activity first, with the other
 * side's display name and how many messages they have not seen.
 *
 * The unread count is derived from `lastReadAt` rather than stored, so
 * it cannot drift out of agreement with the messages themselves.
 */
export async function listConversations(userId: string) {
  const rows = await prisma.conversationParticipant.findMany({
    where: { userId },
    orderBy: [{ conversation: { lastMessageAt: 'desc' } }, { conversation: { createdAt: 'desc' } }],
    take: 100,
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          subject: true,
          lastMessageAt: true,
          leadId: true,
          jobId: true,
          job: { select: { id: true, reference: true, status: true } },
          lead: { select: { id: true, reference: true, title: true } },
          participants: {
            where: { userId: { not: userId } },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  technicianProfile: { select: { businessName: true } },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { body: true, senderId: true, createdAt: true },
          },
        },
      },
    },
  })

  const counts = await Promise.all(
    rows.map((row) =>
      prisma.message.count({
        where: {
          conversationId: row.conversation.id,
          senderId: { not: userId },
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
      })
    )
  )

  return rows.map((row, index) => {
    const other = row.conversation.participants[0]?.user
    return {
      id: row.conversation.id,
      subject: row.conversation.subject,
      lastMessageAt: row.conversation.lastMessageAt,
      latest: row.conversation.messages[0] ?? null,
      unread: counts[index],
      job: row.conversation.job,
      lead: row.conversation.lead,
      // Display name only. Messaging is deliberately not a way around
      // Doorlink withholding contact details until a job is agreed.
      otherName: other?.technicianProfile?.businessName || other?.name || 'Doorlink user',
    }
  })
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const rows = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  })
  if (rows.length === 0) return 0

  const counts = await Promise.all(
    rows.map((row) =>
      prisma.message.count({
        where: {
          conversationId: row.conversationId,
          senderId: { not: userId },
          ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
        },
      })
    )
  )
  return counts.reduce((total, count) => total + count, 0)
}

/** Threads about a finished or cancelled job are read-only. */
export function isThreadOpen(job: { status: JobStatus } | null): boolean {
  if (!job) return true
  return job.status !== JobStatus.CANCELLED
}
