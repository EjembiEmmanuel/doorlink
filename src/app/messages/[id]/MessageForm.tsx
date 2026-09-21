'use client'

import { useActionState, useEffect, useRef } from 'react'
import { sendMessageAction, type MessageActionState } from '../actions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'

const initial: MessageActionState = {}

export function MessageForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, isPending] = useActionState(sendMessageAction, initial)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the box once the message is actually away, not optimistically —
  // if the send failed, the text a person typed is still there to retry.
  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label htmlFor="body" className="sr-only">
        Your message
      </label>
      <Textarea id="body" name="body" rows={3} required maxLength={4000} placeholder="Write a message…" />

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send'}
        </Button>
        <p className="text-micro text-zinc-deep">
          Phone numbers and email addresses are not shared here. Doorlink exchanges those when a job is agreed.
        </p>
      </div>
    </form>
  )
}
