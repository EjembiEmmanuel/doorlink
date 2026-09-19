import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { CompatibilityForm } from '../CompatibilityForm'

export default async function NewCompatibilityPage() {
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

  if (models.length < 2) {
    return (
      <EmptyState
        title="Add at least two models first"
        description="A compatibility link needs two different models to connect."
      />
    )
  }

  const options = models.map((model) => ({
    id: model.id,
    label: `${model.modelCode} | ${model.manufacturer.name} ${model.name}`,
  }))

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">New compatibility link</h2>
      <CompatibilityForm models={options} />
    </div>
  )
}
