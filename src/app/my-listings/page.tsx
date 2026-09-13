import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { Table, Th, Td } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { AdminDeleteButton } from '@/components/admin/AdminDeleteButton'
import { deleteListingAction } from './actions'

const STATUS_TONE = {
  DRAFT: 'neutral',
  ACTIVE: 'good',
  PAUSED: 'caution',
  SOLD_OUT: 'caution',
  ARCHIVED: 'neutral',
} as const

export default async function MyListingsPage() {
  const session = await getSession()
  // The layout above already guarantees a session before this renders.
  const userId = session!.userId
  const organizationId = session!.organizationId

  let listings
  try {
    listings = await prisma.listing.findMany({
      where: organizationId ? { organizationId } : { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { model: { select: { name: true, modelCode: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load your listings right now." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-graphite">Your listings</h2>
        <Link
          href="/my-listings/new"
          className="inline-flex h-9 items-center justify-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
        >
          New listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <EmptyState title="No listings yet" description="Create your first listing to appear on the marketplace." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Model</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id}>
                <Td>{listing.title}</Td>
                <Td className="font-code">{listing.model.modelCode}</Td>
                <Td>{formatMoney(listing.priceCents, listing.currency)}</Td>
                <Td>{listing.stockQty}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[listing.status]}>{listing.status}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/my-listings/${listing.id}/edit`}
                      className="text-sm font-medium text-signal hover:text-signal-hover"
                    >
                      Edit
                    </Link>
                    <AdminDeleteButton id={listing.id} action={deleteListingAction} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
