import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Table, Th, Td } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { AdminDeleteButton } from '@/components/admin/AdminDeleteButton'
import { deleteCompatibilityAction } from './actions'

const CONFIDENCE_TONE = {
  CONFIRMED: 'good',
  LIKELY: 'signal',
  UNCONFIRMED: 'caution',
} as const

const KIND_LABELS: Record<string, string> = {
  REPLACEMENT_PART: 'Replacement part',
  ACCESSORY: 'Accessory',
  REMOTE_PAIR: 'Remote pair',
  CONTROL_BOARD_MATCH: 'Control board match',
  MOTOR_MATCH: 'Motor match',
}

export default async function CompatibilityPage() {
  let links
  try {
    links = await prisma.compatibility.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        fromModel: { select: { name: true, modelCode: true } },
        toModel: { select: { name: true, modelCode: true } },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load compatibility links right now." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-graphite">Compatibility links</h2>
        <Link
          href="/admin/compatibility/new"
          className="inline-flex h-9 items-center justify-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
        >
          New link
        </Link>
      </div>

      {links.length === 0 ? (
        <EmptyState title="No compatibility links yet" description="Create the first one to connect two models." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Kind</Th>
              <Th>Confidence</Th>
              <Th>Source</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id}>
                <Td className="font-code">{link.fromModel.modelCode}</Td>
                <Td className="font-code">{link.toModel.modelCode}</Td>
                <Td>{KIND_LABELS[link.kind]}</Td>
                <Td>
                  <Badge tone={CONFIDENCE_TONE[link.confidence]}>{link.confidence}</Badge>
                </Td>
                <Td>
                  <SourceBadge source={link.dataSource} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/compatibility/${link.id}/edit`}
                      className="text-sm font-medium text-signal hover:text-signal-hover"
                    >
                      Edit
                    </Link>
                    <AdminDeleteButton id={link.id} action={deleteCompatibilityAction} />
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
