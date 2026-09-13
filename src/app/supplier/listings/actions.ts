'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { DataSource, ListingCondition, ListingStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession, type Session } from '@/lib/auth'
import { requirePermission, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { toMinorUnits } from '@/lib/money'

export type ListingFormState = { error?: string }

const CONDITIONS = ['NEW', 'REFURBISHED', 'USED'] as const
const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT', 'ARCHIVED'] as const

const listingSchema = z.object({
  modelId: z.string().trim().min(1, 'Choose a model.'),
  title: z.string().trim().min(1, 'Enter a listing title.'),
  price: z.coerce.number().positive('Enter a price greater than zero.'),
  condition: z.enum(CONDITIONS),
  status: z.enum(STATUSES),
  stockQty: z.coerce.number().int().min(0, 'Stock cannot be negative.'),
})

// Every action here is scoped to the caller's own organization — a
// supplier manages their own listings, never anyone else's, and the
// permission check plus the organizationId requirement are both
// re-verified here regardless of which page rendered the form.
async function assertCanManageOwnListings(): Promise<Session & { organizationId: string }> {
  const session = await getSession()
  const active = requirePermission(session, 'listing:write:own')
  if (!active.organizationId) {
    throw new RbacError('Your account is not linked to a supplier organization.', 403)
  }
  return active as Session & { organizationId: string }
}

function readForm(formData: FormData) {
  return listingSchema.safeParse({
    modelId: formData.get('modelId'),
    title: formData.get('title'),
    price: formData.get('price'),
    condition: formData.get('condition'),
    status: formData.get('status'),
    stockQty: formData.get('stockQty'),
  })
}

export async function createListingAction(
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  let session: Session & { organizationId: string }
  try {
    session = await assertCanManageOwnListings()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = readForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  try {
    await prisma.listing.create({
      data: {
        organizationId: session.organizationId,
        modelId: parsed.data.modelId,
        title: parsed.data.title,
        priceCents: toMinorUnits(parsed.data.price),
        condition: ListingCondition[parsed.data.condition],
        status: ListingStatus[parsed.data.status],
        stockQty: parsed.data.stockQty,
        // A supplier's own listing is self-reported, never pre-verified —
        // the same provenance boundary Session 3 drew for registration: a
        // supplier can't mark their own data admin- or
        // manufacturer-verified just by creating it.
        dataSource: DataSource.COMMUNITY_SUBMITTED,
      },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The catalogue database is not reachable right now.' }
    throw error
  }

  revalidatePath('/supplier/listings')
  redirect('/supplier/listings')
}

export async function updateListingAction(
  id: string,
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  let session: Session & { organizationId: string }
  try {
    session = await assertCanManageOwnListings()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = readForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  try {
    const existing = await prisma.listing.findUnique({ where: { id } })
    if (!existing || existing.organizationId !== session.organizationId) {
      return { error: 'Listing not found.' }
    }

    await prisma.listing.update({
      where: { id },
      data: {
        modelId: parsed.data.modelId,
        title: parsed.data.title,
        priceCents: toMinorUnits(parsed.data.price),
        condition: ListingCondition[parsed.data.condition],
        status: ListingStatus[parsed.data.status],
        stockQty: parsed.data.stockQty,
      },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The catalogue database is not reachable right now.' }
    throw error
  }

  revalidatePath('/supplier/listings')
  redirect('/supplier/listings')
}

export async function deleteListingAction(
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  let session: Session & { organizationId: string }
  try {
    session = await assertCanManageOwnListings()
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Missing listing id.' }

  try {
    const existing = await prisma.listing.findUnique({ where: { id } })
    if (!existing || existing.organizationId !== session.organizationId) {
      return { error: 'Listing not found.' }
    }

    await prisma.listing.delete({ where: { id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return { error: 'Cannot delete: this listing is referenced by an existing cart, order, or review.' }
    }
    if (isDatabaseUnreachable(error)) return { error: 'The catalogue database is not reachable right now.' }
    throw error
  }

  revalidatePath('/supplier/listings')
  redirect('/supplier/listings')
}
