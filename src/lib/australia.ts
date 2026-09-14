/**
 * Doorlink is an Australian product, so the address fields are Australian
 * ones rather than a generic "region"/"zip" pair. Kept in one place
 * because three forms were each carrying their own copy of the list.
 */
export const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const

export type AuState = (typeof AU_STATES)[number]

export function isAuState(value: string): value is AuState {
  return (AU_STATES as readonly string[]).includes(value)
}

/** Australian postcodes are exactly four digits, 0200–9999. */
export const AU_POSTCODE_PATTERN = /^\d{4}$/

export function isAuPostcode(value: string): boolean {
  return AU_POSTCODE_PATTERN.test(value)
}
