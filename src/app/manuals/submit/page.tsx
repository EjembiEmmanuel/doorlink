import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { SubmitManualForm } from './SubmitManualForm'

export const metadata: Metadata = {
  title: 'Submit a manual',
  description: 'Suggest a manual for the Doorlink library and provide its source for review.',
  alternates: { canonical: '/manuals/submit' },
}

export default async function SubmitManualPage() {
  const session = await getSession()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <nav className="mb-6 text-sm text-zinc-deep">
        <Link href="/manuals" className="font-medium text-signal hover:text-signal-hover">
          User manuals
        </Link>
        <span className="px-2">/</span>
        <span>Submit a manual</span>
      </nav>

      <header className="max-w-2xl">
        <p className="text-micro font-semibold uppercase tracking-[0.18em] text-signal">Community contribution</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-graphite">Submit a user manual</h1>
        <p className="mt-3 text-graphite-soft">
          Know a manual that is missing from the library? Send us the document details and a public source
          link. We check the provenance before publishing anything.
        </p>
      </header>

      {session ? (
        <div className="mt-8 rounded-lg border border-line bg-paper p-5 shadow-sm sm:p-6">
          <SubmitManualForm />
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-line bg-rail p-6">
          <h2 className="text-lg font-semibold text-graphite">Sign in to submit a manual</h2>
          <p className="mt-2 max-w-prose text-sm text-graphite-soft">
            Contributions are attached to your account so the review team can follow up if a source needs
            clarification.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center rounded bg-signal px-5 text-sm font-medium text-paper hover:bg-signal-hover"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded border border-line bg-paper px-5 text-sm font-medium text-graphite hover:bg-paper"
            >
              Create an account
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}