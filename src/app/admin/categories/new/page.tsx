import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { CategoryForm } from '../CategoryForm'

export default async function NewCategoryPage() {
  let parentOptions
  try {
    parentOptions = await prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load categories right now." />
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">New category</h2>
      <CategoryForm parentOptions={parentOptions} />
    </div>
  )
}
