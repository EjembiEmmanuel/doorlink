'use client'

import { useActionState } from 'react'
import { updateContactAction, type ContactActionState } from './actions'
import { Field, Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const initialState: ContactActionState = {}

export function ContactForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, formAction, isPending] = useActionState(updateContactAction, initialState)

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>

      <Field
        label="Phone"
        htmlFor="phone"
        hint="Shared with a technician only once you accept their quote, or with a buyer once they ask about one of your listings. Never shown on a public page."
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={phone ?? ''}
          placeholder="0412 345 678"
        />
      </Field>

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
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save contact details'}
        </Button>
      </div>
    </form>
  )
}
