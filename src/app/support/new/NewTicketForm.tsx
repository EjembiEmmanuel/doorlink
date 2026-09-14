'use client'

import { useActionState } from 'react'
import { createTicketAction, type SupportFormState } from '../actions'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const initialState: SupportFormState = {}

export function NewTicketForm() {
  const [state, formAction, isPending] = useActionState(createTicketAction, initialState)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" required />
      </Field>
      <Field label="Message" htmlFor="body">
        <Textarea id="body" name="body" required rows={5} />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit ticket'}
      </Button>
    </form>
  )
}
