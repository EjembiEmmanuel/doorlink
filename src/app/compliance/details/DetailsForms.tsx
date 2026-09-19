'use client'

import { useActionState, useState } from 'react'
import type { ReactNode } from 'react'
import {
  removeComplianceLogoAction,
  saveComplianceLogoAction,
  saveComplianceProfileAction,
  type ComplianceActionState,
} from '../actions'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { AU_STATES } from '@/lib/australia'
import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES, checkLogoDataUri } from '@/lib/compliance/logo'

const initial: ComplianceActionState = {}

function Status({ state }: { state: ComplianceActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-bad">
        {state.error}
      </p>
    )
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-good">
        {state.notice ?? 'Saved.'}
      </p>
    )
  }
  return null
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
      <legend className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

type Profile = Record<string, unknown> | null

const text = (profile: Profile, key: string) => (profile?.[key] as string | null) ?? ''
const day = (profile: Profile, key: string) => {
  const value = profile?.[key]
  return value instanceof Date ? value.toISOString().slice(0, 10) : ''
}

export function ComplianceDetailsForm({ profile }: { profile: Profile }) {
  const [state, formAction, isPending] = useActionState(saveComplianceProfileAction, initial)

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <Group title="Business details">
        <Field label="Company or business name" htmlFor="businessName">
          <Input id="businessName" name="businessName" defaultValue={text(profile, 'businessName')} />
        </Field>
        <Field label="Trading name" htmlFor="tradingName">
          <Input id="tradingName" name="tradingName" defaultValue={text(profile, 'tradingName')} />
        </Field>
        <Field label="ABN" htmlFor="abn" hint="11 digits.">
          <Input id="abn" name="abn" inputMode="numeric" defaultValue={text(profile, 'abn')} />
        </Field>
        <Field label="ACN (if applicable)" htmlFor="acn" hint="9 digits.">
          <Input id="acn" name="acn" inputMode="numeric" defaultValue={text(profile, 'acn')} />
        </Field>
        <Field label="Business address" htmlFor="businessAddress">
          <Input id="businessAddress" name="businessAddress" defaultValue={text(profile, 'businessAddress')} />
        </Field>
        <Field label="Postal address" htmlFor="postalAddress">
          <Input id="postalAddress" name="postalAddress" defaultValue={text(profile, 'postalAddress')} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={text(profile, 'phone')} />
        </Field>
        <Field label="Mobile" htmlFor="mobile">
          <Input id="mobile" name="mobile" type="tel" defaultValue={text(profile, 'mobile')} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={text(profile, 'email')} />
        </Field>
        <Field label="Website" htmlFor="website">
          <Input id="website" name="website" defaultValue={text(profile, 'website')} />
        </Field>
      </Group>

      <Group title="Key people">
        <Field label="Business owner or director" htmlFor="ownerName">
          <Input id="ownerName" name="ownerName" defaultValue={text(profile, 'ownerName')} />
        </Field>
        <Field label="Operations manager" htmlFor="operationsManager">
          <Input
            id="operationsManager"
            name="operationsManager"
            defaultValue={text(profile, 'operationsManager')}
          />
        </Field>
        <Field label="Compliance contact" htmlFor="complianceContact">
          <Input
            id="complianceContact"
            name="complianceContact"
            defaultValue={text(profile, 'complianceContact')}
          />
        </Field>
        <Field label="Primary site contact" htmlFor="primarySiteContact">
          <Input
            id="primarySiteContact"
            name="primarySiteContact"
            defaultValue={text(profile, 'primarySiteContact')}
          />
        </Field>
        <Field label="Emergency contact (name)" htmlFor="emergencyContactName">
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={text(profile, 'emergencyContactName')}
          />
        </Field>
        <Field label="Emergency contact (number)" htmlFor="emergencyContactNumber">
          <Input
            id="emergencyContactNumber"
            name="emergencyContactNumber"
            type="tel"
            defaultValue={text(profile, 'emergencyContactNumber')}
          />
        </Field>
        <Field label="Nominated first aid officer" htmlFor="firstAidOfficer">
          <Input id="firstAidOfficer" name="firstAidOfficer" defaultValue={text(profile, 'firstAidOfficer')} />
        </Field>
      </Group>

      <Group title="Jurisdiction, licences and insurance">
        <Field
          label="State or territory"
          htmlFor="state"
          hint="Doorlink holds the NSW legislation list. Other states are marked as needing their own instruments added."
        >
          <Select id="state" name="state" defaultValue={text(profile, 'state')}>
            <option value="">—</option>
            {AU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Applicable WHS regulator" htmlFor="whsRegulator">
          <Input id="whsRegulator" name="whsRegulator" defaultValue={text(profile, 'whsRegulator')} />
        </Field>
        <Field label="Trade licence number" htmlFor="tradeLicenceNumber">
          <Input
            id="tradeLicenceNumber"
            name="tradeLicenceNumber"
            defaultValue={text(profile, 'tradeLicenceNumber')}
          />
        </Field>
        <Field label="Electrical licence number" htmlFor="electricalLicenceNumber">
          <Input
            id="electricalLicenceNumber"
            name="electricalLicenceNumber"
            defaultValue={text(profile, 'electricalLicenceNumber')}
          />
        </Field>
        <Field label="Other registration or certification" htmlFor="otherRegistration">
          <Input
            id="otherRegistration"
            name="otherRegistration"
            defaultValue={text(profile, 'otherRegistration')}
          />
        </Field>
        <Field label="Public liability insurer" htmlFor="publicLiabilityInsurer">
          <Input
            id="publicLiabilityInsurer"
            name="publicLiabilityInsurer"
            defaultValue={text(profile, 'publicLiabilityInsurer')}
          />
        </Field>
        <Field label="Public liability policy number" htmlFor="publicLiabilityPolicy">
          <Input
            id="publicLiabilityPolicy"
            name="publicLiabilityPolicy"
            defaultValue={text(profile, 'publicLiabilityPolicy')}
          />
        </Field>
        <Field label="Public liability expiry" htmlFor="publicLiabilityExpiry">
          <Input
            id="publicLiabilityExpiry"
            name="publicLiabilityExpiry"
            type="date"
            defaultValue={day(profile, 'publicLiabilityExpiry')}
          />
        </Field>
        <Field label="Workers compensation policy number" htmlFor="workersCompPolicy">
          <Input
            id="workersCompPolicy"
            name="workersCompPolicy"
            defaultValue={text(profile, 'workersCompPolicy')}
          />
        </Field>
        <Field label="Workers compensation expiry" htmlFor="workersCompExpiry">
          <Input
            id="workersCompExpiry"
            name="workersCompExpiry"
            type="date"
            defaultValue={day(profile, 'workersCompExpiry')}
          />
        </Field>
      </Group>

      <Group title="Approval block">
        <Field label="Prepared by (name)" htmlFor="preparedByName">
          <Input id="preparedByName" name="preparedByName" defaultValue={text(profile, 'preparedByName')} />
        </Field>
        <Field label="Prepared by (position)" htmlFor="preparedByPosition">
          <Input
            id="preparedByPosition"
            name="preparedByPosition"
            defaultValue={text(profile, 'preparedByPosition')}
          />
        </Field>
        <Field label="Approved by (name)" htmlFor="approvedByName">
          <Input id="approvedByName" name="approvedByName" defaultValue={text(profile, 'approvedByName')} />
        </Field>
        <Field label="Approved by (position)" htmlFor="approvedByPosition">
          <Input
            id="approvedByPosition"
            name="approvedByPosition"
            defaultValue={text(profile, 'approvedByPosition')}
          />
        </Field>
        <Field
          label="Pack version"
          htmlFor="packVersion"
          hint="Your own version number, printed on every page."
        >
          <Input id="packVersion" name="packVersion" defaultValue={text(profile, 'packVersion')} />
        </Field>
      </Group>

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <Status state={state} />
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function LogoForm({ logoDataUri }: { logoDataUri: string | null }) {
  const [state, formAction, isPending] = useActionState(saveComplianceLogoAction, initial)
  const [removeState, removeAction, isRemoving] = useActionState(removeComplianceLogoAction, initial)
  // The chosen image is React state, and the hidden field that the action
  // reads renders from that state. An earlier version wrote the data URI
  // onto the input through a ref; the write was lost on the next render
  // and the form posted an empty field, so the fix is to have one source
  // of truth rather than a ref and a value that can disagree.
  const [dataUri, setDataUri] = useState<string | null>(logoDataUri)
  const [localError, setLocalError] = useState<string | null>(null)

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setLocalError(null)
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      // Checked here for a fast answer; the server checks again, because
      // this one runs on the user's machine.
      const check = checkLogoDataUri(result)
      if (!check.ok) {
        setLocalError(check.error)
        setDataUri(null)
        return
      }
      setDataUri(result)
    }
    reader.onerror = () => setLocalError('That file could not be read.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-4">
      {dataUri && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUri}
          alt="Your logo as it will appear on each document"
          className="max-h-24 w-auto max-w-[16rem] rounded border border-line bg-paper object-contain p-2"
        />
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="logoDataUri" value={dataUri ?? ''} readOnly />
        <Field
          label="Logo image"
          htmlFor="logoFile"
          hint={`PNG, JPEG or WebP, up to ${Math.round(MAX_LOGO_BYTES / 1024)} KB. SVG is not accepted.`}
        >
          <Input
            id="logoFile"
            type="file"
            accept={ALLOWED_LOGO_TYPES.join(',')}
            onChange={onPick}
            className="h-auto py-2"
          />
        </Field>

        {localError && (
          <p role="alert" className="text-sm text-bad">
            {localError}
          </p>
        )}
        <Status state={state} />

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="secondary" disabled={isPending || !dataUri}>
            {isPending ? 'Saving…' : 'Save logo'}
          </Button>
        </div>
      </form>

      {logoDataUri && (
        <form action={removeAction}>
          <Button type="submit" variant="secondary" disabled={isRemoving}>
            {isRemoving ? 'Removing…' : 'Remove logo'}
          </Button>
          <Status state={removeState} />
        </form>
      )}
    </div>
  )
}
