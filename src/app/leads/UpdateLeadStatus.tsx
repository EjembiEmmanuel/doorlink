'use client'

import { useActionState } from 'react'
import { updateLeadStatusAction, type LeadStatusFormState } from './actions'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED'] as const

const initialState: LeadStatusFormState = {}

export function UpdateLeadStatus({ leadId, status }: { leadId: string; status: string }) {
  const [state, formAction, isPending] = useActionState(updateLeadStatusAction, initialState)

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <Select name="status" defaultValue={status} className="h-8 py-0 text-sm">
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? 'Saving…' : 'Update'}
      </Button>
      {state.error && <span className="text-micro text-bad">{state.error}</span>}
    </form>
  )
}
