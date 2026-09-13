'use server'

import { prisma } from './prisma'
import { getSession } from './auth'
import { isDatabaseUnreachable } from './db-errors'

export type ContactRevealResult = { name?: string; email?: string; error?: string }

// Contact info is only ever handed to a signed-in caller, and only on
// request (a click) — never embedded in the page's initial HTML, so a
// signed-out visitor (or a scraper) can't harvest emails just by loading
// the marketplace.
export async function revealListingContactAction(listingId: string): Promise<ContactRevealResult> {
  const session = await getSession()
  if (!session) return { error: 'Sign in to see contact details.' }

  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        seller: { select: { name: true, email: true } },
        organization: {
          select: {
            name: true,
            members: {
              where: { role: 'OWNER' },
              take: 1,
              select: { user: { select: { name: true, email: true } } },
            },
          },
        },
      },
    })
    if (!listing) return { error: 'Listing not found.' }

    if (listing.seller) {
      return { name: listing.seller.name, email: listing.seller.email }
    }

    if (listing.organization) {
      const owner = listing.organization.members[0]?.user
      if (!owner) return { error: 'This business has no contact on file yet.' }
      return { name: `${listing.organization.name} (${owner.name})`, email: owner.email }
    }

    return { error: 'This listing has no seller on file.' }
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: "Contact details aren't reachable right now." }
    throw error
  }
}
