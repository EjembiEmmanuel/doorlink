'use client'

import { useActionState } from 'react'
import { markAllReadAction, type NotificationActionState } from './actions'
import { Button } from '@/components/ui/Button'

const initial: NotificationActionState = {}

export function MarkAllRead() {
  const [state, formAction, isPending] = useActionState(markAllReadAction, initial)

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Marking…' : 'Mark all as read'}
      </Button>
      {state.error && (
        <p role="alert" className="text-micro text-bad">
          {state.error}
        </p>
      )}
    </form>
  )
}
