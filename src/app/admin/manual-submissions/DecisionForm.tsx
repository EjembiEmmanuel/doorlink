'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, Textarea } from '@/components/ui'
import { decide, type DecisionState } from './actions'

function Actions() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approve" disabled={pending}>
        Approve and publish
      </Button>
      <Button type="submit" name="decision" value="request-info" variant="secondary" disabled={pending}>
        Ask for more information
      </Button>
      <Button type="submit" name="decision" value="reject" variant="ghost" disabled={pending}>
        Reject
      </Button>
    </div>
  )
}

export function DecisionForm({ submissionId }: { submissionId: string }) {
  const [state, action] = useActionState<DecisionState, FormData>(decide, {})

  return (
    <form action={action} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      {state.error ? (
        <p role="alert" className="text-sm text-alert">
          {state.error}
        </p>
      ) : null}
      {state.notice ? <p className="text-sm text-signal">{state.notice}</p> : null}
      <label htmlFor={`note-${submissionId}`} className="text-sm font-medium text-graphite">
        Reason
      </label>
      <Textarea
        id={`note-${submissionId}`}
        name="note"
        required
        maxLength={2000}
        placeholder="What you checked and what you decided. Goes on the record, and to the submitter when you reject or ask for more."
      />
      <Actions />
    </form>
  )
}
