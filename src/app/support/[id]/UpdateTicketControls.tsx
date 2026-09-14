'use client'

import { useActionState } from 'react'
import type { SupportPriority, SupportStatus } from '@prisma/client'
import { updateTicketAction, type SupportFormState } from '../actions'
import { Field, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const initialState: SupportFormState = {}

export function UpdateTicketControls({
  ticketId,
  status,
  priority,
}: {
  ticketId: string
  status: SupportStatus
  priority: SupportPriority
}) {
  const [state, formAction, isPending] = useActionState(updateTicketAction, initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue={status}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="priority">
        <Select id="priority" name="priority" defaultValue={priority}>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Saving…' : 'Update'}
      </Button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-bad">
          {state.error}
        </p>
      )}
    </form>
  )
}
