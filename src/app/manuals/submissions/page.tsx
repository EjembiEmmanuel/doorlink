import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { prisma } from '@/lib/prisma'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { DOCUMENT_KIND_LABELS } from '@/lib/labels'
import { MANUAL_SUBMISSION_STATUS_LABELS } from '@/lib/manual-submissions'
import type { ManualSubmissionStatus } from '@prisma/client'

export const metadata: Metadata = {
  title: 'My manual submissions',
}

const STATUS_TONE: Record<ManualSubmissionStatus, 'neutral' | 'signal' | 'caution' | 'good' | 'bad'> = {
  PENDING_REVIEW: 'neutral',
  AI_VERIFICATION: 'signal',
  AWAITING_ADMIN_REVIEW: 'caution',
  NEEDS_CHANGES: 'caution',
  APPROVED: 'good',
  REJECTED: 'bad',
}

export default async function ManualSubmissionsPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  try {
    const submissions = await prisma.manualSubmission.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        title: true,
        kind: true,
        status: true,
        verificationResult: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.18em] text-signal">Contributions</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-graphite">My manual submissions</h1>
            <p className="mt-3 text-graphite-soft">
              Track each document from submission through review. Nothing is public until an administrator
              approves it.
            </p>
          </div>
          <Link
            href="/manuals/submit"
            className="inline-flex h-11 items-center rounded bg-signal px-4 text-sm font-medium text-paper hover:bg-signal-hover"
          >
            Submit another
          </Link>
        </div>

        <div className="mt-8">
          {submissions.length === 0 ? (
            <EmptyState
              title="No submissions yet"
              description="If you know a manual that belongs in the library, you can send it for review."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {submissions.map((submission) => (
                <li key={submission.id}>
                  <Link
                    href={`/manuals/submissions/${submission.id}`}
                    className="block rounded-md border border-line bg-paper p-5 transition-colors hover:border-signal"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-graphite">{submission.title}</p>
                        <p className="mt-1 text-sm text-zinc-deep">
                          {DOCUMENT_KIND_LABELS[submission.kind]} · submitted{' '}
                          {submission.createdAt.toLocaleDateString('en-AU')}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[submission.status]}>
                        {MANUAL_SUBMISSION_STATUS_LABELS[submission.status]}
                      </Badge>
                    </div>
                    {submission.status === 'APPROVED' && (
                      <p className="mt-3 text-sm font-medium text-signal">View the published manual</p>
                    )}
                    {submission.status === 'NEEDS_CHANGES' && (
                      <p className="mt-3 text-sm text-caution">Open this submission to see what is needed.</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="Your manual submissions" reason="Can't reach the submission database right now." />
      </div>
    )
  }
}