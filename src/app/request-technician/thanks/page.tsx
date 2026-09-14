import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Job posted',
}

type SearchParams = Promise<{ ref?: string }>

export default async function RequestTechnicianThanksPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { ref } = await searchParams

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-graphite">Your job is posted</h1>

      {ref && (
        <div className="mt-5 rounded-md border border-line bg-rail p-4">
          <p className="text-micro font-semibold uppercase tracking-wide text-zinc-deep">
            Your reference
          </p>
          <p className="mt-1 font-code text-lg text-graphite">{ref}</p>
          <p className="mt-2 text-sm text-graphite-soft">
            Keep this — it identifies your job if you need to get in touch.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3 text-graphite-soft">
        <p>
          Technicians covering your area can now see the job and send you a quote. You&apos;ll get an
          email as quotes come in.
        </p>
        <p className="rounded-md border border-caution/30 bg-caution-tint p-3 text-sm text-graphite">
          Email notifications aren&apos;t connected in this build yet, so nothing will actually be sent
          — check back here for quotes in the meantime.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/my-requests"
          className="inline-flex h-11 items-center rounded bg-signal px-5 text-sm font-medium text-paper transition-colors hover:bg-signal-hover"
        >
          Track your job
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded border border-line px-5 text-sm font-medium text-graphite transition-colors hover:bg-rail"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
