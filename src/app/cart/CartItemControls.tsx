'use client'

import { useActionState } from 'react'
import { updateCartItemAction, removeCartItemAction, type CartActionState } from './actions'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const initialState: CartActionState = {}

export function CartItemControls({ itemId, quantity }: { itemId: string; quantity: number }) {
  const [updateState, updateAction, updatePending] = useActionState(updateCartItemAction, initialState)
  const [removeState, removeAction, removePending] = useActionState(removeCartItemAction, initialState)

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <form action={updateAction} className="flex items-center gap-2">
          <input type="hidden" name="itemId" value={itemId} />
          <Input
            name="quantity"
            type="number"
            min={1}
            max={99}
            defaultValue={quantity}
            className="h-9 w-16 text-center"
            aria-label="Quantity"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={updatePending}>
            Update
          </Button>
        </form>
        <form action={removeAction}>
          <input type="hidden" name="itemId" value={itemId} />
          <Button type="submit" size="sm" variant="secondary" disabled={removePending}>
            Remove
          </Button>
        </form>
      </div>
      {(updateState.error || removeState.error) && (
        <p className="text-micro text-bad">{updateState.error || removeState.error}</p>
      )}
    </div>
  )
}
