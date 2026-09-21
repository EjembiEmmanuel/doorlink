'use client'

import { useActionState, useMemo, useState } from 'react'
import type { Model } from '@prisma/client'
import { createModelAction, updateModelAction, type ModelFormState } from './actions'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const DATA_SOURCE_OPTIONS = [
  { value: 'ADMIN_VERIFIED', label: 'Admin verified' },
  { value: 'MANUFACTURER_VERIFIED', label: 'Manufacturer verified' },
  { value: 'COMMUNITY_SUBMITTED', label: 'Community submitted' },
  { value: 'IMPORTED', label: 'Imported, unverified' },
  { value: 'DEMO', label: 'Demo data' },
]

interface Option {
  id: string
  name: string
}

interface ProductLineOption extends Option {
  manufacturerId: string
}

const initialState: ModelFormState = {}

export function ModelForm({
  model,
  manufacturers,
  categories,
  productLines,
}: {
  model?: Model
  manufacturers: Option[]
  categories: Option[]
  productLines: ProductLineOption[]
}) {
  const action = model ? updateModelAction.bind(null, model.id) : createModelAction
  const [state, formAction, isPending] = useActionState(action, initialState)
  const [manufacturerId, setManufacturerId] = useState(model?.manufacturerId ?? manufacturers[0]?.id ?? '')

  // Only lines that actually belong to the chosen manufacturer — the
  // action re-validates this pairing server-side regardless.
  const availableProductLines = useMemo(
    () => productLines.filter((line) => line.manufacturerId === manufacturerId),
    [productLines, manufacturerId]
  )

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="Manufacturer" htmlFor="manufacturerId">
        <Select
          id="manufacturerId"
          name="manufacturerId"
          value={manufacturerId}
          onChange={(event) => setManufacturerId(event.target.value)}
        >
          {manufacturers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Category" htmlFor="categoryId">
        <Select id="categoryId" name="categoryId" defaultValue={model?.categoryId}>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Product line"
        htmlFor="productLineId"
        hint={
          availableProductLines.length === 0
            ? 'This manufacturer has no product lines yet. Leave as None.'
            : 'Optional. Only lines belonging to the chosen manufacturer are listed.'
        }
      >
        <Select id="productLineId" name="productLineId" defaultValue={model?.productLineId ?? ''}>
          <option value="">None</option>
          {availableProductLines.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={model?.name} />
      </Field>

      <Field label="Model code" htmlFor="modelCode" hint="Unique per manufacturer, e.g. DR-700.">
        <Input id="modelCode" name="modelCode" required defaultValue={model?.modelCode} />
      </Field>

      <Field label="Slug" htmlFor="slug" hint="Leave blank to generate one from the manufacturer and name.">
        <Input id="slug" name="slug" defaultValue={model?.slug} placeholder="auto-generated" />
      </Field>

      <Field label="Summary" htmlFor="summary">
        <Textarea id="summary" name="summary" defaultValue={model?.summary ?? ''} />
      </Field>

      <Field label="Data source" htmlFor="dataSource">
        <Select id="dataSource" name="dataSource" defaultValue={model?.dataSource ?? 'ADMIN_VERIFIED'}>
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
        {isPending ? 'Saving…' : model ? 'Save changes' : 'Create model'}
      </Button>
    </form>
  )
}
