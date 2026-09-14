import type { Metadata } from 'next'
import Link from 'next/link'
import { MIN_QUERY_LENGTH, search, SEARCH_KIND_LABELS, SEARCH_KINDS, type SearchKind } from '@/lib/search'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search Doorlink for manuals, products, technicians, services and parts.',
  alternates: { canonical: '/search' },
}

type PageProps = { searchParams: Promise<{ q?: string; kind?: string }> }

function parseKind(raw: string | undefined): SearchKind | null {
  return SEARCH_KINDS.includes(raw as SearchKind) ? (raw as SearchKind) : null
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const kind = parseKind(params.kind)

  const results = await search(query, kind ? [kind] : SEARCH_KINDS)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-graphite">Search</h1>
        <p className="mt-1 text-graphite-soft">
          Manuals, products, technicians, services and parts — all at once.
        </p>
      </header>

      {/* A plain GET form, so a search is a URL you can share, bookmark
          and go back to, and so it works before JavaScript loads. */}
      <form action="/search" className="flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Search Doorlink
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          autoFocus
          placeholder="Model code, manufacturer, a phrase from a manual, a suburb…"
          className="h-11 min-w-0 flex-1 rounded border border-line bg-paper px-3 text-sm text-graphite placeholder:text-zinc focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
        />
        {kind && <input type="hidden" name="kind" value={kind} />}
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded bg-signal px-5 text-sm font-medium text-paper transition-colors hover:bg-signal-hover"
        >
          Search
        </button>
      </form>

      {query.length >= MIN_QUERY_LENGTH && (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter by type">
          <FilterChip href={`/search?q=${encodeURIComponent(query)}`} active={!kind}>
            Everything
          </FilterChip>
          {SEARCH_KINDS.map((candidate) => (
            <FilterChip
              key={candidate}
              href={`/search?q=${encodeURIComponent(query)}&kind=${candidate}`}
              active={kind === candidate}
            >
              {SEARCH_KIND_LABELS[candidate]}
            </FilterChip>
          ))}
        </nav>
      )}

      <div className="mt-8">
        {!results.available ? (
          <NotConnected feature="Search" reason="Can't reach the database right now." />
        ) : query.length === 0 ? (
          <EmptyState
            title="What are you looking for?"
            description="Try a model code, a manufacturer, a phrase you remember from a manual, or the suburb you need someone in."
          />
        ) : query.length < MIN_QUERY_LENGTH ? (
          <EmptyState
            title="Keep typing"
            description={`Searches need at least ${MIN_QUERY_LENGTH} characters — one letter matches most of the catalogue, which isn't a result, it's a list.`}
          />
        ) : results.groups.length === 0 ? (
          <EmptyState
            title={`Nothing matches “${query}”`}
            description="Doorlink searches the text inside manuals as well as their titles, so if this is a term from a document we don't have it yet."
          />
        ) : (
          <div className="flex flex-col gap-10">
            {results.groups.map((group) => (
              <section key={group.kind}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">
                    {SEARCH_KIND_LABELS[group.kind]}
                  </h2>
                  {/* Says when there is more than is shown, rather than
                      silently truncating. */}
                  {group.total > group.hits.length && (
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&kind=${group.kind}`}
                      className="text-sm font-medium text-signal hover:text-signal-hover"
                    >
                      All {group.total} →
                    </Link>
                  )}
                </div>

                <ul className="flex flex-col gap-2">
                  {group.hits.map((hit) => (
                    <li key={`${hit.kind}-${hit.id}`}>
                      <Link
                        href={hit.href}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-paper px-4 py-3 transition-colors hover:border-signal"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-graphite">{hit.title}</span>
                          {hit.subtitle && (
                            <span className="mt-0.5 block text-micro text-zinc-deep">{hit.subtitle}</span>
                          )}
                        </span>
                        {hit.tag && (
                          <Badge tone="neutral">
                            <span className="font-code">{hit.tag}</span>
                          </Badge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-signal bg-signal-tint font-medium text-signal'
          : 'border-line bg-paper text-graphite hover:border-zinc'
      )}
    >
      {children}
    </Link>
  )
}
