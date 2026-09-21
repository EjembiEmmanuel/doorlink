'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea, Select, Field } from '@/components/ui/Field'
import { decideManualSubmissionAction, type ManualReviewState } from './actions'

type Decision = 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES'
const initial: ManualReviewState = {}

export function ReviewForm({ submissionId }: { submissionId: string }) {
  const [state, formAction, isPending] = useActionState(decideManualSubmissionAction, initial)
  const [decision, setDecision] = useState<Decision | null>(null)

  if (!decision) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setDecision('APPROVE')}>
          Approve and publish
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setDecision('NEEDS_CHANGES')}>
          Request changes
        </Button>
        <Button type="button" size="sm" className="bg-bad text-paper hover:bg-bad/90" onClick={() => setDecision('REJECT')}>
          Reject
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="decision" value={decision} />
      <Field
        label={decision === 'APPROVE' ? 'Publishing note' : 'Reason'}
        htmlFor={`note-${submissionId}`}
        hint={decision === 'APPROVE' ? 'Optional for approval.' : 'Required so the contributor knows what to do next.'}
      >
        <Textarea id={`note-${submissionId}`} name="note" rows={3} required={decision !== 'APPROVE'} maxLength={2000} />
      </Field>
      <Field
        label="Hosting rights"
        htmlFor={`rights-${submissionId}`}
        hint="Link only is the safe default. Choose a hosted copy only when the permission is clear."
      >
        <Select id={`rights-${submissionId}`} name="rights" defaultValue="LINK_ONLY">
          <option value="LINK_ONLY">Link to source only</option>
          <option value="REDISTRIBUTABLE">Contributor permits redistribution</option>
          <option value="UNCLEAR">Rights unclear — do not publish</option>
        </Select>
      </Field>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Saved.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save decision'}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setDecision(null)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}