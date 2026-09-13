import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Table, Th, Td } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'

export const metadata: Metadata = {
  title: 'All support tickets',
}

const STATUS_TONE = {
  OPEN: 'signal',
  PENDING: 'caution',
  RESOLVED: 'good',
  CLOSED: 'neutral',
} as const

export default async function SupportQueuePage() {
  const session = await getSession()
  if (!session || !can(session.role, 'support:write:any')) redirect('/support')

  let tickets
  try {
    tickets = await prisma.supportTicket.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Support" reason="Can't load tickets right now." />
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-graphite">All tickets</h2>

      {tickets.length === 0 ? (
        <EmptyState title="No tickets yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>From</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <Td>{ticket.subject}</Td>
                <Td>{ticket.user.name}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>
                </Td>
                <Td>{ticket.priority}</Td>
                <Td>
                  <Link
                    href={`/support/${ticket.id}`}
                    className="text-sm font-medium text-signal hover:text-signal-hover"
                  >
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
