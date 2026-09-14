'use client'

import { useActionState, useState } from 'react'
import { acceptQuoteAction, cancelRequestAction, type RequestActionState } from '../actions'
import { Button } from '@/components/ui/Button'

const initialState: RequestActionState = {}

// Hiring is the one irreversible step in the flow — it declines every
// other quote and creates a job — so it asks once before committing
// rather than firing on a single stray click.
export function AcceptQuoteButton({ quoteId, amountLabel }: { quoteId: string; amountLabel: string }) {
  const [state, formAction, isPending] = useActionState(acceptQuoteAction, initialState)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button type="button" onClick={() => setConfirming(true)}>
          Accept this quote
        </Button>
        {state.error && <p className="text-micro text-bad">{state.error}</p>}
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="quoteId" value={quoteId} />
      <p className="text-sm text-graphite">
        Hire this technician for {amountLabel}? Every other quote on this request will be declined.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Confirming…' : 'Yes, hire them'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
    </form>
  )
}

export function CancelRequestButton({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(cancelRequestAction, initialState)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          Cancel this request
        </Button>
        {state.error && <p className="text-micro text-bad">{state.error}</p>}
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-sm text-graphite">Cancel the request and decline any open quotes?</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Cancelling…' : 'Yes, cancel'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
          Keep it open
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
    </form>
  )
}
