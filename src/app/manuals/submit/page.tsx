import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SubmissionStatus } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { canUpload } from '@/lib/storage'
import { isConnected } from '@/lib/integrations'
import { NotConnected } from '@/components/ui/NotConnected'
import { Badge } from '@/components/ui/Badge'
import { SUBMISSION_LABELS, SUBMISSION_TONE } from '@/lib/labels'
import { SubmitForm } from './SubmitForm'

export const metadata: Metadata = {
  title: 'Add a manual',
  description: 'Upload a manual Doorlink does not have yet.',
}

export default async function SubmitManualPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in?next=/manuals/submit')
  if (!can(session.role, 'manual:submit')) redirect('/manuals')

  let categories
  let mine
  try {
    ;[categories, mine] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
      prisma.manualSubmission.findMany({
        where: { submittedById: session.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          reference: true,
          productName: true,
          manufacturerName: true,
          status: true,
          reviewNote: true,
          createdAt: true,
        },
      }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="Add a manual" reason="Can't reach the database right now." />
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10">
      <header>
        <Link href="/manuals/finder" className="text-sm text-graphite-soft underline">
          Back to the manual finder
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-graphite">Add a manual</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite-soft">
          If Doorlink doesn&apos;t have the manual you need and you have a copy, send it in. Nothing you
          upload goes straight into the library — it is checked automatically, then read by a person before
          anyone else can find it.
        </p>
      </header>

      {!canUpload() ? (
        <NotConnected
          feature="Manual uploads"
          reason="File storage is not configured on this deployment, so uploads cannot be saved. Nothing here will accept a file until it is."
        />
      ) : (
        <>
          {!isConnected('ai') ? (
            <p className="rounded border border-line bg-rail px-3 py-2 text-sm text-graphite-soft">
              No automated checking is configured right now, so every upload goes straight to a person to
              read. It may take a little longer.
            </p>
          ) : null}
          <SubmitForm categories={categories} />
        </>
      )}

      {mine.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-graphite">What you&apos;ve sent</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {mine.map((submission) => (
              <li key={submission.id} className="rounded border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-graphite">
                    {submission.manufacturerName} {submission.productName}
                  </span>
                  <Badge tone={SUBMISSION_TONE[submission.status]}>
                    {SUBMISSION_LABELS[submission.status]}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-graphite-soft">{submission.reference}</p>
                {/* Shown to the submitter for exactly one status: when a
                    reviewer has asked them for something, the ask is the
                    only thing that moves it forward. */}
                {submission.status === SubmissionStatus.INFO_REQUESTED && submission.reviewNote ? (
                  <p className="mt-2 max-w-prose text-sm text-graphite">{submission.reviewNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
