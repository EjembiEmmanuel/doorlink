'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { decideSubmission } from '@/lib/manuals/submissions'

export type DecisionState = { error?: string; notice?: string }

const schema = z.object({
  submissionId: z.string().min(1),
  decision: z.enum(['approve', 'reject', 'request-info']),
  // A reason is required on every path, not just the negative ones. An
  // approval with no note leaves a published document nobody can account
  // for later, which is the opposite of what the audit trail is for.
  note: z.string().trim().min(1, 'Say why — it goes on the record and, where relevant, to the submitter.').max(2000),
})

export async function decide(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const session = await getSession()
  if (!session) return { error: 'Sign in again.' }
  if (!can(session.role, 'manual:review')) {
    return { error: 'This account cannot review manual submissions.' }
  }

  const parsed = schema.safeParse({
    submissionId: formData.get('submissionId'),
    decision: formData.get('decision'),
    note: formData.get('note'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  try {
    const result = await decideSubmission({
      submissionId: parsed.data.submissionId,
      adminId: session.userId,
      decision: parsed.data.decision,
      note: parsed.data.note,
    })
    if (!result.ok) return { error: result.message }
    revalidatePath('/admin/manual-submissions')
    return { notice: result.message }
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Can't reach the database right now. Nothing changed." }
    }
    throw error
  }
}
