/**
 * The business details that brand every document in the pack.
 *
 * Pure — the form, the pack page and the tests all agree on what is
 * required because they read the same list from here.
 *
 * "Required" means required *to issue a document*, not to save a draft.
 * Someone filling this in over two sittings should never lose what they
 * typed because a later field is empty, so saving validates format only,
 * and completeness is a separate question asked at generation time.
 */

export interface ComplianceProfileFields {
  businessName: string | null
  tradingName: string | null
  abn: string | null
  acn: string | null
  businessAddress: string | null
  postalAddress: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  website: string | null
  ownerName: string | null
  operationsManager: string | null
  complianceContact: string | null
  primarySiteContact: string | null
  emergencyContactName: string | null
  emergencyContactNumber: string | null
  firstAidOfficer: string | null
  state: string | null
  whsRegulator: string | null
  tradeLicenceNumber: string | null
  electricalLicenceNumber: string | null
  otherRegistration: string | null
  publicLiabilityInsurer: string | null
  publicLiabilityPolicy: string | null
  publicLiabilityExpiry: Date | null
  workersCompPolicy: string | null
  workersCompExpiry: Date | null
  logoDataUri: string | null
  preparedByName: string | null
  preparedByPosition: string | null
  approvedByName: string | null
  approvedByPosition: string | null
  packVersion: string | null
  dateIssued: Date | null
}

export type ComplianceField = keyof ComplianceProfileFields

/**
 * Without these the documents would print blank where a business name,
 * an ABN or a signature belongs — which is worse than not issuing them,
 * because a half-filled compliance document still looks official.
 */
export const REQUIRED_FIELDS: Array<{ field: ComplianceField; label: string }> = [
  { field: 'businessName', label: 'Company or business name' },
  { field: 'abn', label: 'ABN' },
  { field: 'businessAddress', label: 'Business address' },
  { field: 'phone', label: 'Phone number' },
  { field: 'email', label: 'Email address' },
  { field: 'state', label: 'State or territory' },
  { field: 'ownerName', label: 'Business owner or director' },
  { field: 'emergencyContactName', label: 'Emergency contact name' },
  { field: 'emergencyContactNumber', label: 'Emergency contact number' },
  { field: 'approvedByName', label: 'Approved by (name)' },
  { field: 'approvedByPosition', label: 'Approved by (position)' },
]

/**
 * Not required, but each one leaves a visible blank on a document that
 * a client or insurer is likely to read. Reported separately so the UI
 * can distinguish "cannot issue" from "will look unfinished".
 */
export const RECOMMENDED_FIELDS: Array<{ field: ComplianceField; label: string }> = [
  { field: 'logoDataUri', label: 'Company logo' },
  { field: 'tradingName', label: 'Trading name' },
  { field: 'whsRegulator', label: 'Applicable WHS regulator' },
  { field: 'tradeLicenceNumber', label: 'Trade licence number' },
  { field: 'publicLiabilityInsurer', label: 'Public liability insurer' },
  { field: 'publicLiabilityPolicy', label: 'Public liability policy number' },
  { field: 'publicLiabilityExpiry', label: 'Public liability expiry date' },
  { field: 'workersCompPolicy', label: 'Workers compensation policy number' },
  { field: 'firstAidOfficer', label: 'Nominated first aid officer' },
  { field: 'preparedByName', label: 'Prepared by (name)' },
]

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return String(value).trim().length > 0
}

export interface ProfileCompleteness {
  /** True when every required field is present. */
  canIssue: boolean
  missingRequired: string[]
  missingRecommended: string[]
  /** Required fields filled, out of the total. For a progress line. */
  filled: number
  total: number
}

export function completeness(profile: Partial<ComplianceProfileFields> | null): ProfileCompleteness {
  const missingRequired = REQUIRED_FIELDS.filter(({ field }) => !isPresent(profile?.[field])).map(
    ({ label }) => label
  )

  const missingRecommended = RECOMMENDED_FIELDS.filter(({ field }) => !isPresent(profile?.[field])).map(
    ({ label }) => label
  )

  return {
    canIssue: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    filled: REQUIRED_FIELDS.length - missingRequired.length,
    total: REQUIRED_FIELDS.length,
  }
}

/**
 * An expiry that has passed, or passes within 30 days.
 *
 * Insurance lapsing is the single most common reason one of these packs
 * stops being worth anything, and the source pack says so explicitly:
 * "Insurance and licence details change. Diarise each expiry date."
 */
export interface ExpiryWarning {
  label: string
  date: Date
  expired: boolean
  daysRemaining: number
}

const DAY_MS = 86_400_000

export function expiryWarnings(
  profile: Partial<ComplianceProfileFields> | null,
  now: Date = new Date()
): ExpiryWarning[] {
  const candidates: Array<{ label: string; date: Date | null | undefined }> = [
    { label: 'Public liability insurance', date: profile?.publicLiabilityExpiry },
    { label: 'Workers compensation insurance', date: profile?.workersCompExpiry },
  ]

  const warnings: ExpiryWarning[] = []
  for (const { label, date } of candidates) {
    if (!date || Number.isNaN(date.getTime())) continue

    const daysRemaining = Math.floor((date.getTime() - now.getTime()) / DAY_MS)
    if (daysRemaining > 30) continue

    warnings.push({ label, date, expired: daysRemaining < 0, daysRemaining })
  }

  return warnings
}

/** ABNs are 11 digits. Spaces are normal in how people type them. */
export function normaliseAbn(value: string): string {
  return value.replace(/\s+/g, '')
}

export function isValidAbn(value: string): boolean {
  return /^\d{11}$/.test(normaliseAbn(value))
}

/** ACNs are 9 digits, and optional. */
export function isValidAcn(value: string): boolean {
  return /^\d{9}$/.test(value.replace(/\s+/g, ''))
}
