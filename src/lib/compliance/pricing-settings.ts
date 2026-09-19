import 'server-only'

import { prisma } from '../prisma'
import { isDatabaseUnreachable } from '../db-errors'
import { COMPLIANCE_PRICE_SETTING_KEY, DEFAULT_COMPLIANCE_PRICE_CENTS, isValidPriceCents } from './pricing'

/**
 * The configured price, or the default when nothing is set or the value
 * stored is not a price. Falls back rather than throwing: a bad setting
 * should not take the page down, and the default is a real price rather
 * than a guess.
 */
export async function currentCompliancePriceCents(): Promise<number> {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: COMPLIANCE_PRICE_SETTING_KEY },
    })
    if (!setting) return DEFAULT_COMPLIANCE_PRICE_CENTS

    const value = typeof setting.value === 'number' ? setting.value : Number(setting.value)
    return isValidPriceCents(value) ? value : DEFAULT_COMPLIANCE_PRICE_CENTS
  } catch (error) {
    if (isDatabaseUnreachable(error)) return DEFAULT_COMPLIANCE_PRICE_CENTS
    throw error
  }
}
