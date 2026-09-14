'use client'

import { useActionState } from 'react'
import { createLeadAction, type RequestFormState } from './actions'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

interface Option {
  id: string
  label: string
  description?: string | null
}

const initialState: RequestFormState = {}

const URGENCY_OPTIONS = [
  { value: 'EMERGENCY', label: 'Emergency — today if possible' },
  { value: 'URGENT', label: 'Urgent — within a few days' },
  { value: 'STANDARD', label: 'Standard — within a couple of weeks' },
  { value: 'FLEXIBLE', label: 'Flexible — no rush' },
]

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

export function RequestForm({
  serviceCategories,
  models,
  signedIn,
  prefill,
}: {
  serviceCategories: Option[]
  models: Option[]
  signedIn: boolean
  /** Arrives when someone came here from a saved door configuration. */
  prefill?: { title: string; message: string }
}) {
  const [state, formAction, isPending] = useActionState(createLeadAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          What needs doing
        </legend>

        <Field label="What kind of work is it?" htmlFor="serviceCategoryId">
          <Select id="serviceCategoryId" name="serviceCategoryId" defaultValue="">
            <option value="">Not sure / not listed</option>
            {serviceCategories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Job title" htmlFor="title" hint="A short summary, e.g. “Roller door won’t close fully”.">
          <Input id="title" name="title" required maxLength={120} defaultValue={prefill?.title ?? ''} />
        </Field>

        <Field
          label="Describe the problem"
          htmlFor="message"
          hint="The more detail, the more accurate the quotes. Include what happens, any noises, and when it started."
        >
          <Textarea
            id="message"
            name="message"
            required
            rows={6}
            minLength={20}
            defaultValue={prefill?.message ?? ''}
          />
        </Field>

        <Field
          label="Which product is it?"
          htmlFor="modelId"
          hint="Optional — skip if you don’t know. You can find it later with Find your part."
        >
          <Select id="modelId" name="modelId" defaultValue="">
            <option value="">Not sure / not listed</option>
            {models.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          Where and when
        </legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Suburb" htmlFor="suburb">
            <Input id="suburb" name="suburb" autoComplete="address-level2" />
          </Field>
          <Field label="State" htmlFor="state">
            <Select id="state" name="state" defaultValue="">
              <option value="">—</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Postcode" htmlFor="postcode">
            <Input id="postcode" name="postcode" inputMode="numeric" maxLength={4} autoComplete="postal-code" />
          </Field>
        </div>

        <Field label="How soon do you need it?" htmlFor="urgency">
          <Select id="urgency" name="urgency" defaultValue="STANDARD">
            {URGENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Preferred times"
          htmlFor="preferredTiming"
          hint="Optional — e.g. “weekday mornings” or “after 4pm”."
        >
          <Input id="preferredTiming" name="preferredTiming" />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          Budget <span className="font-normal normal-case text-zinc-deep">(optional)</span>
        </legend>
        <p className="text-sm text-zinc-deep">
          A rough range helps technicians decide whether to quote. Leave both blank if you’d rather just
          see what comes back.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From (AUD)" htmlFor="budgetMin">
            <Input id="budgetMin" name="budgetMin" type="number" min="0" step="1" inputMode="decimal" />
          </Field>
          <Field label="To (AUD)" htmlFor="budgetMax">
            <Input id="budgetMax" name="budgetMax" type="number" min="0" step="1" inputMode="decimal" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          How to reach you
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" required autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
        </div>

        <Field label="Phone" htmlFor="phone" hint="Optional, but technicians usually quote faster with one.">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>

        {!signedIn && (
          <p className="rounded-md border border-line bg-rail p-3 text-sm text-graphite-soft">
            You can post without an account. Signing in first lets you track quotes and compare
            technicians from your dashboard.
          </p>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? 'Posting…' : 'Post job'}
        </Button>
        <p className="text-sm text-zinc-deep">It’s free to post. You only pay if you hire someone.</p>
      </div>
    </form>
  )
}
