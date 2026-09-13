'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'

interface DeleteState {
  error?: string
}

export function AdminDeleteButton({
  id,
  action,
}: {
  id: string
  action: (prevState: DeleteState, formData: FormData) => Promise<DeleteState>
}) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? 'Deleting…' : 'Delete'}
      </Button>
      {state.error && <p className="text-micro text-bad">{state.error}</p>}
    </form>
  )
}
