'use client'

import { useActionState } from 'react'
import { createLeadAction, type RequestFormState } from './actions'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

interface ModelOption {
  id: string
  label: string
}

const initialState: RequestFormState = {}

export function RequestForm({ models }: { models: ModelOption[] }) {
  const [state, formAction, isPending] = useActionState(createLeadAction, initialState)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" required />
      </Field>

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required />
      </Field>

      <Field label="Phone" htmlFor="phone" hint="Optional.">
        <Input id="phone" name="phone" type="tel" />
      </Field>

      <Field label="Which product needs work?" htmlFor="modelId" hint="Optional — skip if you're not sure.">
        <Select id="modelId" name="modelId" defaultValue="">
          <option value="">Not sure / not listed</option>
          {models.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="What do you need help with?" htmlFor="message">
        <Textarea id="message" name="message" required rows={5} />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Send request'}
      </Button>
    </form>
  )
}
