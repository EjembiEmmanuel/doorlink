import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { Panel, PanelBody } from '@/components/ui/Panel'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'

export const metadata: Metadata = {
  title: 'Marketplace',
}

export default async function MarketplacePage() {
  let listings
  try {
    listings = await prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        model: { select: { id: true, name: true, modelCode: true } },
        organization: { select: { name: true } },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-12">
        <NotConnected feature="The marketplace" reason="Can't load listings right now." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-shell px-4 py-10">
      <h1 className="text-2xl font-semibold text-graphite">Marketplace</h1>
      <p className="mt-2 max-w-prose text-graphite-soft">
        Parts and accessories listed by suppliers. Every listing shows where it comes from.
      </p>

      {listings.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No active listings yet"
            description="Check back once suppliers have listed products for sale."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <Panel key={listing.id}>
              <PanelBody>
                <p className="font-code text-sm text-zinc-deep">{listing.model.modelCode}</p>
                <Link
                  href={`/model/${listing.model.id}`}
                  className="mt-1 block font-medium text-graphite hover:text-signal"
                >
                  {listing.title}
                </Link>
                <p className="mt-1 text-sm text-zinc-deep">Sold by {listing.organization.name}</p>
                <p className="mt-2 text-lg font-semibold text-graphite">
                  {formatMoney(listing.priceCents, listing.currency)}
                </p>
                <p className="mt-1 text-micro uppercase tracking-wide text-zinc-deep">
                  {listing.condition.toLowerCase()} · {listing.stockQty} in stock
                </p>
                <div className="mt-2">
                  <SourceBadge source={listing.dataSource} />
                </div>
              </PanelBody>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
