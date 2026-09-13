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
