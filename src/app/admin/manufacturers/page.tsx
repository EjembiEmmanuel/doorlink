import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Table, Th, Td } from '@/components/ui/Table'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { AdminDeleteButton } from '@/components/admin/AdminDeleteButton'
import { deleteManufacturerAction } from './actions'

export default async function ManufacturersPage() {
  let manufacturers
  try {
    manufacturers = await prisma.manufacturer.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { models: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load manufacturers right now." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-graphite">Manufacturers</h2>
        <Link
          href="/admin/manufacturers/new"
          className="inline-flex h-9 items-center justify-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
        >
          New manufacturer
        </Link>
      </div>

      {manufacturers.length === 0 ? (
        <EmptyState
          title="No manufacturers yet"
          description="Create the first one to start building the catalogue."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Source</Th>
              <Th>Models</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {manufacturers.map((manufacturer) => (
              <tr key={manufacturer.id}>
                <Td>{manufacturer.name}</Td>
                <Td className="font-code">{manufacturer.slug}</Td>
                <Td>
                  <SourceBadge source={manufacturer.dataSource} />
                </Td>
                <Td>{manufacturer._count.models}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/manufacturers/${manufacturer.id}/edit`}
                      className="text-sm font-medium text-signal hover:text-signal-hover"
                    >
                      Edit
                    </Link>
                    <AdminDeleteButton id={manufacturer.id} action={deleteManufacturerAction} />
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
