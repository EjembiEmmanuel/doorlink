'use client'

import { useActionState } from 'react'
import type { Compatibility } from '@prisma/client'
import {
  createCompatibilityAction,
  updateCompatibilityAction,
  type CompatibilityFormState,
} from './actions'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const KIND_OPTIONS = [
  { value: 'REPLACEMENT_PART', label: 'Replacement part' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'REMOTE_PAIR', label: 'Remote pair' },
  { value: 'CONTROL_BOARD_MATCH', label: 'Control board match' },
  { value: 'MOTOR_MATCH', label: 'Motor match' },
]

const CONFIDENCE_OPTIONS = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'LIKELY', label: 'Likely' },
  { value: 'UNCONFIRMED', label: 'Unconfirmed' },
]

const DATA_SOURCE_OPTIONS = [
  { value: 'ADMIN_VERIFIED', label: 'Admin verified' },
  { value: 'MANUFACTURER_VERIFIED', label: 'Manufacturer verified' },
  { value: 'COMMUNITY_SUBMITTED', label: 'Community submitted' },
  { value: 'IMPORTED', label: 'Imported, unverified' },
  { value: 'DEMO', label: 'Demo data' },
]

interface ModelOption {
  id: string
  label: string
}

const initialState: CompatibilityFormState = {}

export function CompatibilityForm({
  compatibility,
  models,
}: {
  compatibility?: Compatibility
  models: ModelOption[]
}) {
  const action = compatibility
    ? updateCompatibilityAction.bind(null, compatibility.id)
    : createCompatibilityAction
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <Field label="From model" htmlFor="fromModelId">
        <Select id="fromModelId" name="fromModelId" defaultValue={compatibility?.fromModelId}>
          {models.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="To model" htmlFor="toModelId" hint="The two models can't be the same.">
        <Select id="toModelId" name="toModelId" defaultValue={compatibility?.toModelId}>
          {models.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Kind" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue={compatibility?.kind ?? 'REPLACEMENT_PART'}>
          {KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Confidence" htmlFor="confidence">
        <Select id="confidence" name="confidence" defaultValue={compatibility?.confidence ?? 'UNCONFIRMED'}>
          {CONFIDENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Data source" htmlFor="dataSource">
        <Select id="dataSource" name="dataSource" defaultValue={compatibility?.dataSource ?? 'ADMIN_VERIFIED'}>
          {DATA_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Note" htmlFor="note" hint="Optional. Visible wherever this link is shown.">
        <Textarea id="note" name="note" defaultValue={compatibility?.note ?? ''} />
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : compatibility ? 'Save changes' : 'Create link'}
      </Button>
    </form>
  )
}
