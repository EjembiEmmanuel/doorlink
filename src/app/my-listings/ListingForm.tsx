'use client'

import { useActionState } from 'react'
import type { Listing } from '@prisma/client'
import { createListingAction, updateListingAction, type ListingFormState } from './actions'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'REFURBISHED', label: 'Refurbished' },
  { value: 'USED', label: 'Used' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft (not visible)' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'SOLD_OUT', label: 'Sold out' },
  { value: 'ARCHIVED', label: 'Archived' },
]

interface ModelOption {
  id: string
  label: string
}

const initialState: ListingFormState = {}

export function ListingForm({ listing, models }: { listing?: Listing; models: ModelOption[] }) {
  const action = listing ? updateListingAction.bind(null, listing.id) : createListingAction
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Model" htmlFor="modelId">
        <Select id="modelId" name="modelId" defaultValue={listing?.modelId}>
          {models.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Listing title" htmlFor="title">
        <Input id="title" name="title" required defaultValue={listing?.title} />
      </Field>

      <Field label="Price (AUD)" htmlFor="price">
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={listing ? (listing.priceCents / 100).toFixed(2) : undefined}
        />
      </Field>

      <Field label="Condition" htmlFor="condition">
        <Select id="condition" name="condition" defaultValue={listing?.condition ?? 'NEW'}>
          {CONDITION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Status" htmlFor="status" hint="Only Active listings appear on the public marketplace.">
        <Select id="status" name="status" defaultValue={listing?.status ?? 'DRAFT'}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Stock quantity" htmlFor="stockQty">
        <Input
          id="stockQty"
          name="stockQty"
          type="number"
          step="1"
          min="0"
          required
          defaultValue={listing?.stockQty ?? 0}
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : listing ? 'Save changes' : 'Create listing'}
      </Button>
    </form>
  )
}
