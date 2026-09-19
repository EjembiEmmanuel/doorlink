'use client'

import { useActionState, useState } from 'react'
import { updateCompliancePriceAction, type SettingsFormState } from './actions'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/money'
import { COMPLIANCE_CURRENCY, MAX_COMPLIANCE_PRICE_CENTS } from '@/lib/compliance/pricing'

const initialState: SettingsFormState = {}

export function CompliancePriceForm({ currentCents }: { currentCents: number }) {
  const [state, formAction, isPending] = useActionState(updateCompliancePriceAction, initialState)
  const [dollars, setDollars] = useState((currentCents / 100).toFixed(2))

  const parsed = Number(dollars)
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed * 100 <= MAX_COMPLIANCE_PRICE_CENTS
  const previewCents = valid ? Math.round(parsed * 100) : null
  const changed = previewCents !== null && previewCents !== currentCents

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field
        label="Price"
        htmlFor="dollars"
        hint={`Currently ${formatMoney(currentCents, COMPLIANCE_CURRENCY)}. A one-off charge, not a subscription.`}
      >
        <Input
          id="dollars"
          name="dollars"
          type="number"
          min="0"
          step="0.01"
          value={dollars}
          onChange={(event) => setDollars(event.target.value)}
        />
      </Field>

      {changed && previewCents !== null && (
        <p className="text-sm text-graphite-soft">
          New buyers would pay{' '}
          <span className="font-medium text-graphite">{formatMoney(previewCents, COMPLIANCE_CURRENCY)}</span>.
          Anyone who has already bought the pack keeps the price they were charged.
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p role="status" className="text-sm text-good">
          Saved.
        </p>
      )}

      <div>
        <Button type="submit" disabled={isPending || !valid}>
          {isPending ? 'Saving…' : 'Save price'}
        </Button>
      </div>
    </form>
  )
}
