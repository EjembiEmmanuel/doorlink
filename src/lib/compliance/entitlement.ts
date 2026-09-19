import 'server-only'

import { CompliancePurchaseStatus } from '@prisma/client'
import { prisma } from '../prisma'
import { isDatabaseUnreachable } from '../db-errors'

/**
 * Who may open the pack.
 *
 * One rule, in one place: a PAID purchase row. Not a subscription, not a
 * role, not a flag on the profile — those drift apart, and the one that
 * drifts wrong either gives away a paid product or withholds one someone
 * bought.
 *
 * It fails CLOSED on a database error, which is the opposite of the
 * feature gate in `entitlements.ts`. That gate withholds nothing anyone
 * paid for, so failing open costs nothing; this one guards a purchase,
 * and handing it out because a query failed is the worse mistake. The
 * caller renders "we could not confirm your purchase", never "you have
 * not bought this".
 */
export interface ComplianceAccess {
  /** True only when a paid purchase was actually read. */
  granted: boolean
  /** False when the database could not be reached. */
  known: boolean
  purchasedAt: Date | null
}

export async function complianceAccess(userId: string): Promise<ComplianceAccess> {
  try {
    const purchase = await prisma.compliancePackPurchase.findFirst({
      where: { userId, status: CompliancePurchaseStatus.PAID },
      orderBy: { purchasedAt: 'asc' },
      select: { purchasedAt: true },
    })

    return {
      granted: Boolean(purchase),
      known: true,
      purchasedAt: purchase?.purchasedAt ?? null,
    }
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return { granted: false, known: false, purchasedAt: null }
  }
}
