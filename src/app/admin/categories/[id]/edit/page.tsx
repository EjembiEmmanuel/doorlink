import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { CategoryForm } from '../../CategoryForm'

type PageProps = { params: Promise<{ id: string }> }

export default async function EditCategoryPage({ params }: PageProps) {
  const { id } = await params

  let category
  let parentOptions
  try {
    ;[category, parentOptions] = await Promise.all([
      prisma.category.findUnique({ where: { id } }),
      prisma.category.findMany({
        where: { NOT: { id } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load this category right now." />
  }

  if (!category) notFound()

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">Edit {category.name}</h2>
      <CategoryForm category={category} parentOptions={parentOptions} />
    </div>
  )
}
