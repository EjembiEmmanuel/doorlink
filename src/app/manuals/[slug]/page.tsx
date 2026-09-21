import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { manualAccess } from '@/lib/manual-access'
import { formatFileSize } from '@/lib/manuals'
import { toJsonLd } from '@/lib/json-ld'
import { NotConnected } from '@/components/ui/NotConnected'
import { Badge } from '@/components/ui/Badge'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { SpecList } from '@/components/ui/Table'
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_ORIGIN_LABELS,
  DOCUMENT_ORIGIN_TONE,
} from '@/lib/labels'

type PageProps = { params: Promise<{ slug: string }> }

function loadDocument(slug: string) {
  return prisma.document.findUnique({
    where: { slug },
    include: {
      manufacturer: { select: { name: true, slug: true } },
      category: { select: { name: true, slug: true } },
      model: { select: { id: true, name: true, modelCode: true, slug: true, summary: true } },
      supersedes: { select: { slug: true, title: true, revision: true } },
      supersededBy: { select: { slug: true, title: true, revision: true } },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const doc = await loadDocument(slug)
    if (!doc) return { title: 'Manual not found' }
    return {
      title: doc.title,
      description: doc.description ?? undefined,
      alternates: { canonical: `/manuals/${doc.slug}` },
    }
  } catch {
    return { title: 'Manual' }
  }
}

export default async function ManualDetailPage({ params }: PageProps) {
  const { slug } = await params

  let doc
  try {
    doc = await loadDocument(slug)
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="The manuals library" reason="Can't reach the document database right now." />
      </div>
    )
  }

  if (!doc || !doc.isPublished) notFound()

  // How this document can be opened: a copy Doorlink is entitled to
  // serve, or the publisher's own. Decided in one place so the page
  // never offers a download it has no right to hand out.
  const access = manualAccess(doc)
  const fileUrl = access.mode === 'hosted' ? access.url : null

  // Only the facts the document itself carries. Anything absent is left
  // out rather than filled with a plausible-looking default.
  const specs: Array<{ label: string; value: string }> = []
  if (doc.manufacturer) specs.push({ label: 'Manufacturer', value: doc.manufacturer.name })
  if (doc.model) specs.push({ label: 'Model', value: `${doc.model.modelCode} | ${doc.model.name}` })
  if (doc.category) specs.push({ label: 'Category', value: doc.category.name })
  specs.push({ label: 'Document type', value: DOCUMENT_KIND_LABELS[doc.kind] })
  if (doc.documentCode) specs.push({ label: 'Document code', value: doc.documentCode })
  if (doc.revision) specs.push({ label: 'Revision', value: doc.revision })
  if (doc.publisher) specs.push({ label: 'Published by', value: doc.publisher })
  specs.push({ label: 'Language', value: doc.language.toUpperCase() })
  if (doc.pageCount) specs.push({ label: 'Pages', value: String(doc.pageCount) })
  const size = formatFileSize(doc.fileSizeBytes)
  if (size) specs.push({ label: 'File size', value: size })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: doc.title,
    description: doc.description ?? undefined,
    inLanguage: doc.language,
    ...(doc.publisher ? { publisher: { '@type': 'Organization', name: doc.publisher } } : {}),
    ...(doc.model ? { about: { '@type': 'Product', name: doc.model.name, sku: doc.model.modelCode } } : {}),
  }

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />

      <nav className="mb-6 text-sm text-zinc-deep">
        <Link href="/manuals" className="font-medium text-signal hover:text-signal-hover">
          User manuals
        </Link>
        {doc.manufacturer && (
          <>
            {' / '}
            <Link
              href={`/manuals?manufacturer=${doc.manufacturer.slug}`}
              className="font-medium text-signal hover:text-signal-hover"
            >
              {doc.manufacturer.name}
            </Link>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{DOCUMENT_KIND_LABELS[doc.kind]}</Badge>
            <Badge tone={DOCUMENT_ORIGIN_TONE[doc.origin]}>{DOCUMENT_ORIGIN_LABELS[doc.origin]}</Badge>
            <SourceBadge source={doc.dataSource} />
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-graphite">{doc.title}</h1>
          {doc.description && <p className="mt-3 max-w-prose text-graphite-soft">{doc.description}</p>}

          {/* Provenance sits directly under the title, not buried in a
              footer — if a document is someone's write-up rather than the
              manufacturer's own file, that is the first thing a
              technician relying on it should see. */}
          {doc.provenanceNote && (
            <div className="mt-4 rounded-md border border-caution/30 bg-caution-tint p-4">
              <p className="text-micro font-semibold uppercase tracking-wide text-caution">
                Where this document came from
              </p>
              <p className="mt-1 text-sm text-graphite">{doc.provenanceNote}</p>
            </div>
          )}

          {doc.supersededBy && (
            <div className="mt-4 rounded-md border border-caution/30 bg-caution-tint p-4">
              <p className="text-micro font-semibold uppercase tracking-wide text-caution">
                A newer revision exists
              </p>
              <p className="mt-1 text-sm text-graphite">
                This is superseded by{' '}
                <Link
                  href={`/manuals/${doc.supersededBy.slug}`}
                  className="font-medium text-signal hover:text-signal-hover"
                >
                  {doc.supersededBy.revision ?? doc.supersededBy.title}
                </Link>
                .
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {access.mode === 'hosted' && (
              <>
                <a
                  href={access.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center rounded bg-signal px-5 text-sm font-medium text-paper transition-colors hover:bg-signal-hover"
                >
                  Open document
                </a>
                <a
                  href={access.url}
                  download
                  className="inline-flex h-11 items-center rounded border border-line px-5 text-sm font-medium text-graphite transition-colors hover:bg-rail"
                >
                  Download PDF
                </a>
              </>
            )}

            {/* The common case. Doorlink holds the record, the
                manufacturer holds the file, and the button says which
                is which rather than implying Doorlink is serving it. */}
            {access.mode === 'link' && (
              <div className="flex flex-col gap-1.5">
                <a
                  href={access.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center rounded bg-signal px-5 text-sm font-medium text-paper transition-colors hover:bg-signal-hover"
                >
                  Open at the source
                  <span aria-hidden="true"> &#8599;</span>
                </a>
                <p className="text-micro text-zinc-deep">
                  Opens {new URL(access.url).hostname}. Doorlink links to this document rather than
                  hosting a copy of it.
                </p>
              </div>
            )}

            {access.mode === 'restricted' && (
              <div className="rounded border border-caution/30 bg-caution-tint px-4 py-3 text-sm">
                <p className="font-medium text-caution">Behind a login or installer portal.</p>
                <p className="mt-1 text-graphite-soft">
                  This document exists but is not publicly reachable. Doorlink records where it lives
                  and does not attempt to get around the restriction.
                </p>
              </div>
            )}

            {access.mode === 'unavailable' && (
              <div className="rounded border border-line bg-rail px-4 py-3 text-sm">
                <p className="font-medium text-graphite">
                  {access.reason === 'link-broken'
                    ? 'The published link no longer resolves.'
                    : 'No source is recorded for this document yet.'}
                </p>
                <p className="mt-1 text-graphite-soft">
                  {access.reason === 'link-broken'
                    ? 'It is flagged for review rather than deleted \u2014 the document may have simply moved.'
                    : 'The record exists so the model is searchable; the document itself has not been located.'}
                </p>
              </div>
            )}
          </div>

          {fileUrl && (
            <div className="mt-6 overflow-hidden rounded-md border border-line">
              <object data={fileUrl} type="application/pdf" className="h-[70vh] w-full" aria-label={doc.title}>
                <div className="p-6 text-sm text-graphite-soft">
                  Your browser can&apos;t display PDFs inline.{' '}
                  <a href={fileUrl} className="font-medium text-signal hover:text-signal-hover">
                    Open the document
                  </a>{' '}
                  instead.
                </div>
              </object>
            </div>
          )}
        </div>

        <aside className="lg:w-72 lg:shrink-0">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">Details</h2>
          <SpecList items={specs} />

          {doc.model && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-deep">Product</h2>
              <Link
                href={`/model/${doc.model.id}`}
                className="block rounded-md border border-line p-4 transition-colors hover:border-signal"
              >
                <p className="font-medium text-graphite">{doc.model.name}</p>
                <p className="mt-1 font-code text-sm text-zinc-deep">{doc.model.modelCode}</p>
                {doc.model.summary && (
                  <p className="mt-2 text-sm text-graphite-soft">{doc.model.summary}</p>
                )}
              </Link>
            </div>
          )}

          {doc.supersedes && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
                Revision history
              </h2>
              <p className="text-sm text-graphite-soft">
                Supersedes{' '}
                <Link
                  href={`/manuals/${doc.supersedes.slug}`}
                  className="font-medium text-signal hover:text-signal-hover"
                >
                  {doc.supersedes.revision ?? doc.supersedes.title}
                </Link>
                .
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
