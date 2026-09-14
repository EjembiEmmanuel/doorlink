import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LeadStatus, QuoteStatus } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { currentCommissionBps } from '@/lib/commission-settings'
import { QUOTABLE_LEAD_STATUSES } from '@/lib/marketplace'
import { formatBudgetRange, formatMoney } from '@/lib/money'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONE, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE, URGENCY_LABELS, URGENCY_TONE } from '@/lib/labels'
import { QuoteForm } from './QuoteForm'

export const metadata: Metadata = {
  title: 'Job board',
}

export default async function JobBoardPage() {
  const session = await getSession()
  if (!session || !can(session.role, 'marketplace:quote')) redirect('/')

  let openLeads
  let myQuotes
  let commissionRateBps
  try {
    ;[openLeads, myQuotes, commissionRateBps] = await Promise.all([
      prisma.lead.findMany({
        where: {
          status: { in: QUOTABLE_LEAD_STATUSES },
          // A technician never sees their own request on the board they
          // quote from.
          NOT: { customerId: session.userId },
        },
        orderBy: [{ urgency: 'asc' }, { createdAt: 'desc' }],
        include: {
          serviceCategory: { select: { name: true } },
          model: { select: { name: true, modelCode: true } },
          _count: { select: { quotes: true } },
          quotes: { where: { workerId: session.userId }, select: { id: true, amountCents: true, message: true, status: true } },
        },
        take: 50,
      }),
      prisma.quote.findMany({
        where: { workerId: session.userId },
        orderBy: { updatedAt: 'desc' },
        include: {
          lead: { select: { id: true, reference: true, title: true, message: true, status: true, suburb: true, state: true } },
        },
        take: 50,
      }),
      currentCommissionBps(),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The job board" reason="Can't reach the database right now." />
  }

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-xl font-semibold text-graphite">Job board</h1>
        <p className="mt-1 max-w-prose text-sm text-zinc-deep">
          Open requests from customers. Send a quote to be considered — the customer chooses who to
          hire, and only then do you exchange contact details.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          Open jobs ({openLeads.length})
        </h2>

        {openLeads.length === 0 ? (
          <EmptyState
            title="No open jobs right now"
            description="New customer requests will appear here as they're posted."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {openLeads.map((lead) => {
              const mine = lead.quotes[0]
              const budget = formatBudgetRange(lead.budgetMinCents, lead.budgetMaxCents)
              const location = [lead.suburb, lead.state, lead.postcode].filter(Boolean).join(' ')

              return (
                <li key={lead.id} className="rounded-md border border-line bg-paper p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-graphite">{lead.title ?? lead.message.slice(0, 80)}</p>
                      <p className="mt-1 font-code text-micro text-zinc-deep">{lead.reference}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge tone={URGENCY_TONE[lead.urgency]}>{URGENCY_LABELS[lead.urgency]}</Badge>
                      <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-graphite-soft">{lead.message}</p>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-deep">
                    {lead.serviceCategory && (
                      <div>
                        <dt className="inline font-medium text-graphite-soft">Service: </dt>
                        <dd className="inline">{lead.serviceCategory.name}</dd>
                      </div>
                    )}
                    {location && (
                      <div>
                        <dt className="inline font-medium text-graphite-soft">Location: </dt>
                        <dd className="inline">{location}</dd>
                      </div>
                    )}
                    {budget && (
                      <div>
                        <dt className="inline font-medium text-graphite-soft">Budget: </dt>
                        <dd className="inline">{budget}</dd>
                      </div>
                    )}
                    {lead.preferredTiming && (
                      <div>
                        <dt className="inline font-medium text-graphite-soft">Prefers: </dt>
                        <dd className="inline">{lead.preferredTiming}</dd>
                      </div>
                    )}
                    {lead.model && (
                      <div>
                        <dt className="inline font-medium text-graphite-soft">Product: </dt>
                        <dd className="inline font-code">{lead.model.modelCode}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline font-medium text-graphite-soft">Quotes so far: </dt>
                      <dd className="inline">{lead._count.quotes}</dd>
                    </div>
                  </dl>

                  {/* Contact details are deliberately absent until the
                      customer accepts a quote — the board shows the work,
                      not the person. */}
                  <details className="mt-4 border-t border-line pt-4" open={Boolean(mine)}>
                    <summary className="cursor-pointer text-sm font-medium text-signal hover:text-signal-hover">
                      {mine ? `Your quote: ${formatMoney(mine.amountCents)} — edit` : 'Send a quote'}
                    </summary>
                    <div className="mt-4">
                      <QuoteForm
                        leadId={lead.id}
                        commissionRateBps={commissionRateBps}
                        existing={mine ? { amountCents: mine.amountCents, message: mine.message } : null}
                      />
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          Your quotes ({myQuotes.length})
        </h2>

        {myQuotes.length === 0 ? (
          <EmptyState title="You haven't quoted on anything yet" />
        ) : (
          <ul className="flex flex-col gap-3">
            {myQuotes.map((quote) => (
              <li key={quote.id} className="rounded-md border border-line bg-paper p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-graphite">
                      {quote.lead.title ?? quote.lead.message.slice(0, 80)}
                    </p>
                    <p className="mt-1 font-code text-micro text-zinc-deep">{quote.lead.reference}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-medium text-graphite">{formatMoney(quote.amountCents)}</span>
                    <Badge tone={QUOTE_STATUS_TONE[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
                  </div>
                </div>
                {quote.status === QuoteStatus.ACCEPTED && (
                  <p className="mt-2 text-sm text-good">
                    Accepted — this job is now in your jobs list.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
