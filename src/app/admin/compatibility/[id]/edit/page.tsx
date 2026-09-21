import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { CompatibilityForm } from '../../CompatibilityForm'

type PageProps = { params: Promise<{ id: string }> }

export default async function EditCompatibilityPage({ params }: PageProps) {
  const { id } = await params

  let compatibility, models
  try {
    ;[compatibility, models] = await Promise.all([
      prisma.compatibility.findUnique({ where: { id } }),
      prisma.model.findMany({ orderBy: { name: 'asc' }, include: { manufacturer: { select: { name: true } } } }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load this link right now." />
  }

  if (!compatibility) notFound()

  const options = models.map((model) => ({
    id: model.id,
    label: `${model.modelCode} | ${model.manufacturer.name} ${model.name}`,
  }))

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">Edit compatibility link</h2>
      <CompatibilityForm compatibility={compatibility} models={options} />
    </div>
  )
}
