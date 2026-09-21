import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { JobStatus, TransactionStatus } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { formatCommissionRate } from '@/lib/commission'
import { currentCommissionBps } from '@/lib/commission-settings'
import { ACTIVE_JOB_STATUSES, QUOTABLE_LEAD_STATUSES } from '@/lib/marketplace'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Panel, PanelBody } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { JOB_STATUS_LABELS, JOB_STATUS_TONE, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from '@/lib/labels'

export const metadata: Metadata = { title: 'Marketplace' }

export default async function AdminMarketplacePage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  if (!can(session.role, 'lead:write:any')) redirect('/admin')

  let data
  try {
    const [
      openLeads,
      activeJobs,
      completedJobs,
      disputedJobs,
      commissionBps,
      completedTotals,
      pendingTotals,
      recentJobs,
      recentLeads,
    ] = await Promise.all([
      prisma.lead.count({ where: { status: { in: QUOTABLE_LEAD_STATUSES } } }),
      prisma.job.count({ where: { status: { in: ACTIVE_JOB_STATUSES } } }),
      prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { status: JobStatus.DISPUTED } }),
      currentCommissionBps(),
      // Commission on completed work, whether or not it has been
      // collected — nothing here claims the money has moved.
      prisma.transaction.aggregate({
        where: { job: { status: JobStatus.COMPLETED } },
        _sum: {
          grossCents: true,
          commissionCents: true,
          workerPayoutCents: true,
        },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { status: TransactionStatus.PENDING },
        _sum: { grossCents: true, commissionCents: true },
        _count: true,
      }),
      prisma.job.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          lead: { select: { title: true } },
          customer: { select: { name: true } },
          worker: {
            select: {
              name: true,
              technicianProfile: { select: { businessName: true } },
            },
          },
          transactions: {
            select: { commissionCents: true, currency: true },
            take: 1,
          },
        },
      }),
      prisma.lead.findMany({
        where: { status: { in: QUOTABLE_LEAD_STATUSES } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { _count: { select: { quotes: true } } },
      }),
    ])
    data = {
      openLeads,
      activeJobs,
      completedJobs,
      disputedJobs,
      commissionBps,
      completedTotals,
      pendingTotals,
      recentJobs,
      recentLeads,
    }
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Marketplace admin" reason="Can't reach the database right now." />
  }

  const stats = [
    { label: 'Open requests', value: String(data.openLeads) },
    { label: 'Active jobs', value: String(data.activeJobs) },
    { label: 'Completed jobs', value: String(data.completedJobs) },
    { label: 'Disputed', value: String(data.disputedJobs) },
  ]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold text-graphite">Marketplace</h2>
        <p className="mt-1 max-w-prose text-sm text-graphite-soft">
          Commission is currently {formatCommissionRate(data.commissionBps)}.{' '}
          <Link href="/admin/settings" className="font-medium text-signal hover:text-signal-hover">
            Change the rate
          </Link>
          .
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Panel key={stat.label}>
              <PanelBody>
                <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-graphite">{stat.value}</p>
              </PanelBody>
            </Panel>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-graphite">Money</h2>
        <p className="mt-1 max-w-prose text-sm text-graphite-soft">
          These are the splits Doorlink has <em>recorded</em>, not money it has collected. No payment provider
          is connected, so nothing below has been charged, held, or paid out. Customers and technicians are
          settling directly.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Panel>
            <PanelBody>
              <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">
                On completed jobs ({data.completedTotals._count})
              </p>
              <dl className="mt-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-graphite-soft">Job value</dt>
                  <dd className="text-graphite">{formatMoney(data.completedTotals._sum.grossCents ?? 0)}</dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="font-medium text-graphite">Doorlink commission</dt>
                  <dd className="font-medium text-graphite">
                    {formatMoney(data.completedTotals._sum.commissionCents ?? 0)}
                  </dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-graphite-soft">Technician share</dt>
                  <dd className="text-graphite">
                    {formatMoney(data.completedTotals._sum.workerPayoutCents ?? 0)}
                  </dd>
                </div>
              </dl>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelBody>
              <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">
                Awaiting payment ({data.pendingTotals._count})
              </p>
              <dl className="mt-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-graphite-soft">Job value</dt>
                  <dd className="text-graphite">{formatMoney(data.pendingTotals._sum.grossCents ?? 0)}</dd>
                </div>
                <div className="mt-1 flex justify-between">
                  <dt className="text-graphite-soft">Commission if collected</dt>
                  <dd className="text-graphite">{formatMoney(data.pendingTotals._sum.commissionCents ?? 0)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-micro text-zinc-deep">
                Every transaction sits at Pending until a real payment provider says otherwise.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-graphite">Recent jobs</h2>
        <div className="mt-4">
          {data.recentJobs.length === 0 ? (
            <EmptyState title="No jobs yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-paper px-4 py-3 text-sm transition-colors hover:border-signal"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-graphite">
                        {job.lead?.title ?? job.description.slice(0, 60)}
                      </span>
                      <span className="ml-2 font-code text-micro text-zinc-deep">{job.reference}</span>
                      <span className="mt-0.5 block text-micro text-zinc-deep">
                        {job.customer?.name ?? 'Customer'} ·{' '}
                        {job.worker?.technicianProfile?.businessName ?? job.worker?.name ?? 'Unassigned'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {job.transactions[0] && (
                        <span className="text-graphite-soft">
                          fee {formatMoney(job.transactions[0].commissionCents, job.transactions[0].currency)}
                        </span>
                      )}
                      <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-graphite">Requests still open</h2>
        <div className="mt-4">
          {data.recentLeads.length === 0 ? (
            <EmptyState title="Nothing open" description="Every request has been hired or closed." />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-paper px-4 py-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-graphite">{lead.title ?? lead.message.slice(0, 60)}</span>
                    <span className="ml-2 font-code text-micro text-zinc-deep">{lead.reference}</span>
                    <span className="mt-0.5 block text-micro text-zinc-deep">
                      {[lead.suburb, lead.state, lead.postcode].filter(Boolean).join(' ') ||
                        'No location given'}{' '}
                      · {lead._count.quotes} {lead._count.quotes === 1 ? 'quote' : 'quotes'}
                    </span>
                  </span>
                  <Badge tone={LEAD_STATUS_TONE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
