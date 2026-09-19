'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CompliancePurchaseStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { AU_STATES } from '@/lib/australia'
import { paymentProvider } from '@/lib/payments'
import { checkLogoDataUri } from '@/lib/compliance/logo'
import { isValidAbn, isValidAcn, normaliseAbn } from '@/lib/compliance/profile'
import { currentCompliancePriceCents } from '@/lib/compliance/pricing-settings'
import { COMPLIANCE_CURRENCY, purchaseReference } from '@/lib/compliance/pricing'
import { complianceAccess } from '@/lib/compliance/entitlement'

export type ComplianceActionState = { error?: string; ok?: boolean; notice?: string }

async function requireUser(): Promise<string> {
  return requireSession(await getSession()).userId
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), 'Enter a valid date.')

const profileSchema = z.object({
  businessName: optionalText(200),
  tradingName: optionalText(200),
  abn: optionalText(20).refine((value) => value === null || isValidAbn(value), 'An ABN is 11 digits.'),
  acn: optionalText(20).refine((value) => value === null || isValidAcn(value), 'An ACN is 9 digits.'),
  businessAddress: optionalText(400),
  postalAddress: optionalText(400),
  phone: optionalText(40),
  mobile: optionalText(40),
  email: optionalText(200).refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    'Enter a valid email address.'
  ),
  website: optionalText(200),
  ownerName: optionalText(200),
  operationsManager: optionalText(200),
  complianceContact: optionalText(200),
  primarySiteContact: optionalText(200),
  emergencyContactName: optionalText(200),
  emergencyContactNumber: optionalText(40),
  firstAidOfficer: optionalText(200),
  state: optionalText(10).refine(
    (value) => value === null || (AU_STATES as readonly string[]).includes(value),
    'Choose a state or territory.'
  ),
  whsRegulator: optionalText(200),
  tradeLicenceNumber: optionalText(100),
  electricalLicenceNumber: optionalText(100),
  otherRegistration: optionalText(200),
  publicLiabilityInsurer: optionalText(200),
  publicLiabilityPolicy: optionalText(100),
  publicLiabilityExpiry: optionalDate,
  workersCompPolicy: optionalText(100),
  workersCompExpiry: optionalDate,
  preparedByName: optionalText(200),
  preparedByPosition: optionalText(200),
  approvedByName: optionalText(200),
  approvedByPosition: optionalText(200),
  packVersion: optionalText(40),
})

/**
 * Saving validates format only, never completeness. Someone filling in
 * thirty fields over two sittings must not lose what they typed because
 * a field further down is still empty — whether the profile is complete
 * enough to issue a document is a separate question, asked at the point
 * of issuing.
 */
export async function saveComplianceProfileAction(
  _prevState: ComplianceActionState,
  formData: FormData
): Promise<ComplianceActionState> {
  let userId: string
  try {
    userId = await requireUser()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const raw = Object.fromEntries(
    Object.keys(profileSchema.shape).map((key) => [key, formData.get(key) ?? undefined])
  )

  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue?.message ?? 'Check the form and try again.' }
  }

  const data = { ...parsed.data }
  if (data.abn) data.abn = normaliseAbn(data.abn)

  try {
    await prisma.complianceProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Couldn't save that — the database is not reachable right now." }
    }
    throw error
  }

  revalidatePath('/compliance')
  revalidatePath('/compliance/details')
  revalidatePath('/compliance/pack')
  return { ok: true }
}

const logoSchema = z.object({ logoDataUri: z.string().max(1_000_000) })

export async function saveComplianceLogoAction(
  _prevState: ComplianceActionState,
  formData: FormData
): Promise<ComplianceActionState> {
  let userId: string
  try {
    userId = await requireUser()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = logoSchema.safeParse({ logoDataUri: formData.get('logoDataUri') ?? '' })
  if (!parsed.success) return { error: 'That image could not be read.' }

  // Re-checked here rather than trusting the browser: the form is the
  // convenient path to this action, not the only one.
  const check = checkLogoDataUri(parsed.data.logoDataUri)
  if (!check.ok) return { error: check.error ?? 'That image could not be used.' }

  try {
    await prisma.complianceProfile.upsert({
      where: { userId },
      create: { userId, logoDataUri: parsed.data.logoDataUri.trim() },
      update: { logoDataUri: parsed.data.logoDataUri.trim() },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Couldn't save that — the database is not reachable right now." }
    }
    throw error
  }

  revalidatePath('/compliance/details')
  revalidatePath('/compliance/pack')
  return { ok: true, notice: `Logo saved (${Math.round((check.bytes ?? 0) / 1024)} KB).` }
}

export async function removeComplianceLogoAction(
  _prevState: ComplianceActionState,
  _formData: FormData
): Promise<ComplianceActionState> {
  let userId: string
  try {
    userId = await requireUser()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  try {
    await prisma.complianceProfile.updateMany({ where: { userId }, data: { logoDataUri: null } })
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Couldn't remove it — the database is not reachable right now." }
    }
    throw error
  }

  revalidatePath('/compliance/details')
  revalidatePath('/compliance/pack')
  return { ok: true, notice: 'Logo removed.' }
}

/**
 * Buying the pack.
 *
 * This is where the feature meets the fact that no payment provider is
 * connected. It does the real thing as far as it can go — it records a
 * PENDING purchase at the current price, then asks for a provider — and
 * stops honestly when there isn't one.
 *
 * What it must never do is mark the purchase PAID. A row saying someone
 * paid $29.99 when no money moved is a fabricated financial record, and
 * it would unlock the pack for free while looking, to anyone reading the
 * database later, exactly like a real sale.
 */
export async function startCompliancePurchaseAction(
  _prevState: ComplianceActionState,
  _formData: FormData
): Promise<ComplianceActionState> {
  let userId: string
  try {
    userId = await requireUser()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  try {
    const existing = await complianceAccess(userId)
    if (existing.granted) return { ok: true, notice: 'You already have the pack.' }

    const priceCents = await currentCompliancePriceCents()

    const provider = paymentProvider()
    if (!provider) {
      // Recorded anyway, so the interest is not lost and the price at the
      // time is on file. The status says exactly what it is.
      await prisma.compliancePackPurchase.create({
        data: {
          userId,
          reference: purchaseReference(),
          priceCents,
          currency: COMPLIANCE_CURRENCY,
          status: CompliancePurchaseStatus.PENDING,
        },
      })

      revalidatePath('/compliance')
      return {
        error:
          'Doorlink cannot take payments yet — no payment provider is connected. Your interest has been recorded and you will be able to complete this purchase once one is.',
      }
    }

    // Reached only once a provider exists. The webhook marks it PAID;
    // nothing on this path does.
    const reference = purchaseReference()
    await prisma.compliancePackPurchase.create({
      data: {
        userId,
        reference,
        priceCents,
        currency: COMPLIANCE_CURRENCY,
        status: CompliancePurchaseStatus.PENDING,
      },
    })

    revalidatePath('/compliance')
    return { ok: true, notice: 'Purchase started.' }
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: 'The database is not reachable right now. Nothing was charged.' }
    }
    throw error
  }
}
