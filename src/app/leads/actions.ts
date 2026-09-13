'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { LeadStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession, type Session } from '@/lib/auth'
import { can, requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'

export type LeadContactResult = { name?: string; email?: string; phone?: string | null; error?: string }
export type LeadStatusFormState = { error?: string }

function claimedByCaller(lead: { assignedOrgId: string | null; assignedUserId: string | null }, session: Session) {
  if (lead.assignedOrgId) return lead.assignedOrgId === session.organizationId
  if (lead.assignedUserId) return lead.assignedUserId === session.userId
  return false
}

// Claiming a lead reveals its contact details and, on the first claim,
// moves it from "open" to "yours" — a lead already claimed by someone
// else stays hidden from everyone but them and admins.
export async function respondToLeadAction(leadId: string): Promise<LeadContactResult> {
  let session: Session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: 'Sign in as a technician to respond.' }
    throw error
  }

  if (!can(session.role, 'lead:write:own') && !can(session.role, 'lead:write:any')) {
    return { error: 'Only technicians can respond to requests.' }
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) return { error: 'Request not found.' }

    const alreadyMine = claimedByCaller(lead, session)
    const unclaimed = !lead.assignedOrgId && !lead.assignedUserId

    if (!alreadyMine && !unclaimed && !can(session.role, 'lead:write:any')) {
      return { error: 'Someone else already claimed this request.' }
    }

    if (unclaimed) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...(session.organizationId ? { assignedOrgId: session.organizationId } : { assignedUserId: session.userId }),
          status: LeadStatus.CONTACTED,
        },
      })
      revalidatePath('/leads')
    }

    return { name: lead.name, email: lead.email, phone: lead.phone }
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The request database is not reachable right now.' }
    throw error
  }
}

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED'] as const

const statusSchema = z.object({
  leadId: z.string().trim().min(1),
  status: z.enum(STATUSES),
})

export async function updateLeadStatusAction(
  _prevState: LeadStatusFormState,
  formData: FormData
): Promise<LeadStatusFormState> {
  let session: Session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: 'Sign in required.' }
    throw error
  }

  if (!can(session.role, 'lead:write:own') && !can(session.role, 'lead:write:any')) {
    return { error: 'Not permitted.' }
  }

  const parsed = statusSchema.safeParse({
    leadId: formData.get('leadId'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { error: 'Check the form and try again.' }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId } })
    if (!lead) return { error: 'Request not found.' }

    if (!claimedByCaller(lead, session) && !can(session.role, 'lead:write:any')) {
      return { error: 'Request not found.' }
    }

    await prisma.lead.update({
      where: { id: parsed.data.leadId },
      data: { status: LeadStatus[parsed.data.status] },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The request database is not reachable right now.' }
    throw error
  }

  revalidatePath('/leads')
  return {}
}
