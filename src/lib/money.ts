// Integer minor units everywhere — no float drift in a marketplace.
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

export function formatMoney(cents: number, currency = 'AUD', locale = 'en-AU'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

export function sumMinorUnits(...amountsInCents: number[]): number {
  return amountsInCents.reduce((total, amount) => total + amount, 0)
}

/**
 * A budget range where either end can be missing. Written out in words
 * rather than as "— – $600" so a half-open range reads as a sentence:
 * a customer who only set a ceiling means "up to $600", not "unknown
 * to $600".
 */
export function formatBudgetRange(
  minCents: number | null,
  maxCents: number | null,
  currency = 'AUD'
): string | null {
  if (minCents === null && maxCents === null) return null
  if (minCents !== null && maxCents !== null) {
    return `${formatMoney(minCents, currency)} – ${formatMoney(maxCents, currency)}`
  }
  if (minCents !== null) return `From ${formatMoney(minCents, currency)}`
  return `Up to ${formatMoney(maxCents!, currency)}`
}
