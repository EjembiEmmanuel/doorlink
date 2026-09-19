import Link from 'next/link'
import { NotConnected } from '@/components/ui/NotConnected'
import type { PackGate } from './guard'

/**
 * The three ways a document can be withheld, each said plainly.
 *
 * `signed-out` is excluded: callers redirect on it rather than render,
 * so allowing it here would mean a case this component silently dropped.
 */
export type WithheldGate = Exclude<PackGate, { state: 'ok' } | { state: 'signed-out' }>

export function GateNotice({ gate }: { gate: WithheldGate }) {
  if (gate.state === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <NotConnected
          feature="This document"
          reason="Your purchase could not be confirmed because the database is unreachable. This is not a statement that you have not bought it."
        />
      </div>
    )
  }

  if (gate.state === 'not-purchased') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold text-graphite">You do not have this pack yet</h1>
        <Link href="/compliance" className="font-medium text-signal hover:text-signal-hover">
          See what is in it<span aria-hidden="true"> →</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold text-graphite">Add your details first</h1>
      <p className="max-w-prose text-graphite-soft">
        These are still missing, and each one leaves a blank where something official belongs:
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-graphite">
        {gate.missing.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <Link href="/compliance/details" className="font-medium text-signal hover:text-signal-hover">
        Fill them in<span aria-hidden="true"> →</span>
      </Link>
    </div>
  )
}
