import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { Badge } from '@/components/ui/Badge'
import { ReplyForm } from './ReplyForm'
import { UpdateTicketControls } from './UpdateTicketControls'

type PageProps = { params: Promise<{ id: string }> }

export const metadata: Metadata = {
  title: 'Support ticket',
}

const STATUS_TONE = {
  OPEN: 'signal',
  PENDING: 'caution',
  RESOLVED: 'good',
  CLOSED: 'neutral',
} as const

export default async function SupportTicketPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/sign-in')
  const isSupportAdmin = can(session.role, 'support:write:any')

  let ticket
  try {
    ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { name: true } } } },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Support" reason="Can't load this ticket right now." />
  }

  // Not found rather than a permission error — a user shouldn't be able
  // to tell the difference between "doesn't exist" and "isn't yours".
  if (!ticket || (ticket.userId !== session.userId && !isSupportAdmin)) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-semibold text-graphite">{ticket.subject}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status}</Badge>
            <Badge tone="neutral">{ticket.priority}</Badge>
          </div>
        </div>
        {isSupportAdmin && (
          <UpdateTicketControls ticketId={ticket.id} status={ticket.status} priority={ticket.priority} />
        )}
      </div>

      <ul className="flex flex-col gap-4">
        {ticket.messages.map((message) => (
          <li key={message.id} className="rounded-md border border-line p-4">
            <p className="text-sm font-medium text-graphite">{message.sender.name}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-graphite-soft">{message.body}</p>
          </li>
        ))}
      </ul>

      <ReplyForm ticketId={ticket.id} />
    </div>
  )
}
