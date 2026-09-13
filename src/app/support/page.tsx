import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Table, Th, Td } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'

export const metadata: Metadata = {
  title: 'Support',
}

const STATUS_TONE = {
  OPEN: 'signal',
  PENDING: 'caution',
  RESOLVED: 'good',
  CLOSED: 'neutral',
} as const

export default async function SupportPage() {
  const session = await getSession()
  // The layout above already guarantees a session.
  const userId = session!.userId
  const isSupportAdmin = can(session!.role, 'support:write:any')

  let tickets
  try {
    tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Support" reason="Can't load your tickets right now." />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-graphite">Your tickets</h2>
        <div className="flex items-center gap-4">
          {isSupportAdmin && (
            <Link href="/support/queue" className="text-sm font-medium text-signal hover:text-signal-hover">
              All tickets (admin)
            </Link>
          )}
          <Link
            href="/support/new"
            className="inline-flex h-9 items-center justify-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
          >
            New ticket
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <EmptyState title="No tickets yet" description="Open one if you need help with anything." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <Td>{ticket.subject}</Td>
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
