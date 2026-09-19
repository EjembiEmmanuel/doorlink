import 'server-only'

import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { getSession } from '@/lib/auth'
import { complianceAccess } from '@/lib/compliance/entitlement'
import { completeness } from '@/lib/compliance/profile'

export type PackGate =
  | { state: 'signed-out' }
  | { state: 'unavailable' }
  | { state: 'not-purchased' }
  | { state: 'incomplete'; missing: string[] }
  | { state: 'ok'; profile: Record<string, unknown> }

/**
 * One gate, used by every page that renders a document.
 *
 * Three conditions have to hold before a branded compliance document is
 * produced, and they fail differently: not signed in, not paid for, not
 * filled in. Keeping them in one function means a new document page
 * cannot accidentally skip one — particularly the purchase check.
 */
export async function packGate(): Promise<PackGate> {
  const session = await getSession()
  if (!session) return { state: 'signed-out' }

  const access = await complianceAccess(session.userId)
  if (!access.known) return { state: 'unavailable' }
  if (!access.granted) return { state: 'not-purchased' }

  try {
    const profile = await prisma.complianceProfile.findUnique({ where: { userId: session.userId } })
    const status = completeness(profile)
    if (!status.canIssue) return { state: 'incomplete', missing: status.missingRequired }
    return { state: 'ok', profile: profile as unknown as Record<string, unknown> }
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return { state: 'unavailable' }
  }
}
