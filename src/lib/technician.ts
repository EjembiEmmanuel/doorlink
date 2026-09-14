import 'server-only'

import { VerificationStatus } from '@prisma/client'
import { prisma } from './prisma'

/**
 * A technician's profile row is created lazily rather than at
 * registration, because a profile is something a person fills in, not
 * something an account automatically has. Everything that needs one
 * calls this, so no page has to cope with the row being absent.
 */
export async function ensureTechnicianProfile(userId: string) {
  const existing = await prisma.technicianProfile.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.technicianProfile.create({ data: { userId } })
}

/**
 * Which statuses a technician is allowed to move themselves into.
 *
 * Submitting is theirs; the decision is not. A technician can send their
 * documents in (UNVERIFIED/REJECTED -> SUBMITTED) and can withdraw a
 * submission that has not been picked up yet, but nothing they do can
 * reach VERIFIED. That transition belongs to an admin who has actually
 * looked at a licence, and until Doorlink has a real verification
 * process the badge has to mean exactly that and nothing more.
 */
export function canSubmitForVerification(status: VerificationStatus): boolean {
  return status === VerificationStatus.UNVERIFIED || status === VerificationStatus.REJECTED
}

export function canWithdrawVerification(status: VerificationStatus): boolean {
  return status === VerificationStatus.SUBMITTED
}

/**
 * What a verification submission needs before it is worth an admin's
 * time. Returned as a list of what is missing so the form can say so,
 * rather than a bare boolean.
 */
export function missingForVerification(profile: {
  businessName: string | null
  businessPhone: string | null
  abn: string | null
  licenceNumber: string | null
  baseSuburb: string | null
  baseState: string | null
}): string[] {
  const missing: string[] = []
  if (!profile.businessName) missing.push('a business or trading name')
  if (!profile.businessPhone) missing.push('a contact number')
  if (!profile.abn) missing.push('an ABN')
  if (!profile.licenceNumber) missing.push('a licence number')
  if (!profile.baseSuburb || !profile.baseState) missing.push('where you are based')
  return missing
}

/**
 * How complete a profile is, as the specific things still missing.
 * A percentage would be a made-up number; a list is something a person
 * can act on.
 */
export function profileGaps(profile: {
  businessName: string | null
  headline: string | null
  bio: string | null
  businessPhone: string | null
  baseSuburb: string | null
  serviceCount: number
  areaCount: number
}): string[] {
  const gaps: string[] = []
  if (!profile.businessName) gaps.push('Add a business or trading name')
  if (!profile.businessPhone) gaps.push('Add a contact number')
  if (!profile.headline) gaps.push('Write a one-line summary of what you do')
  if (!profile.bio) gaps.push('Write an "about" for customers comparing quotes')
  if (!profile.baseSuburb) gaps.push('Say where you are based')
  if (profile.serviceCount === 0) gaps.push('Choose the services you offer')
  if (profile.areaCount === 0) gaps.push('Add at least one postcode you cover')
  return gaps
}
