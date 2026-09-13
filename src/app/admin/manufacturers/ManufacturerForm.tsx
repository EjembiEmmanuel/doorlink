'use client'

import { useActionState } from 'react'
import type { Manufacturer } from '@prisma/client'
import { createManufacturerAction, updateManufacturerAction, type ManufacturerFormState } from './actions'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const DATA_SOURCE_OPTIONS = [
  { value: 'ADMIN_VERIFIED', label: 'Admin verified' },
  { value: 'MANUFACTURER_VERIFIED', label: 'Manufacturer verified' },
  { value: 'COMMUNITY_SUBMITTED', label: 'Community submitted' },
  { value: 'IMPORTED', label: 'Imported, unverified' },
  { value: 'DEMO', label: 'Demo data' },
]

const initialState: ManufacturerFormState = {}

export function ManufacturerForm({ manufacturer }: { manufacturer?: Manufacturer }) {
  const action = manufacturer ? updateManufacturerAction.bind(null, manufacturer.id) : createManufacturerAction
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={manufacturer?.name} />
      </Field>

      <Field label="Slug" htmlFor="slug" hint="Leave blank to generate one from the name.">
        <Input id="slug" name="slug" defaultValue={manufacturer?.slug} placeholder="auto-generated" />
      </Field>

      <Field label="Data source" htmlFor="dataSource">
        <Select id="dataSource" name="dataSource" defaultValue={manufacturer?.dataSource ?? 'ADMIN_VERIFIED'}>
          {DATA_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : manufacturer ? 'Save changes' : 'Create manufacturer'}
      </Button>
    </form>
  )
}
