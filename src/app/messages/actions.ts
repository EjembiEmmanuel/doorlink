'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession, type Session } from '@/lib/auth'
import { requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable, isRecordNotFound } from '@/lib/db-errors'
import { conversationFor, isParticipant, postMessage } from '@/lib/messaging'

export type MessageActionState = { error?: string; ok?: boolean }

const sendSchema = z.object({
  conversationId: z.string().trim().min(1),
  body: z.string().trim().min(1, 'Write a message first.').max(4000),
})

export async function sendMessageAction(
  _prevState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  let session: Session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = sendSchema.safeParse({
    conversationId: formData.get('conversationId'),
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Write a message first.' }

  try {
    // Membership is re-checked here rather than trusted from the page
    // that rendered the form. A conversation id in a form field is not
    // proof of anything.
    if (!(await isParticipant(parsed.data.conversationId, session.userId))) {
      return { error: 'Conversation not found.' }
    }

    await postMessage({
      conversationId: parsed.data.conversationId,
      senderId: session.userId,
      body: parsed.data.body,
      senderName: session.name,
    })
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'Conversation not found.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath(`/messages/${parsed.data.conversationId}`)
  revalidatePath('/messages')
  return { ok: true }
}

/**
 * Opens (or reopens) the thread for a lead or a job and sends the caller
 * to it. Used by the "Message the customer" / "Ask a question" buttons,
 * so a thread is created by the act of writing to someone rather than
 * existing empty from the moment a quote is sent.
 */
export async function openConversationAction(formData: FormData): Promise<void> {
  const session = requireSession(await getSession())

  const jobId = String(formData.get('jobId') ?? '').trim()
  const leadId = String(formData.get('leadId') ?? '').trim()

  let conversationId: string | null = null
  try {
    if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { customerId: true, workerId: true, reference: true, lead: { select: { title: true } } },
      })
      if (!job) return
      if (job.customerId !== session.userId && job.workerId !== session.userId) return

      const conversation = await conversationFor({ jobId }, job.lead?.title ?? `Job ${job.reference}`)
      conversationId = conversation?.id ?? null
    } else if (leadId) {
      // Only the quoting technician opens a lead thread; the customer
      // replies in it. A customer with five quotes reaches each thread
      // from the quote it belongs to.
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { title: true, reference: true },
      })
      if (!lead) return

      const conversation = await conversationFor(
        { leadId, workerUserId: session.userId },
        lead.title ?? `Request ${lead.reference}`
      )
      conversationId = conversation?.id ?? null
    }
  } catch (error) {
    if (isDatabaseUnreachable(error)) return
    throw error
  }

  if (!conversationId) return
  redirect(`/messages/${conversationId}`)
}
