import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { RequestForm } from './RequestForm'

export const metadata: Metadata = {
  title: 'Request a technician',
}

export default async function RequestTechnicianPage() {
  let models
  try {
    models = await prisma.model.findMany({
      orderBy: { name: 'asc' },
      include: { manufacturer: { select: { name: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load the model list right now." />
  }

  const options = models.map((model) => ({
    id: model.id,
    label: `${model.modelCode} — ${model.manufacturer.name} ${model.name}`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-graphite">Request a technician</h1>
        <p className="mt-1 max-w-lg text-sm text-zinc-deep">
          Tell us what's wrong and a technician will reach out by email. No account needed.
        </p>
      </div>
      <RequestForm models={options} />
    </div>
  )
}
