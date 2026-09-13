import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Request sent',
}

export default function RequestTechnicianThanksPage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-graphite">Request sent</h1>
      <p className="max-w-lg text-sm text-zinc-deep">
        A technician will reach out by email or phone. There's no account to track this from — if
        you'd like a record of it, sign in next time before sending a request.
      </p>
      <Link href="/" className="text-sm font-medium text-signal hover:text-signal-hover">
        Back to home
      </Link>
    </div>
  )
}
