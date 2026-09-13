import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListingForm } from '../ListingForm'

export default async function NewListingPage() {
  let models
  try {
    models = await prisma.model.findMany({
      orderBy: { name: 'asc' },
      include: { manufacturer: { select: { name: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load models right now." />
  }

  if (models.length === 0) {
    return <EmptyState title="No models in the catalogue yet" description="A listing needs a model to attach to." />
  }

  const options = models.map((model) => ({
    id: model.id,
    label: `${model.modelCode} — ${model.manufacturer.name} ${model.name}`,
  }))

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">New listing</h2>
      <ListingForm models={options} />
    </div>
  )
}
