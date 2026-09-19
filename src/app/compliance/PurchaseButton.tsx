'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { startCompliancePurchaseAction, type ComplianceActionState } from './actions'
import { Button } from '@/components/ui/Button'

const initial: ComplianceActionState = {}

export function PurchaseButton({ signedIn, canPay }: { signedIn: boolean; canPay: boolean }) {
  const [state, formAction, isPending] = useActionState(startCompliancePurchaseAction, initial)

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-2">
        <Link href="/sign-in" className="font-medium text-signal hover:text-signal-hover">
          Sign in to buy the pack<span aria-hidden="true"> →</span>
        </Link>
      </div>
    )
  }

  // The button is not dressed up as functional when it cannot complete.
  // Pressing it records interest and says plainly why nothing was
  // charged, which is the honest version of a checkout that has no
  // provider behind it.
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Working…' : canPay ? 'Buy the pack' : 'Register interest'}
        </Button>
      </div>

      {!canPay && !state.error && (
        <p className="max-w-prose text-sm text-zinc-deep">
          No payment provider is connected yet, so nothing can be charged. Pressing this records your interest
          at today&apos;s price.
        </p>
      )}

      {state.error && (
        <p role="alert" className="max-w-prose text-sm text-caution">
          {state.error}
        </p>
      )}
      {state.notice && !state.error && (
        <p role="status" className="text-sm text-good">
          {state.notice}
        </p>
      )}
    </form>
  )
}
