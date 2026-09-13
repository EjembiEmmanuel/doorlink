'use client'

import { useActionState } from 'react'
import { addToCartAction, type CartActionState } from './actions'
import { Button } from '@/components/ui/Button'

const initialState: CartActionState = {}

export function AddToCartButton({ listingId }: { listingId: string }) {
  const [state, formAction, isPending] = useActionState(addToCartAction, initialState)

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="listingId" value={listingId} />
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? 'Adding…' : 'Add to cart'}
      </Button>
      {state.error && <p className="text-micro text-bad">{state.error}</p>}
    </form>
  )
}
