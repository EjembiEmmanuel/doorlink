'use client'

import { useActionState } from 'react'
import { submitQuoteAction, type QuoteFormState } from './actions'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { calculateSplit, formatCommissionRate } from '@/lib/commission'
import { formatMoney } from '@/lib/money'

const initialState: QuoteFormState = {}

export function QuoteForm({
  leadId,
  commissionRateBps,
  existing,
}: {
  leadId: string
  commissionRateBps: number
  existing?: { amountCents: number; message: string } | null
}) {
  const [state, formAction, isPending] = useActionState(submitQuoteAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="leadId" value={leadId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your quote (AUD)" htmlFor={`amount-${leadId}`}>
          <Input
            id={`amount-${leadId}`}
            name="amount"
            type="number"
            // step is the cent, not the dollar: `step="1"` would have the
            // browser silently reject $480.50 with no visible message.
            min="1"
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={existing ? existing.amountCents / 100 : ''}
          />
        </Field>
        <Field
          label="Estimated time on site"
          htmlFor={`duration-${leadId}`}
          hint="Optional. Minutes, in blocks of 15."
        >
          <Input
            id={`duration-${leadId}`}
            name="estimatedDurationMinutes"
            type="number"
            // min has to sit on the step grid. With min="1" the browser
            // reads valid values as 1, 16, 31, 46… so a technician typing
            // a perfectly normal "90" had the form refuse to submit
            // without saying why.
            min="15"
            step="15"
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field
        label="What your quote covers"
        htmlFor={`message-${leadId}`}
        hint="Parts, labour, callout, anything excluded."
      >
        <Textarea
          id={`message-${leadId}`}
          name="message"
          rows={4}
          required
          minLength={10}
          defaultValue={existing?.message ?? ''}
        />
      </Field>

      <Field label="Earliest you could attend" htmlFor={`available-${leadId}`} hint="Optional.">
        <Input id={`available-${leadId}`} name="availableFrom" type="date" />
      </Field>

      <CommissionPreview commissionRateBps={commissionRateBps} amountCents={existing?.amountCents} />

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-good">Quote sent to the customer.</p>}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : existing ? 'Update quote' : 'Send quote'}
        </Button>
      </div>
    </form>
  )
}

// Shows the split on the technician's current quote so the platform fee
// is visible before they commit, not discovered afterwards. Only rendered
// once there is an amount to split — an invented example figure would be
// worse than showing nothing.
function CommissionPreview({
  commissionRateBps,
  amountCents,
}: {
  commissionRateBps: number
  amountCents?: number
}) {
  if (!amountCents || amountCents <= 0) {
    return (
      <p className="rounded-md border border-line bg-rail p-3 text-sm text-graphite-soft">
        Doorlink&apos;s commission is {formatCommissionRate(commissionRateBps)} of the job value, taken
        from the amount you quote.
      </p>
    )
  }

  const split = calculateSplit(amountCents, commissionRateBps)
  return (
    <dl className="rounded-md border border-line bg-rail p-3 text-sm">
      <div className="flex justify-between">
        <dt className="text-graphite-soft">Customer pays</dt>
        <dd className="font-medium text-graphite">{formatMoney(split.grossCents)}</dd>
      </div>
      <div className="mt-1 flex justify-between">
        <dt className="text-graphite-soft">
          Doorlink commission ({formatCommissionRate(split.commissionRateBps)})
        </dt>
        <dd className="text-graphite">−{formatMoney(split.commissionCents)}</dd>
      </div>
      <div className="mt-1 flex justify-between border-t border-line pt-1">
        <dt className="font-medium text-graphite">You receive</dt>
        <dd className="font-medium text-graphite">{formatMoney(split.workerPayoutCents)}</dd>
      </div>
    </dl>
  )
}
