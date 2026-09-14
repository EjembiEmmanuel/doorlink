'use server'

import { revalidatePath } from 'next/cache'
import { VerificationStatus } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requirePermission, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable, isRecordNotFound } from '@/lib/db-errors'

export type VerificationActionState = { error?: string; ok?: boolean }

const decisionSchema = z.object({
  profileId: z.string().trim().min(1),
  decision: z.enum(['IN_REVIEW', 'VERIFIED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
})

/**
 * The only path to VERIFIED in the whole codebase.
 *
 * It requires `admin:settings` — the same permission as changing what
 * Doorlink charges — because a verification badge is a statement
 * Doorlink makes to customers about a real person's credentials, and it
 * is made by a human who has looked at them. There is no verification
 * service connected, and no automated path here to add one by accident.
 */
export async function decideVerificationAction(
  _prevState: VerificationActionState,
  formData: FormData
): Promise<VerificationActionState> {
  let actorId: string
  try {
    const session = requirePermission(await getSession(), 'admin:settings')
    actorId = session.userId
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const note = String(formData.get('note') ?? '').trim()
  const parsed = decisionSchema.safeParse({
    profileId: formData.get('profileId'),
    decision: formData.get('decision'),
    note: note.length > 0 ? note : undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  // Rejecting without saying why leaves a technician with nothing to fix.
  if (parsed.data.decision === 'REJECTED' && !parsed.data.note) {
    return { error: 'Say why it was rejected — the technician sees this note and needs it to fix things.' }
  }

  const status = VerificationStatus[parsed.data.decision]

  try {
    const profile = await prisma.technicianProfile.findUnique({
      where: { id: parsed.data.profileId },
      select: { id: true, userId: true, verificationStatus: true },
    })
    if (!profile) return { error: 'That profile no longer exists.' }

    await prisma.$transaction(async (tx) => {
      await tx.technicianProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: status,
          // `verified` and `verifiedAt` track the one status that is a
          // claim to customers, so they are derived from it rather than
          // set separately and allowed to drift out of agreement.
          verified: status === VerificationStatus.VERIFIED,
          verifiedAt: status === VerificationStatus.VERIFIED ? new Date() : null,
          verificationNote: parsed.data.note ?? null,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'verification.decide',
          entityType: 'TechnicianProfile',
          entityId: profile.id,
          metadata: {
            from: profile.verificationStatus,
            to: status,
            note: parsed.data.note ?? null,
          },
        },
      })
    })

    revalidatePath('/admin/verification')
    revalidatePath('/my-profile')
    revalidatePath(`/technicians/${profile.userId}`)
  } catch (error) {
    if (isRecordNotFound(error)) return { error: 'That profile no longer exists.' }
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  return { ok: true }
}
