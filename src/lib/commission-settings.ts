import 'server-only'

import { prisma } from './prisma'
import { isDatabaseUnreachable } from './db-errors'
import { COMMISSION_SETTING_KEY, DEFAULT_COMMISSION_BPS, MAX_COMMISSION_BPS } from './commission'

/**
 * The rate an admin has configured, or the default when nothing is set
 * or the database is unreachable. Quoting UI reads this to *preview* a
 * split; the rate that actually governs a job is snapshotted onto the
 * Transaction when the quote is accepted.
 */
export async function currentCommissionBps(): Promise<number> {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { key: COMMISSION_SETTING_KEY } })
    if (!setting) return DEFAULT_COMMISSION_BPS

    const value = typeof setting.value === 'number' ? setting.value : Number(setting.value)
    if (!Number.isInteger(value) || value < 0 || value > MAX_COMMISSION_BPS) {
      return DEFAULT_COMMISSION_BPS
    }
    return value
  } catch (error) {
    if (isDatabaseUnreachable(error)) return DEFAULT_COMMISSION_BPS
    throw error
  }
}
