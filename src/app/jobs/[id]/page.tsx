import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { formatCommissionRate } from '@/lib/commission'
import { allowedTransitions, isReviewable, jobActorFor } from '@/lib/marketplace'
import { isConnected } from '@/lib/integrations'
import { NotConnected } from '@/components/ui/NotConnected'
import { Badge } from '@/components/ui/Badge'
import { SpecList } from '@/components/ui/Table'
import { JOB_STATUS_LABELS, JOB_STATUS_TONE, TRANSACTION_STATUS_LABELS } from '@/lib/labels'
import { JobTransitionControls, ReviewForm } from './JobControls'
import { OpenConversationButton } from '@/app/messages/OpenConversation'

export const metadata: Metadata = { title: 'Job' }

type PageProps = { params: Promise<{ id: string }> }

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/sign-in')

  let job
  try {
    job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        worker: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            technicianProfile: { select: { businessName: true, businessPhone: true, headline: true } },
          },
        },
        lead: {
          select: {
            id: true,
            title: true,
            reference: true,
            suburb: true,
            state: true,
            postcode: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        quote: { select: { amountCents: true, message: true, currency: true } },
        transactions: { orderBy: { createdAt: 'desc' } },
        workerReview: true,
        statusEvents: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { name: true } } },
        },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="This job" reason="Can't reach the database right now." />
      </div>
    )
  }

  if (!job) notFound()

  const actor = jobActorFor(job, session.userId, can(session.role, 'job:write:any'))
  if (!actor) notFound()

  const transitions = allowedTransitions(actor, job.status)
  const transaction = job.transactions[0]

  // The customer's contact details come from the request they filled in,
  // not their account record: the phone number they want a technician to
  // ring is the one they typed on this job, and an account created years
  // ago may have no phone on it at all.
  const counterparty =
    actor === 'customer'
      ? {
          name: job.worker?.technicianProfile?.businessName || job.worker?.name || null,
          email: job.worker?.email ?? null,
          phone: job.worker?.technicianProfile?.businessPhone || job.worker?.phone || null,
        }
      : {
          name: job.lead?.name || job.customer?.name || null,
          email: job.lead?.email || job.customer?.email || null,
          phone: job.lead?.phone || job.customer?.phone || null,
        }
  const counterpartyLabel = actor === 'customer' ? 'Technician' : 'Customer'

  const details: Array<{ label: string; value: string }> = [
    { label: 'Reference', value: job.reference },
    { label: 'Status', value: JOB_STATUS_LABELS[job.status] },
  ]
  if (job.agreedPriceCents !== null) {
    details.push({ label: 'Agreed price', value: formatMoney(job.agreedPriceCents, job.currency) })
  }
  if (job.scheduledAt) {
    details.push({
      label: 'Scheduled',
      value: job.scheduledAt.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }),
    })
  }
  if (job.completedAt) {
    details.push({ label: 'Completed', value: job.completedAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) })
  }
  const location = [job.lead?.suburb, job.lead?.state, job.lead?.postcode].filter(Boolean).join(' ')
  if (location) details.push({ label: 'Location', value: location })

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:py-14">
      <nav className="mb-6 text-sm">
        <Link href="/jobs" className="font-medium text-signal hover:text-signal-hover">
          Jobs
        </Link>
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-graphite">
              {job.lead?.title ?? 'Job'}
            </h1>
            <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-graphite-soft">{job.description}</p>

          {job.quote?.message && (
            <div className="mt-6 rounded-md border border-line bg-rail p-4">
              <p className="text-micro font-semibold uppercase tracking-wide text-zinc-deep">
                What the quote covers
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-graphite">{job.quote.message}</p>
            </div>
          )}

          {/* Contact details appear only once a job exists — that is the
              point at which both sides have agreed to work together. */}
          {counterparty.name && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
                {counterpartyLabel}
              </h2>
              <div className="rounded-md border border-line bg-paper p-4">
                <p className="font-medium text-graphite">{counterparty.name}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-graphite-soft">
                  {counterparty.email && (
                    <a
                      href={`mailto:${counterparty.email}`}
                      className="font-medium text-signal hover:text-signal-hover"
                    >
                      {counterparty.email}
                    </a>
                  )}
                  {counterparty.phone && (
                    <a
                      href={`tel:${counterparty.phone.replace(/\s+/g, '')}`}
                      className="font-medium text-signal hover:text-signal-hover"
                    >
                      {counterparty.phone}
                    </a>
                  )}
                </p>
                <div className="mt-3">
                  <OpenConversationButton
                    jobId={job.id}
                    label={`Message ${counterpartyLabel.toLowerCase()}`}
                  />
                </div>
              </div>
            </section>
          )}

          {transitions.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
                Update this job
              </h2>
              <JobTransitionControls jobId={job.id} transitions={transitions} />
            </section>
          )}

          {actor === 'customer' && isReviewable(job.status) && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
                {job.workerReview ? 'Your review' : 'Leave a review'}
              </h2>
              <ReviewForm
                jobId={job.id}
                existing={job.workerReview ? { rating: job.workerReview.rating, body: job.workerReview.body } : null}
              />
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">History</h2>
            <ol className="flex flex-col gap-2">
              {job.statusEvents.map((event) => (
                <li key={event.id} className="rounded-md border border-line bg-paper px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-graphite">
                      {event.fromStatus
                        ? `${JOB_STATUS_LABELS[event.fromStatus]} → ${JOB_STATUS_LABELS[event.toStatus]}`
                        : JOB_STATUS_LABELS[event.toStatus]}
                    </span>
                    <span className="text-micro text-zinc-deep">
                      {event.createdAt.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                      {event.actor && ` · ${event.actor.name}`}
                    </span>
                  </div>
                  {event.note && <p className="mt-1 text-graphite-soft">{event.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="lg:w-72 lg:shrink-0">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">Details</h2>
          <SpecList items={details} columns={1} />

          {transaction && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-deep">Payment</h2>
              <dl className="rounded-md border border-line bg-paper p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-graphite-soft">Customer pays</dt>
                  <dd className="font-medium text-graphite">
                    {formatMoney(transaction.grossCents, transaction.currency)}
                  </dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-graphite-soft">
                    Doorlink fee ({formatCommissionRate(transaction.commissionRateBps)})
                  </dt>
                  <dd className="text-graphite">
                    −{formatMoney(transaction.commissionCents, transaction.currency)}
                  </dd>
                </div>
                <div className="mt-1 flex justify-between border-t border-line pt-1">
                  <dt className="font-medium text-graphite">Technician receives</dt>
                  <dd className="font-medium text-graphite">
                    {formatMoney(transaction.workerPayoutCents, transaction.currency)}
                  </dd>
                </div>
                <div className="mt-3 flex justify-between border-t border-line pt-2">
                  <dt className="text-graphite-soft">Status</dt>
                  <dd className="text-graphite">{TRANSACTION_STATUS_LABELS[transaction.status]}</dd>
                </div>
              </dl>

              {!isConnected('payments') && (
                <div className="mt-3">
                  <NotConnected
                    feature="Taking payment"
                    reason="No payment provider is connected, so this records the agreed split only — no money moves through Doorlink yet. Settle directly with each other for now."
                  />
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
