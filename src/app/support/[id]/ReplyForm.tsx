'use client'

import { useActionState, useEffect, useRef } from 'react'
import { addMessageAction, type SupportFormState } from '../actions'
import { Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const initialState: SupportFormState = {}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, isPending] = useActionState(addMessageAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !isPending && !state.error) {
      formRef.current?.reset()
    }
    wasPending.current = isPending
  }, [isPending, state.error])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea name="body" required placeholder="Write a reply…" rows={4} />
      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        {isPending ? 'Sending…' : 'Send reply'}
      </Button>
    </form>
  )
}
