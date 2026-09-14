'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { LeadStatus, QuoteStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession, type Session } from '@/lib/auth'
import { requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable, isRecordNotFound } from '@/lib/db-errors'
import { acceptQuote } from '@/lib/marketplace'

export type RequestActionState = { error?: string }

async function requireCustomer(): Promise<Session> {
  return requireSession(await getSession())
}

export async function acceptQuoteAction(
  _prevState: RequestActionState,
  formData: FormData
): Promise<RequestActionState> {
  let session: Session
  try {
    session = await requireCustomer()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const quoteId = String(formData.get('quoteId') ?? '')
  if (!quoteId) return { error: 'Missing quote.' }

  let jobId: string
  try {
    // All the consequential work — accepting one quote, declining the
    // rest, assigning the lead, creating the job and its transaction —
    // happens inside a single transaction in acceptQuote().
    const result = await acceptQuote(quoteId, session.userId)
    if ('error' in result) return { error: result.error }
    jobId = result.job.id
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'Quote not found.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath('/my-requests')
  redirect(`/jobs/${jobId}`)
}

export async function cancelRequestAction(
  _prevState: RequestActionState,
  formData: FormData
): Promise<RequestActionState> {
  let session: Session
  try {
    session = await requireCustomer()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const leadId = String(formData.get('leadId') ?? '')
  if (!leadId) return { error: 'Missing request.' }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead || lead.customerId !== session.userId) return { error: 'Request not found.' }
    if (lead.status === LeadStatus.ASSIGNED) {
      return { error: 'This request already has a job attached. Cancel the job instead.' }
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.CANCELLED, closedAt: new Date() },
      }),
      // Outstanding quotes are closed too, so no technician is left
      // waiting on a decision that will never come.
      prisma.quote.updateMany({
        where: { leadId: lead.id, status: QuoteStatus.PENDING },
        data: { status: QuoteStatus.DECLINED, respondedAt: new Date() },
      }),
    ])
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'Request not found.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath('/my-requests')
  return {}
}
