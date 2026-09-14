import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { RequestForm } from './RequestForm'

export const metadata: Metadata = {
  title: 'Post a job',
  description:
    'Describe the work, get quotes from door and gate technicians in your area, and choose who to hire.',
  alternates: { canonical: '/request-technician' },
}

export default async function RequestTechnicianPage() {
  const session = await getSession()

  let serviceCategories
  let models
  try {
    ;[serviceCategories, models] = await Promise.all([
      prisma.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, description: true },
      }),
      prisma.model.findMany({
        orderBy: { name: 'asc' },
        include: { manufacturer: { select: { name: true } } },
      }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="Posting a job" reason="Can't reach the database right now." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-graphite sm:text-3xl">Post a job</h1>
        <p className="mt-2 max-w-prose text-graphite-soft">
          Describe what needs doing. Technicians in your area can quote on it, and you choose who to
          hire — nobody gets your phone number until you do.
        </p>
      </header>

      <RequestForm
        signedIn={Boolean(session)}
        serviceCategories={serviceCategories.map((c) => ({
          id: c.id,
          label: c.name,
          description: c.description,
        }))}
        models={models.map((model) => ({
          id: model.id,
          label: `${model.modelCode} — ${model.manufacturer.name} ${model.name}`,
        }))}
      />
    </div>
  )
}
