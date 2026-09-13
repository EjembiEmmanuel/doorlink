import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Table, Th, Td } from '@/components/ui/Table'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { AdminDeleteButton } from '@/components/admin/AdminDeleteButton'
import { deleteModelAction } from './actions'

export default async function ModelsPage() {
  let models
  try {
    models = await prisma.model.findMany({
      orderBy: { name: 'asc' },
      include: {
        manufacturer: { select: { name: true } },
        category: { select: { name: true } },
        productLine: { select: { name: true } },
        _count: { select: { listings: true } },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load models right now." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-graphite">Models</h2>
        <Link
          href="/admin/models/new"
          className="inline-flex h-9 items-center justify-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
        >
          New model
        </Link>
      </div>

      {models.length === 0 ? (
        <EmptyState title="No models yet" description="Create the first one to start building the catalogue." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th>Manufacturer</Th>
              <Th>Category</Th>
              <Th>Source</Th>
              <Th>Listings</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id}>
                <Td>{model.name}</Td>
                <Td className="font-code">{model.modelCode}</Td>
                <Td>{model.manufacturer.name}</Td>
                <Td>
                  {model.category.name}
                  {model.productLine ? ` · ${model.productLine.name}` : ''}
                </Td>
                <Td>
                  <SourceBadge source={model.dataSource} />
                </Td>
                <Td>{model._count.listings}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/model/${model.id}`}
                      className="text-sm font-medium text-zinc-deep hover:text-signal"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/models/${model.id}/edit`}
                      className="text-sm font-medium text-signal hover:text-signal-hover"
                    >
                      Edit
                    </Link>
                    <AdminDeleteButton id={model.id} action={deleteModelAction} />
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
