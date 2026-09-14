import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { LEAD_STATUS_TONE } from '@/lib/labels'
import { RespondButton } from './RespondButton'
import { UpdateLeadStatus } from './UpdateLeadStatus'

export const metadata: Metadata = {
  title: 'Requests',
}

export default async function LeadsPage() {
  const session = await getSession()
  if (!session || !(can(session.role, 'lead:write:own') || can(session.role, 'lead:write:any'))) {
    redirect('/')
  }

  let leads
  try {
    leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { model: { select: { name: true, modelCode: true } } },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Requests" reason="Can't load requests right now." />
  }

  const canSeeAll = can(session.role, 'lead:write:any')
  const mine = leads.filter(
    (lead) =>
      (lead.assignedOrgId && lead.assignedOrgId === session.organizationId) ||
      (lead.assignedUserId && lead.assignedUserId === session.userId)
  )
  const open = leads.filter((lead) => !lead.assignedOrgId && !lead.assignedUserId)
  const others = canSeeAll ? leads.filter((lead) => !mine.includes(lead) && !open.includes(lead)) : []

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-graphite">Requests</h1>
        <p className="mt-1 text-sm text-zinc-deep">
          "Request a technician" submissions. Respond to claim one — contact details only show up
          once you have.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">Open requests</h2>
        {open.length === 0 ? (
          <EmptyState title="No open requests" description="Everything's been claimed." />
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((lead) => (
              <div key={lead.id} className="rounded-md border border-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-graphite">{lead.message}</p>
                    {lead.model && (
                      <p className="mt-1 text-sm text-zinc-deep">
                        {lead.model.modelCode} — {lead.model.name}
                      </p>
                    )}
                  </div>
                  <Badge tone={LEAD_STATUS_TONE[lead.status]}>{lead.status}</Badge>
                </div>
                <div className="mt-3">
                  <RespondButton leadId={lead.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">Your requests</h2>
        {mine.length === 0 ? (
          <EmptyState title="You haven't claimed any requests yet" />
        ) : (
          <div className="flex flex-col gap-3">
            {mine.map((lead) => (
              <div key={lead.id} className="rounded-md border border-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-graphite">{lead.message}</p>
                    {lead.model && (
                      <p className="mt-1 text-sm text-zinc-deep">
                        {lead.model.modelCode} — {lead.model.name}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-graphite">
                      Contact {lead.name}:{' '}
                      <a href={`mailto:${lead.email}`} className="font-medium text-signal hover:text-signal-hover">
                        {lead.email}
                      </a>
                      {lead.phone && <span> · {lead.phone}</span>}
                    </p>
                  </div>
                  <Badge tone={LEAD_STATUS_TONE[lead.status]}>{lead.status}</Badge>
                </div>
                <div className="mt-3">
                  <UpdateLeadStatus leadId={lead.id} status={lead.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canSeeAll && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">
            Claimed by others
          </h2>
          {others.length === 0 ? (
            <EmptyState title="Nothing claimed by anyone else" />
          ) : (
            <div className="flex flex-col gap-3">
              {others.map((lead) => (
                <div key={lead.id} className="rounded-md border border-line p-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-graphite">{lead.message}</p>
                    <Badge tone={LEAD_STATUS_TONE[lead.status]}>{lead.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
