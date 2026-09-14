import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Table, Th, Td } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { AdminDeleteButton } from '@/components/admin/AdminDeleteButton'
import { deleteCategoryAction } from './actions'

export default async function CategoriesPage() {
  let categories
  try {
    categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { parent: { select: { name: true } }, _count: { select: { models: true, children: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load categories right now." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-graphite">Categories</h2>
        <Link
          href="/admin/categories/new"
          className="inline-flex h-9 items-center justify-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
        >
          New category
        </Link>
      </div>

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Create the first one to start building the catalogue." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Parent</Th>
              <Th>Models</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <Td>{category.name}</Td>
                <Td className="font-code">{category.slug}</Td>
                <Td>{category.parent?.name ?? '—'}</Td>
                <Td>{category._count.models}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/categories/${category.id}/edit`}
                      className="text-sm font-medium text-signal hover:text-signal-hover"
                    >
                      Edit
                    </Link>
                    <AdminDeleteButton id={category.id} action={deleteCategoryAction} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
