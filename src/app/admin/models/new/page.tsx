import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModelForm } from '../ModelForm'

export default async function NewModelPage() {
  let manufacturers, categories, productLines
  try {
    ;[manufacturers, categories, productLines] = await Promise.all([
      prisma.manufacturer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.productLine.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, manufacturerId: true },
      }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load the form data right now." />
  }

  if (manufacturers.length === 0 || categories.length === 0) {
    return (
      <EmptyState
        title="Add a manufacturer and a category first"
        description="A model needs both to exist before it can be created."
      />
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">New model</h2>
      <ModelForm manufacturers={manufacturers} categories={categories} productLines={productLines} />
    </div>
  )
}
