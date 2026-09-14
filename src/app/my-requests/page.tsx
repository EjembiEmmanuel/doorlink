import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { QuoteStatus } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONE, URGENCY_LABELS, URGENCY_TONE } from '@/lib/labels'

export const metadata: Metadata = {
  title: 'Your requests',
}

export default async function MyRequestsPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  let leads
  try {
    leads = await prisma.lead.findMany({
      where: { customerId: session.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        serviceCategory: { select: { name: true } },
        _count: { select: { quotes: true } },
        quotes: { where: { status: QuoteStatus.PENDING }, select: { id: true } },
        jobs: { select: { id: true, reference: true } },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="Your requests" reason="Can't reach the database right now." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-graphite">Your requests</h1>
          <p className="mt-1 text-graphite-soft">Jobs you&apos;ve posted, and the quotes they attracted.</p>
        </div>
        <Link
          href="/request-technician"
          className="inline-flex h-11 shrink-0 items-center rounded bg-signal px-5 text-sm font-medium text-paper transition-colors hover:bg-signal-hover"
        >
          Post a job
        </Link>
      </header>

      {leads.length === 0 ? (
        <EmptyState
          title="You haven't posted a job yet"
          description="Describe what needs doing and technicians in your area can quote on it."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {leads.map((lead) => {
            const pending = lead.quotes.length
            const job = lead.jobs[0]
            return (
              <li key={lead.id}>
                <Link
                  href={`/my-requests/${lead.id}`}
                  className="block rounded-md border border-line bg-paper p-5 transition-colors hover:border-signal"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-graphite">
                        {lead.title ?? lead.message.slice(0, 80)}
                      </p>
                      <p className="mt-1 font-code text-micro text-zinc-deep">{lead.reference}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge tone={URGENCY_TONE[lead.urgency]}>{URGENCY_LABELS[lead.urgency]}</Badge>
                      <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-zinc-deep">
                    {lead.serviceCategory?.name ?? 'Uncategorised'}
                    {' · '}
                    {lead._count.quotes} {lead._count.quotes === 1 ? 'quote' : 'quotes'}
                    {pending > 0 && ` · ${pending} awaiting your decision`}
                    {job && ` · job ${job.reference}`}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
