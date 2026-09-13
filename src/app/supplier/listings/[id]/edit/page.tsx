import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { ListingForm } from '../../ListingForm'

type PageProps = { params: Promise<{ id: string }> }

export default async function EditListingPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  // The layout above already guarantees this.
  const organizationId = session!.organizationId!

  let listing, models
  try {
    ;[listing, models] = await Promise.all([
      prisma.listing.findUnique({ where: { id } }),
      prisma.model.findMany({ orderBy: { name: 'asc' }, include: { manufacturer: { select: { name: true } } } }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load this listing right now." />
  }

  // Not found rather than a permission error — a supplier shouldn't be
  // able to tell the difference between "doesn't exist" and "isn't yours".
  if (!listing || listing.organizationId !== organizationId) notFound()

  const options = models.map((model) => ({
    id: model.id,
    label: `${model.modelCode} — ${model.manufacturer.name} ${model.name}`,
  }))

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">Edit listing</h2>
      <ListingForm listing={listing} models={options} />
    </div>
  )
}
