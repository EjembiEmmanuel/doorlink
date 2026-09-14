import type {
  DocumentKind,
  DocumentOrigin,
  JobStatus,
  LeadStatus,
  QuoteStatus,
  SubscriptionStatus,
  TransactionStatus,
  UrgencyLevel,
  VerificationStatus,
} from '@prisma/client'

export type Tone = 'neutral' | 'signal' | 'caution' | 'good' | 'bad'

// One place for every enum's human label and badge tone. These are
// exhaustive `Record<Enum, ...>` types on purpose: adding a value to an
// enum in the schema then breaks the build here rather than silently
// rendering `undefined` in a badge somewhere.

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  INSTALL_MANUAL: 'Installation manual',
  USER_MANUAL: 'User manual',
  WIRING_DIAGRAM: 'Wiring diagram',
  PARTS_LIST: 'Parts list',
  SPEC_SHEET: 'Spec sheet',
  WARRANTY: 'Warranty',
  SERVICE_BULLETIN: 'Service bulletin',
  PROGRAMMING_GUIDE: 'Programming guide',
  TROUBLESHOOTING_GUIDE: 'Troubleshooting guide',
  TECHNICAL_DOCUMENT: 'Technical document',
  SAFETY_DOCUMENT: 'Safety document',
  QUICK_START: 'Quick start',
  DECLARATION_OF_CONFORMITY: 'Declaration of conformity',
}

export const DOCUMENT_ORIGIN_LABELS: Record<DocumentOrigin, string> = {
  MANUFACTURER_ORIGINAL: "Manufacturer's original",
  THIRD_PARTY_GUIDE: 'Third-party guide',
  COMMUNITY_CONTRIBUTED: 'Community contributed',
  DOORLINK_AUTHORED: 'Written by DoorLink',
  UNKNOWN: 'Origin unknown',
}

// Only a manufacturer's own file gets a confident tone. Everything else
// is useful but not official, and the badge has to say so.
export const DOCUMENT_ORIGIN_TONE: Record<DocumentOrigin, Tone> = {
  MANUFACTURER_ORIGINAL: 'good',
  THIRD_PARTY_GUIDE: 'caution',
  COMMUNITY_CONTRIBUTED: 'caution',
  DOORLINK_AUTHORED: 'signal',
  UNKNOWN: 'neutral',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  OPEN_FOR_QUOTES: 'Open for quotes',
  QUOTED: 'Quoted',
  ASSIGNED: 'Assigned',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  CONVERTED: 'Converted',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

export const LEAD_STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: 'signal',
  OPEN_FOR_QUOTES: 'signal',
  QUOTED: 'caution',
  ASSIGNED: 'good',
  CONTACTED: 'caution',
  QUALIFIED: 'caution',
  CONVERTED: 'good',
  CLOSED: 'neutral',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  AWAITING_PAYMENT: 'Awaiting payment',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
}

export const JOB_STATUS_TONE: Record<JobStatus, Tone> = {
  REQUESTED: 'signal',
  ACCEPTED: 'signal',
  AWAITING_PAYMENT: 'caution',
  SCHEDULED: 'caution',
  IN_PROGRESS: 'caution',
  COMPLETED: 'good',
  CANCELLED: 'neutral',
  DISPUTED: 'bad',
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired',
}

export const QUOTE_STATUS_TONE: Record<QuoteStatus, Tone> = {
  PENDING: 'signal',
  ACCEPTED: 'good',
  DECLINED: 'neutral',
  WITHDRAWN: 'neutral',
  EXPIRED: 'neutral',
}

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  EMERGENCY: 'Emergency',
  URGENT: 'Urgent',
  STANDARD: 'Standard',
  FLEXIBLE: 'Flexible',
}

export const URGENCY_TONE: Record<UrgencyLevel, Tone> = {
  EMERGENCY: 'bad',
  URGENT: 'caution',
  STANDARD: 'neutral',
  FLEXIBLE: 'neutral',
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Not verified',
  SUBMITTED: 'Documents submitted',
  IN_REVIEW: 'In review',
  VERIFIED: 'Verified by DoorLink',
  REJECTED: 'Verification rejected',
}

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  UNVERIFIED: 'neutral',
  SUBMITTED: 'caution',
  IN_REVIEW: 'caution',
  VERIFIED: 'good',
  REJECTED: 'bad',
}

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Pending',
  REQUIRES_ACTION: 'Requires action',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  CANCELLED: 'Cancelled',
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  INCOMPLETE: 'Incomplete',
  TRIALING: 'Trialing',
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}
