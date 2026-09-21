import Link from 'next/link'
import { DocumentOrigin, VerificationState } from '@prisma/client'
import { Badge } from '@/components/ui/Badge'
import { DOCUMENT_KIND_LABELS, DOCUMENT_ORIGIN_LABELS } from '@/lib/labels'
import { manualAccess, isConfirmedOfficial } from '@/lib/manual-access'
import { MATCH_REASON_LABELS, type MatchReason } from '@/lib/manuals/ranking'
import type { FinderDocument } from '@/lib/manuals/finder'

// One result.
//
// The whole point of this card is that a reader can tell, without
// clicking, three things a manual library usually blurs together: who
// published it, whether anyone has confirmed the link works, and
// whether Doorlink is serving the file or sending you elsewhere.

function VerificationBadge({ state }: { state: VerificationState }) {
  switch (state) {
    case VerificationState.REACHABLE:
      return <Badge tone="good">Link checked</Badge>
    case VerificationState.REDIRECTED:
      return <Badge tone="good">Link checked — moved</Badge>
    case VerificationState.BROKEN:
      return <Badge tone="bad">Link broken</Badge>
    case VerificationState.RESTRICTED:
      return <Badge tone="caution">Login required</Badge>
    default:
      // The honest default, and the most common one today. "Nobody has
      // checked" is a different statement from "this is broken", and
      // collapsing them would either overstate or understate the record.
      return <Badge tone="neutral">Not yet checked</Badge>
  }
}

export function DocumentCard({
  doc,
  reason,
  confident,
}: {
  doc: FinderDocument
  reason?: MatchReason
  /** False when this is a suggestion rather than a definite model match. */
  confident?: boolean
}) {
  const access = manualAccess(doc)
  const official = isConfirmedOfficial(doc)

  return (
    <li className="rounded-md border border-line bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-micro font-medium uppercase tracking-wide text-zinc-deep">
              {DOCUMENT_KIND_LABELS[doc.kind]}
            </span>
            {doc.model && (
              <span className="font-code text-micro text-graphite">{doc.model.modelCode}</span>
            )}
            {confident === false && <Badge tone="caution">Possible match</Badge>}
          </div>

          <h3 className="mt-1 font-medium text-graphite">
            <Link href={`/manuals/${doc.slug}`} className="hover:text-signal">
              {doc.title}
            </Link>
          </h3>

          <p className="mt-0.5 text-sm text-graphite-soft">
            {doc.manufacturer?.name}
            {doc.model ? ` · ${doc.model.name}` : ''}
            {doc.region !== 'UNKNOWN' ? ` · ${doc.region}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/* Only claimed when the origin is the manufacturer AND the
              link has actually been checked. An official-looking domain
              on an unchecked record earns no badge. */}
          {official ? (
            <Badge tone="good">Official</Badge>
          ) : doc.origin === DocumentOrigin.MANUFACTURER_ORIGINAL ? (
            <Badge tone="neutral">Manufacturer source</Badge>
          ) : (
            <Badge tone="caution">{DOCUMENT_ORIGIN_LABELS[doc.origin]}</Badge>
          )}
          <VerificationBadge state={doc.verification} />
        </div>
      </div>

      {doc.publisher && doc.origin !== DocumentOrigin.MANUFACTURER_ORIGINAL && (
        <p className="mt-2 text-micro text-zinc-deep">Hosted by {doc.publisher}, not the manufacturer.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {access.mode === 'link' && (
          <a
            href={access.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded border border-line px-3 text-sm font-medium text-graphite hover:border-signal hover:text-signal"
          >
            Open at {new URL(access.url).hostname}
            <span aria-hidden="true"> ↗</span>
          </a>
        )}
        {access.mode === 'hosted' && (
          <a
            href={access.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded bg-signal px-3 text-sm font-medium text-paper hover:bg-signal-hover"
          >
            Open document
          </a>
        )}
        {access.mode === 'restricted' && (
          <span className="text-sm text-caution">Behind a login — recorded, not bypassed.</span>
        )}
        {access.mode === 'unavailable' && (
          <span className="text-sm text-zinc-deep">
            {access.reason === 'link-broken'
              ? 'The link no longer resolves. Flagged for review.'
              : 'No source recorded yet.'}
          </span>
        )}

        {doc.altSources.length > 0 && (
          <span className="text-micro text-zinc-deep">
            {doc.altSources.length} other source{doc.altSources.length === 1 ? '' : 's'} on record
          </span>
        )}

        {reason && (
          <span className="ml-auto text-micro text-zinc">{MATCH_REASON_LABELS[reason]}</span>
        )}
      </div>
    </li>
  )
}
