'use client'

import { useActionState, useState } from 'react'
import { decideVerificationAction, type VerificationActionState } from './actions'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'

const initial: VerificationActionState = {}

type Decision = 'IN_REVIEW' | 'VERIFIED' | 'REJECTED'

const DECISION_LABELS: Record<Decision, string> = {
  IN_REVIEW: 'Mark as in review',
  VERIFIED: 'Verify this business',
  REJECTED: 'Reject',
}

const DECISION_PROMPTS: Record<Decision, string> = {
  IN_REVIEW: 'Tells the technician someone has picked this up. Optional note.',
  VERIFIED:
    'Only after you have actually looked at the licence and insurance details and matched them to this account. The badge is a statement Doorlink makes to customers.',
  REJECTED: 'Say what was wrong. The technician sees this note and has to be able to act on it.',
}

export function DecisionForm({ profileId }: { profileId: string }) {
  const [state, formAction, isPending] = useActionState(decideVerificationAction, initial)
  const [decision, setDecision] = useState<Decision | null>(null)

  if (!decision) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DECISION_LABELS) as Decision[]).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={d === 'VERIFIED' ? 'primary' : 'secondary'}
              onClick={() => setDecision(d)}
            >
              {DECISION_LABELS[d]}
            </Button>
          ))}
        </div>
        {state.error && (
          <p role="alert" className="text-micro text-bad">
            {state.error}
          </p>
        )}
        {state.ok && <p className="text-micro text-good">Decision recorded.</p>}
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-line bg-rail p-4">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="decision" value={decision} />

      <p className="text-sm text-graphite">
        <span className="font-medium">{DECISION_LABELS[decision]}.</span> {DECISION_PROMPTS[decision]}
      </p>

      <Field
        label={decision === 'REJECTED' ? 'Reason' : 'Note'}
        htmlFor={`note-${profileId}`}
        hint="The technician sees this on their profile."
      >
        <Textarea
          id={`note-${profileId}`}
          name="note"
          rows={3}
          maxLength={500}
          required={decision === 'REJECTED'}
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Confirm'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setDecision(null)}
          disabled={isPending}
        >
          Back
        </Button>
      </div>
    </form>
  )
}
