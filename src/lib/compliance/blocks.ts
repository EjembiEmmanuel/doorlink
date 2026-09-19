/**
 * The shape of a document's content.
 *
 * Documents are data, not JSX, for three reasons: the same content has
 * to render to screen and to print; values from the buyer's profile have
 * to be substituted in dozens of places without a template language; and
 * the content is transcribed from a source pack, so keeping it as plain
 * data makes it reviewable against that source rather than tangled up
 * with layout.
 *
 * Pure — no imports — so tests can read the content without a database.
 */

/** A field on the buyer's profile, substituted where the block asks. */
export type ProfileKey =
  | 'businessName'
  | 'tradingName'
  | 'abn'
  | 'acn'
  | 'businessAddress'
  | 'postalAddress'
  | 'phone'
  | 'mobile'
  | 'email'
  | 'website'
  | 'ownerName'
  | 'operationsManager'
  | 'complianceContact'
  | 'primarySiteContact'
  | 'emergencyContactName'
  | 'emergencyContactNumber'
  | 'firstAidOfficer'
  | 'state'
  | 'whsRegulator'
  | 'tradeLicenceNumber'
  | 'electricalLicenceNumber'
  | 'otherRegistration'
  | 'publicLiabilityInsurer'
  | 'publicLiabilityPolicy'
  | 'publicLiabilityExpiry'
  | 'workersCompPolicy'
  | 'workersCompExpiry'
  | 'preparedByName'
  | 'preparedByPosition'
  | 'approvedByName'
  | 'approvedByPosition'
  | 'packVersion'

export type Block =
  /** A numbered band, e.g. "02  POLICY STATEMENT". */
  | { kind: 'heading'; number: string; title: string }
  | { kind: 'para'; text: string }
  | { kind: 'bullets'; items: string[] }
  /** The orange IMPORTANT panel the source pack uses for caveats. */
  | { kind: 'important'; title?: string; text: string }
  /** A table with fixed content. */
  | { kind: 'table'; head: string[]; rows: string[][] }
  /**
   * A label/value table. A value of `null` prints an empty box for
   * someone to write in; a ProfileKey prints what the buyer entered.
   */
  | { kind: 'fields'; rows: Array<{ label: string; value: ProfileKey | null }> }
  /** A table with headings and N empty rows, to be completed by hand. */
  | { kind: 'blankRows'; head: string[]; count: number }
  /** A grid of items to tick, as the induction record uses. */
  | { kind: 'checkboxes'; lead?: string; items: string[] }
  /** Signature block. Each party gets name/position/signature/date. */
  | { kind: 'signature'; parties: string[] }
  /** The jurisdiction-aware legislation list. Rendered from the profile. */
  | { kind: 'legislation'; lead: string }
  /** The standard business-details block every document repeats. */
  | { kind: 'businessDetails' }
  /** The document-control block: number, version, dates, approvals. */
  | { kind: 'documentControl' }

export interface DocumentContent {
  code: string
  /** The one-line instruction under the title in the source pack. */
  intro: string
  blocks: Block[]
}

/** The business-details rows, identical on every document that has them. */
export const BUSINESS_DETAIL_ROWS: Array<{ label: string; value: ProfileKey | null }> = [
  { label: 'Company / business name', value: 'businessName' },
  { label: 'Trading name', value: 'tradingName' },
  { label: 'ABN', value: 'abn' },
  { label: 'ACN (if applicable)', value: 'acn' },
  { label: 'Business address', value: 'businessAddress' },
  { label: 'Postal address', value: 'postalAddress' },
  { label: 'Phone', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Emergency contact number', value: 'emergencyContactNumber' },
  { label: 'Responsible person / director', value: 'ownerName' },
  { label: 'State / territory', value: 'state' },
  { label: 'Applicable regulator', value: 'whsRegulator' },
]
