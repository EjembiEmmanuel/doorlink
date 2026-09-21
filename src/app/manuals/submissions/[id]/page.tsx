import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { prisma } from '@/lib/prisma'
import { NotConnected } from '@/components/ui/NotConnected'
import { Badge } from '@/components/ui/Badge'
import { DOCUMENT_KIND_LABELS } from '@/lib/labels'
import { MANUAL_SUBMISSION_STATUS_LABELS } from '@/lib/manual-submissions'
import type { ManualSubmissionStatus } from '@prisma/client'

type PageProps = { params: Promise<{ id: string }> }

const STATUS_TONE: Record<ManualSubmissionStatus, 'neutral' | 'signal' | 'caution' | 'good' | 'bad'> = {
  PENDING_REVIEW: 'neutral',
  AI_VERIFICATION: 'signal',
  AWAITING_ADMIN_REVIEW: 'caution',
  NEEDS_CHANGES: 'caution',
  APPROVED: 'good',
  REJECTED: 'bad',
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const submission = await prisma.manualSubmission.findUnique({
    where: { id },
    select: { title: true },
  })
  return { title: submission ? `Submission: ${submission.title}` : 'Manual submission' }
}

export default async function ManualSubmissionDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/sign-in')

  try {
    const submission = await prisma.manualSubmission.findFirst({
      where: { id, userId: session.userId },
      include: {
        duplicateOf: { select: { slug: true, title: true } },
        document: { select: { slug: true, title: true } },
      },
    })
    if (!submission) notFound()

    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <nav className="mb-6 text-sm text-zinc-deep">
          <Link href="/manuals/submissions" className="font-medium text-signal hover:text-signal-hover">
            My submissions
          </Link>
          <span className="px-2">/</span>
          <span>{submission.title}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.18em] text-signal">Manual contribution</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-graphite">{submission.title}</h1>
            <p className="mt-2 text-sm text-zinc-deep">{DOCUMENT_KIND_LABELS[submission.kind]}</p>
          </div>
          <Badge tone={STATUS_TONE[submission.status]}>{MANUAL_SUBMISSION_STATUS_LABELS[submission.status]}</Badge>
        </div>

        <section className="mt-8 rounded-md border border-line bg-paper p-5">
          <h2 className="font-medium text-graphite">Review status</h2>
          <p className="mt-2 text-sm text-graphite-soft">
            Submitted {submission.createdAt.toLocaleDateString('en-AU')}. The automated checks only inspect
            submission metadata; an administrator must still review the source and publishing rights.
          </p>
          {submission.verificationNotes && (
            <p className="mt-3 rounded bg-rail p-3 text-sm text-graphite">{submission.verificationNotes}</p>
          )}
          {submission.adminNote && (
            <div className="mt-4 rounded border border-caution/30 bg-caution-tint p-4">
              <p className="text-micro font-semibold uppercase tracking-wide text-caution">Reviewer note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-graphite">{submission.adminNote}</p>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-md border border-line bg-paper p-5">
          <h2 className="font-medium text-graphite">Submitted details</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Detail label="Manufacturer" value={submission.manufacturer} />
            <Detail label="Model or document code" value={submission.modelCode} />
            <Detail label="Product" value={submission.productName} />
            <Detail label="Product type" value={submission.productType} />
            <Detail label="Version or revision" value={submission.version} />
            <Detail label="Filename" value={submission.originalFilename} />
            <Detail label="File type" value={submission.mimeType} />
          </dl>
          {submission.description && <p className="mt-4 whitespace-pre-wrap text-sm text-graphite-soft">{submission.description}</p>}
          {submission.notes && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-micro font-semibold uppercase tracking-wide text-zinc-deep">Your notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-graphite-soft">{submission.notes}</p>
            </div>
          )}
          {submission.sourceUrl && (
            <a
              href={submission.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex text-sm font-medium text-signal hover:text-signal-hover"
            >
              Open submitted source <span aria-hidden="true">&nbsp;&#8599;</span>
            </a>
          )}
        </section>

        {submission.duplicateOf && (
          <div className="mt-5 rounded border border-caution/30 bg-caution-tint p-4 text-sm">
            <p className="font-medium text-caution">Possible duplicate</p>
            <p className="mt-1 text-graphite-soft">
              A matching library record was found:{' '}
              <Link href={`/manuals/${submission.duplicateOf.slug}`} className="font-medium text-signal hover:underline">
                {submission.duplicateOf.title}
              </Link>
              . An administrator will decide whether this contribution adds a new revision or should be declined.
            </p>
          </div>
        )}

        {submission.document && (
          <div className="mt-5 rounded border border-good/30 bg-good/10 p-4 text-sm text-graphite">
            Published as{' '}
            <Link href={`/manuals/${submission.document.slug}`} className="font-medium text-signal hover:underline">
              {submission.document.title}
            </Link>
            .
          </div>
        )}
      </div>
    )
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="Your manual submission" reason="Can't reach the submission database right now." />
      </div>
    )
  }
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-micro uppercase tracking-wide text-zinc-deep">{label}</dt>
      <dd className="mt-0.5 text-graphite">{value}</dd>
    </div>
  )
}