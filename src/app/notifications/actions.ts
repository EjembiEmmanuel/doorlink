'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'

export type NotificationActionState = { error?: string; ok?: boolean }

export async function markAllReadAction(
  _prevState: NotificationActionState,
  _formData: FormData
): Promise<NotificationActionState> {
  let userId: string
  try {
    userId = requireSession(await getSession()).userId
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  try {
    // Scoped to the caller's own rows — there is no notification id in
    // this form, and there is deliberately no way to mark someone
    // else's.
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
  return { ok: true }
}
