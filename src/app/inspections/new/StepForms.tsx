'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AssetType } from '@prisma/client'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ASSET_TYPE_LABELS } from '@/lib/labels'
import {
  createAssetAction,
  createClientAction,
  createSiteAction,
  startInspectionAction,
  type InspectionActionState,
} from '../actions'

const EMPTY: InspectionActionState = {}

function ErrorLine({ state }: { state: InspectionActionState }) {
  if (!state.error) return null
  return (
    <p className="rounded border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad" role="alert">
      {state.error}
    </p>
  )
}

/**
 * On success each form advances the cascade by pushing the new record's
 * id into the query string, so the browser back button walks back
 * through the steps and a half-finished selection survives a refresh.
 */
function useAdvance(state: InspectionActionState, buildHref: (id: string) => string) {
  const router = useRouter()
  useEffect(() => {
    if (state.ok && state.id) router.push(buildHref(state.id))
    // buildHref is recreated each render; the id is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.id])
}

export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAction, EMPTY)
  useAdvance(state, (id) => `/inspections/new?clientId=${id}`)

  return (
    <form action={action} className="grid gap-4">
      <ErrorLine state={state} />
      <Field label="Customer name" htmlFor="name">
        <Input id="name" name="name" required autoComplete="organization" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor="contactName" hint="Optional">
          <Input id="contactName" name="contactName" autoComplete="name" />
        </Field>
        <Field label="Phone" htmlFor="phone" hint="Optional">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>
      <Field label="Email" htmlFor="email" hint="Optional">
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add customer'}
      </Button>
    </form>
  )
}

export function NewSiteForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(createSiteAction, EMPTY)
  useAdvance(state, (id) => `/inspections/new?clientId=${clientId}&siteId=${id}`)

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <ErrorLine state={state} />
      <Field label="Site name" htmlFor="siteName" hint="What the site is called on the run sheet">
        <Input id="siteName" name="name" required />
      </Field>
      <Field label="Address" htmlFor="addressLine" hint="Optional">
        <Input id="addressLine" name="addressLine" autoComplete="street-address" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Suburb" htmlFor="suburb" hint="Optional">
          <Input id="suburb" name="suburb" />
        </Field>
        <Field label="State" htmlFor="state" hint="Optional">
          <Input id="state" name="state" maxLength={3} />
        </Field>
        <Field label="Postcode" htmlFor="postcode" hint="Optional">
          <Input id="postcode" name="postcode" inputMode="numeric" maxLength={4} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add site'}
      </Button>
    </form>
  )
}

export function NewAssetForm({ clientId, siteId }: { clientId: string; siteId: string }) {
  const [state, action, pending] = useActionState(createAssetAction, EMPTY)
  useAdvance(state, (id) => `/inspections/new?clientId=${clientId}&siteId=${siteId}&assetId=${id}`)

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="siteId" value={siteId} />
      <ErrorLine state={state} />
      <Field label="Asset name" htmlFor="assetName" hint="How the site refers to it — “Main roller shutter”">
        <Input id="assetName" name="name" required />
      </Field>
      <Field
        label="Equipment type"
        htmlFor="assetType"
        hint="This decides which questions the inspection asks."
      >
        <Select id="assetType" name="assetType" required defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {Object.values(AssetType).map((type) => (
            <option key={type} value={type}>
              {ASSET_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Location on site" htmlFor="location" hint="Optional">
        <Input id="location" name="location" placeholder="Loading dock, rear entrance…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Manufacturer" htmlFor="manufacturerName" hint="Optional">
          <Input id="manufacturerName" name="manufacturerName" />
        </Field>
        <Field label="Model" htmlFor="modelName" hint="Optional">
          <Input id="modelName" name="modelName" />
        </Field>
        <Field label="Serial number" htmlFor="serialNumber" hint="Leave blank if there is no legible plate">
          <Input id="serialNumber" name="serialNumber" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add asset'}
      </Button>
    </form>
  )
}

export function StartInspectionForm({
  assetId,
  templates,
  technicianName,
}: {
  assetId: string
  templates: { id: string; name: string; description: string | null }[]
  technicianName: string
}) {
  const [state, action, pending] = useActionState(startInspectionAction, EMPTY)
  const router = useRouter()
  useEffect(() => {
    if (state.ok && state.id) router.push(`/inspections/${state.id}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.id])

  if (templates.length === 0) {
    return (
      <div className="rounded border border-caution/30 bg-caution-tint px-4 py-3 text-sm text-graphite-soft">
        No inspection template is published for this equipment type yet. An admin can publish one from
        the template library.
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="assetId" value={assetId} />
      <ErrorLine state={state} />

      <Field label="Inspection type" htmlFor="templateId" hint="Decides which questions are asked.">
        <Select id="templateId" name="templateId" required defaultValue={templates[0]?.id}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="What to call this inspection"
        htmlFor="inspectionType"
        hint="Printed on the report — “Preventative maintenance”, “6-monthly service”."
      >
        <Input id="inspectionType" name="inspectionType" required defaultValue="Preventative maintenance" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job number" htmlFor="jobNumber" hint="Optional">
          <Input id="jobNumber" name="jobNumber" />
        </Field>
        <Field
          label="Your licence or qualification"
          htmlFor="technicianLicence"
          hint="Recorded as you state it. Doorlink does not check it against any register."
        >
          <Input id="technicianLicence" name="technicianLicence" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site contact" htmlFor="siteContact" hint="Optional">
          <Input id="siteContact" name="siteContact" />
        </Field>
        <Field label="Contact phone" htmlFor="contactPhone" hint="Optional">
          <Input id="contactPhone" name="contactPhone" type="tel" />
        </Field>
      </div>

      <p className="text-micro text-zinc-deep">Carried out by {technicianName}.</p>

      <Button type="submit" disabled={pending}>
        {pending ? 'Starting…' : 'Start inspection'}
      </Button>
    </form>
  )
}
