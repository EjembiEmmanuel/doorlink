/**
 * Doorlink's marketplace commission.
 *
 * The rate is stored in PlatformSetting, not in code, because the brief
 * is explicit that an admin must be able to change it without a
 * rebuild. It is expressed in basis points (1/100th of a percent) so a
 * rate like 12.5% is an exact integer (1250) rather than a float that
 * has to be trusted to round the same way twice.
 *
 * This module is deliberately pure — no database, no environment, no
 * imports at all — because the quoting UI is a client component and has
 * to be able to show a technician their split before they submit.
 * Reading the configured rate lives in commission-settings.ts, which the
 * server imports and the browser never sees.
 */
export const COMMISSION_SETTING_KEY = 'marketplace_commission_bps'

/** 10% — a starting point, not a business decision that has been made. */
export const DEFAULT_COMMISSION_BPS = 1000

export const MAX_COMMISSION_BPS = 5000

export interface CommissionSplit {
  grossCents: number
  commissionRateBps: number
  commissionCents: number
  workerPayoutCents: number
}

/**
 * Splits a gross amount into Doorlink's commission and the worker's
 * payout.
 *
 * The worker's payout is computed as the remainder rather than
 * independently rounded, so commission + payout always equals gross
 * exactly. Rounding both halves separately is how marketplaces end up a
 * cent short and cannot reconcile.
 */
export function calculateSplit(grossCents: number, commissionRateBps: number): CommissionSplit {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new Error('grossCents must be a non-negative integer of minor units')
  }
  if (!Number.isInteger(commissionRateBps) || commissionRateBps < 0 || commissionRateBps > MAX_COMMISSION_BPS) {
    throw new Error(`commissionRateBps must be an integer between 0 and ${MAX_COMMISSION_BPS}`)
  }

  const commissionCents = Math.round((grossCents * commissionRateBps) / 10_000)
  return {
    grossCents,
    commissionRateBps,
    commissionCents,
    workerPayoutCents: grossCents - commissionCents,
  }
}

/**
 * Basis points as a percentage, with no trailing zeros: 1000 -> "10%",
 * 1250 -> "12.5%", 1255 -> "12.55%". Showing "12.50%" next to "10%" in
 * the same list reads as two different kinds of number.
 */
export function formatCommissionRate(bps: number): string {
  const percent = (bps / 100).toFixed(2).replace(/\.?0+$/, '')
  return `${percent}%`
}
