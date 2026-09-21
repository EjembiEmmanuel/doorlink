import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ManualSubmissionStatus } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { prisma } from '@/lib/prisma'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel'
import { DOCUMENT_KIND_LABELS } from '@/lib/labels'
import { MANUAL_SUBMISSION_STATUS_LABELS } from '@/lib/manual-submissions'
import { ReviewForm } from './ReviewForm'

export const metadata: Metadata = { title: 'Manual submissions' }

export default async function AdminManualSubmissionsPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  if (!can(session.role, 'admin:settings')) redirect('/admin/manuals')

  try {
    const [queue, counts] = await Promise.all([
      prisma.manualSubmission.findMany({
        where: {
          status: {
            in: [
              ManualSubmissionStatus.PENDING_REVIEW,
              ManualSubmissionStatus.AI_VERIFICATION,
              ManualSubmissionStatus.AWAITING_ADMIN_REVIEW,
              ManualSubmissionStatus.NEEDS_CHANGES,
            ],
          },
        },
        include: {
          user: { select: { name: true, email: true } },
          duplicateOf: { select: { slug: true, title: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.manualSubmission.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    const countFor = (status: ManualSubmissionStatus) => counts.find((row) => row.status === status)?._count ?? 0

    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-micro font-semibold uppercase tracking-wide text-signal">Admin review</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-graphite">Manual submissions</h1>
            <p className="mt-1 max-w-prose text-sm text-graphite-soft">
              Review provenance, duplicates, and sharing rights before creating a published library record.
              Automated checks flag issues but never approve a document.
            </p>
          </div>
          <Link href="/admin/manuals" className="text-sm font-medium text-signal hover:text-signal-hover">
            Manual library
          </Link>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <QueueStat label="Waiting" count={countFor(ManualSubmissionStatus.AWAITING_ADMIN_REVIEW)} />
          <QueueStat label="Needs changes" count={countFor(ManualSubmissionStatus.NEEDS_CHANGES)} />
          <QueueStat label="Published" count={countFor(ManualSubmissionStatus.APPROVED)} />
        </div>

        {queue.length === 0 ? (
          <EmptyState title="The review queue is clear" description="New community submissions will appear here." />
        ) : (
          <ul className="flex flex-col gap-4">
            {queue.map((submission) => (
              <li key={submission.id}>
                <Panel>
                  <PanelHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-medium text-graphite">{submission.title}</h2>
                        <p className="mt-1 text-sm text-zinc-deep">
                          {DOCUMENT_KIND_LABELS[submission.kind]} · by {submission.user.name} ({submission.user.email})
                        </p>
                      </div>
                      <Badge
                        tone={
                          submission.status === ManualSubmissionStatus.NEEDS_CHANGES
                            ? 'caution'
                            : submission.status === ManualSubmissionStatus.AWAITING_ADMIN_REVIEW
                              ? 'signal'
                              : 'neutral'
                        }
                      >
                        {MANUAL_SUBMISSION_STATUS_LABELS[submission.status]}
                      </Badge>
                    </div>
                  </PanelHeader>
                  <PanelBody>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <Detail label="Manufacturer" value={submission.manufacturer} />
                      <Detail label="Model or code" value={submission.modelCode} />
                      <Detail label="Version or revision" value={submission.version} />
                      <Detail label="Source" value={submission.sourceUrl ?? submission.originalFilename ?? 'Not supplied'} />
                      <Detail label="Automated result" value={`${submission.verificationResult} (${submission.verificationScore ?? 0}/100)`} />
                      <Detail label="Submitted" value={submission.createdAt.toLocaleString('en-AU')} />
                    </dl>
                    {submission.description && <p className="mt-4 whitespace-pre-wrap text-sm text-graphite-soft">{submission.description}</p>}
                    {submission.notes && (
                      <p className="mt-3 rounded bg-rail p-3 whitespace-pre-wrap text-sm text-graphite-soft">
                        Contributor notes: {submission.notes}
                      </p>
                    )}
                    {submission.verificationNotes && (
                      <p className="mt-3 rounded border border-caution/30 bg-caution-tint p-3 text-sm text-graphite">
                        Check notes: {submission.verificationNotes}
                      </p>
                    )}
                    {submission.duplicateOf && (
                      <p className="mt-3 text-sm text-caution">
                        Possible duplicate of{' '}
                        <Link href={`/manuals/${submission.duplicateOf.slug}`} className="font-medium hover:underline">
                          {submission.duplicateOf.title}
                        </Link>
                        .
                      </p>
                    )}
                    <div className="mt-5 border-t border-line pt-4">
                      {submission.sourceUrl && (
                        <a
                          href={submission.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-signal hover:text-signal-hover"
                        >
                          Open source <span aria-hidden="true">&#8599;</span>
                        </a>
                      )}
                      {submission.fileKey && (
                        <a
                          href={`/api/admin/manual-submissions/${submission.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4 text-sm font-medium text-signal hover:text-signal-hover"
                        >
                          Preview uploaded file <span aria-hidden="true">&#8599;</span>
                        </a>
                      )}
                      <ReviewForm submissionId={submission.id} />
                    </div>
                  </PanelBody>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Manual submissions" reason="Can't reach the review database right now." />
  }
}

function QueueStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <p className="text-micro uppercase tracking-wide text-zinc-deep">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-graphite">{count}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-micro uppercase tracking-wide text-zinc-deep">{label}</dt>
      <dd className="mt-0.5 truncate text-graphite">{value ?? 'Not supplied'}</dd>
    </div>
  )
}