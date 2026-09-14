'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requirePermission, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { COMMISSION_SETTING_KEY, MAX_COMMISSION_BPS } from '@/lib/commission'
import { currentCommissionBps } from '@/lib/commission-settings'

export type SettingsFormState = { error?: string; ok?: boolean }

// The form takes a percentage because that is what a person thinks in;
// it is stored as basis points because that is what arithmetic can be
// trusted with. Two decimal places is the resolution basis points give,
// so 12.345% is rejected rather than silently rounded to something the
// operator did not type.
const commissionSchema = z.object({
  percent: z.coerce
    .number({ invalid_type_error: 'Enter the commission as a percentage.' })
    .min(0, 'The commission cannot be negative.')
    .max(MAX_COMMISSION_BPS / 100, `The commission cannot exceed ${MAX_COMMISSION_BPS / 100}%.`),
})

export async function updateCommissionAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  let actorId: string
  try {
    // Deliberately `admin:settings`, not the `catalogue:write` the rest
    // of /admin is gated on: a manufacturer can edit the catalogue and
    // must not be able to change what Doorlink charges technicians.
    const session = requirePermission(await getSession(), 'admin:settings')
    actorId = session.userId
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = commissionSchema.safeParse({
    percent: formData.get('percent'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the form and try again.',
    }
  }

  const bps = Math.round(parsed.data.percent * 100)
  if (Math.abs(parsed.data.percent * 100 - bps) > 1e-9) {
    return {
      error: 'Use at most two decimal places — 12.5% and 12.55% are fine, 12.345% is not.',
    }
  }

  try {
    const previousBps = await currentCommissionBps()
    if (previousBps === bps) return { ok: true }

    await prisma.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { key: COMMISSION_SETTING_KEY },
        update: { value: bps },
        create: { key: COMMISSION_SETTING_KEY, value: bps },
      })

      // A rate change decides what every technician earns on every job
      // from this point on. It does not get to happen anonymously.
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'commission.update',
          entityType: 'PlatformSetting',
          entityId: COMMISSION_SETTING_KEY,
          metadata: { fromBps: previousBps, toBps: bps },
        },
      })
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }

  revalidatePath('/admin/settings')
  revalidatePath('/leads')
  return { ok: true }
}
